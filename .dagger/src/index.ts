import {
  Container,
  Directory,
  object,
  func,
  argument,
  BuildArg,
  dag,
  Platform,
} from "@dagger.io/dagger";

@object()
export class Zero2prod {
  @func()
  buildWithLocalDockerfile(
    @argument({ description: "Build context directory (usually repo root)" })
    src: Directory,

    @argument({ description: "Path to Dockerfile relative to src" })
    dockerfile?: string,

    @argument({ description: "Target stage (multi-stage Dockerfile)" })
    target?: string,

    @argument({ description: 'Build args as ["KEY=VALUE", ...]' })
    buildArgs?: string[],

    @argument({ description: 'Platform, e.g. "linux/amd64"' })
    platform?: string,
  ): Container {
    const args: BuildArg[] | undefined = buildArgs?.map((kv) => {
      const i = kv.indexOf("=");
      return { name: kv.slice(0, i), value: kv.slice(i + 1) };
    });

    return src.dockerBuild({
      dockerfile: dockerfile ?? "Dockerfile",
      target,
      buildArgs: args,
      platform: platform as Platform | undefined,
    });
  }

  // Handy helper so you can *see* something happen in `dagger` shell:
  @func()
  async smoke(src: Directory): Promise<string> {
    return await this.buildWithLocalDockerfile(src)
      .withExec(["sh", "-lc", "echo built && uname -a && ls -la"])
      .stdout();
  }

  @func()
  async clippy(
    @argument({ description: "Rust project source directory (repo root)" })
    src: Directory,

    @argument({ description: 'Extra cargo args, e.g. ["--all-features"]' })
    cargoArgs?: string[],

    @argument({ description: "Treat warnings as errors" })
    denyWarnings: boolean = true,
  ): Promise<string> {
    let ctr = dag
      .container()
      .from("rust:1.92.0")
      .withWorkdir("/work")
      // Mount the source code into the container
      .withMountedDirectory("/work", src)
      // Add caches to speed up repeated runs.
      .withMountedCache("/cargo/registry", dag.cacheVolume("cargo-registry"))
      .withMountedCache("/cargo/git", dag.cacheVolume("cargo-registry"))
      .withMountedCache("/work/target", dag.cacheVolume("cargo-target"))
      // Tell cargo were home is, so it uses our cached paths.
      .withEnvVariable("CARGO_HOME", "/cargo");

    // Ensure clippy is available
    ctr = ctr.withExec(["rustup", "component", "add", "clippy"]);

    // Run clippy
    const args = cargoArgs ?? [];
    const clippyCmd = [
      "cargo",
      "clippy",
      ...args,
      "--",
      ...(denyWarnings ? ["-D", "warnings"] : []),
    ]

    return await ctr.withExec(clippyCmd).stdout();
  }
}

