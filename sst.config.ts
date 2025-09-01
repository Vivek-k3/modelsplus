/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app() {
    return {
      name: 'modelsplus',
      home: 'cloudflare',
    };
  },
  async run() {
    // Build the API
    const { spawnSync } = await import('node:child_process');

    spawnSync('bun', ['run', 'build'], {
      cwd: './packages/api',
    });

    // Generate runtime JSON assets after build (tsup cleans dist)
    spawnSync('bun', ['run', 'generate'], {
      cwd: './packages/api',
    });

    // Create Cloudflare Worker
    const worker = new sst.cloudflare.Worker('Api', {
      url: true,
      handler: './packages/api/src/worker.ts',
      transform: {
        worker: {
          observability: { enabled: true },
        },
      },
    });

    return {
      api: worker.url,
    };
  },
});
