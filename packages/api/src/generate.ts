import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@iarna/toml';

type Model = {
  id: string;
  name?: string;
  provider: string;
  modalities?: { input?: string[]; output?: string[] };
  context?: number;
  tool_call?: boolean;
  reasoning?: boolean;
  cost?: Record<string, unknown>;
  [k: string]: unknown;
};

type Provider = {
  id: string;
  name?: string;
  [k: string]: unknown;
};

async function loadDB(
  root: string
): Promise<{ models: Model[]; providers: Provider[] }> {
  const providers: Provider[] = [];
  const models: Model[] = [];
  const providersDir = `${root}/providers`;

  try {
    const providerDirs = await fs.readdir(providersDir);

    for (const providerId of providerDirs) {
      const providerPath = `${providersDir}/${providerId}/provider.toml`;

      try {
        const providerContent = await fs.readFile(providerPath, 'utf8');
        const prov = parse(providerContent) as Omit<Provider, 'id'>;
        providers.push({ id: providerId, ...prov });

        // Load models for this provider
        const modelsDir = `${providersDir}/${providerId}/models`;
        try {
          const modelFiles = await fs.readdir(modelsDir);

          for (const modelFile of modelFiles) {
            if (modelFile.endsWith('.toml')) {
              const modelPath = `${modelsDir}/${modelFile}`;
              const modelContent = await fs.readFile(modelPath, 'utf8');
              const m = parse(modelContent) as Omit<Model, 'id' | 'provider'>;
              const mid = modelFile.replace('.toml', '');
              const id = `${providerId}:${mid}`;
              models.push({ id, provider: providerId, ...m });
            }
          }
        } catch (_error) {
          // Ignore errors for individual model files that can't be parsed
        }
      } catch (_error) {
        // Ignore errors for providers that can't be loaded
      }
    }
  } catch (_error) {
    // Ignore errors during database loading
  }

  return { models, providers };
}

async function generate() {
  // Resolve vendor path relative to this file so it works in any environment
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '../../../vendor/models.dev');

  const db = await loadDB(root);

  // Write the generated data to src (so they can be imported by TypeScript)
  await fs.writeFile('src/models.json', JSON.stringify(db.models, null, 2));
  await fs.writeFile(
    'src/providers.json',
    JSON.stringify(db.providers, null, 2)
  );
}

generate().catch(() => {
  // Ignore errors during generation
});
