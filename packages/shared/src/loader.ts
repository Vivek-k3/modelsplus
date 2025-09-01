import fs from 'node:fs/promises';
import { parse } from '@iarna/toml';
import { glob } from 'glob';

export type Model = {
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

export type Provider = { id: string; name?: string; [k: string]: unknown };

export async function loadDB(
  root = '../../../vendor/models.dev'
): Promise<{ models: Model[]; providers: Provider[] }> {
  const providers: Provider[] = [];
  const models: Model[] = [];

  for (const provPath of await glob(`${root}/providers/*/provider.toml`)) {
    const providerId = provPath.split('/providers/')[1].split('/')[0];
    const prov = parse(await fs.readFile(provPath, 'utf8')) as Omit<
      Provider,
      'id'
    >;
    providers.push({ id: providerId, ...prov });

    for (const modelPath of await glob(
      `${root}/providers/${providerId}/models/*.toml`
    )) {
      const mid = modelPath.split('/models/')[1].replace('.toml', '');
      const m = parse(await fs.readFile(modelPath, 'utf8')) as Omit<
        Model,
        'id' | 'provider'
      >;
      const id = `${providerId}:${mid}`;
      models.push({ id, provider: providerId, ...m });
    }
  }
  return { models, providers };
}
