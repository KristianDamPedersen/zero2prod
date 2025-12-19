import {
  Container,
  Directory,
  object,
  func,
  argument,
  BuildArg,
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
}

