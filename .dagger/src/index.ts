import {
  Container,
  Directory,
  Service,
  object,
  func,
  argument,
  BuildArg,
  dag,
  Platform,
  Secret,
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

  @func()
  async postgres(
    @argument({ description: "Postgres image tage" })
    image: string = "postgres:16",
    @argument({ description: "DB Name" })
    dbName: string = "app",
    @argument({ description: "DB User" })
    dbUser: string = "app",
    @argument({ description: "DB Password" })
    dbPassword: Secret
  ): Service {
    return dag
      .container()
      .from(image)
      .withEnvVariable("POSTGRES_DB", dbName)
      .withEnvVariable("POSTGRES_USER", dbUser)
      .withSecretVariable("POSTGRES_PASSWORD", dbPassword)
      .withExposedPort(5432)
      .asService();
  }

  rustBase(src: Directory): Container {
    return dag
      .container()
      .from("rust:1.92.0")
      .withWorkdir("/work")
      .withMountedDirectory("/work", src)
      // Cargo caches
      .withMountedCache("/cargo/registry", dag.cacheVolume("cargo-registry"))
      .withMountedCache("/cargo/git", dag.cacheVolume("cargo-git"))
      .withMountedCache("/work/target", dag.cacheVolume("cargo-target"))
      .withEnvVariable("CARGO_HOME", "/cargo");
  }

  @func()
  async dbSmoke(
    @argument({ description: "Repo root" })
    src: Directory,
    @argument({ description: "DB password" })
    dbPassword: Secret
  ): Promise<string> {
    const db = this.postgres("postgres:16", "app", "app", dbPassword);

    const ctr = this.rustBase(src)
      .withServiceBinding("db", db)
      .withExec(["bash", "-lc", "apt-get update && apt-get install -y postgresql-client"]);

    // Important: `db` is the service hostname
    return await ctr
      .withSecretVariable("PGPASSWORD", dbPassword)
      .withEnvVariable("PGHOST", "db")
      .withEnvVariable("PGUSER", "app")
      .withEnvVariable("PGDATABASE", "app")
      .withExec(["bash", "-lc", "psql -c 'select 1'"])
      .stdout();
  }

  @func()
  async publishToGhcr(
    @argument({ description: "Build directory" })
    src: Directory,
    @argument({ description: "Image name" })
    imageName: string,
    @argument({ description: "Github registry" })
    registry: string,
    @argument({ description: "Github user" })
    user: string,
    @argument({ description: "Github token" })
    token: Secret
  ): Promise<string> {
    const base = `ghcr.io/${registry}/${imageName}`
    const sha = await src.asGit().head().commit()
    const shortSha = sha.slice(0, 12)
    const shaRef = `${base}:${shortSha}`
    const latestRef = `${base}:latest`

    const built = this.buildWithLocalDockerfile(src).withRegistryAuth(base, user, token)

    // Publish with both sha and latest ref
    await built.publish(shaRef)
    return await built.publish(latestRef)

  }
}

