import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Type definitions
type Model = {
  id: string;
  provider: string;
  name?: string;
  release_date?: string;
  last_updated?: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  open_weights?: boolean;
  knowledge?: string;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
  modalities?: {
    input?: string[];
    output?: string[];
  };
  [key: string]: unknown;
};

type Provider = {
  id: string;
  name: string;
  env: string[];
  npm?: string;
  api?: string;
  doc?: string;
  [key: string]: unknown;
};

// Constants for magic numbers
const API_TIMEOUT_MS = 10_000;
const DEFAULT_SEARCH_LIMIT = 50;
const DEFAULT_PROVIDERS_LIMIT = 20;

// API Client for internal use
class ModelsAPI {
  private async fetchFromAPI(
    endpoint: string,
    params?: Record<string, string | boolean | number>
  ): Promise<unknown> {
    const url = new URL(`${'https://modelsplus.quivr.tech'}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'modelsplus-mcp/0.1.0',
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async searchModels(options: {
    q?: string;
    provider?: string;
    tool_call?: boolean;
    reasoning?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Model[]> {
    const params: Record<string, string | boolean | number> = {};

    if (options.q) {
      params.q = options.q;
    }
    if (options.provider) {
      params.provider = options.provider;
    }
    if (options.tool_call !== undefined) {
      params.tool_call = options.tool_call;
    }
    if (options.reasoning !== undefined) {
      params.reasoning = options.reasoning;
    }
    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      params.offset = options.offset;
    }

    const data = await this.fetchFromAPI('/v1/models', params);
    return data as Model[];
  }

  async getModel(id: string): Promise<Model | null> {
    try {
      const data = await this.fetchFromAPI(`/v1/models/${id}`);
      return data as Model | null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async searchProviders(options: {
    q?: string;
    env?: string;
    limit?: number;
    offset?: number;
  }): Promise<Provider[]> {
    const params: Record<string, string | boolean | number> = {};

    if (options.q) {
      params.q = options.q;
    }
    if (options.env) {
      params.env = options.env;
    }
    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      params.offset = options.offset;
    }

    const data = await this.fetchFromAPI('/v1/providers', params);
    return data as Provider[];
  }

  async getProviders(): Promise<Provider[]> {
    const data = await this.fetchFromAPI('/v1/providers');
    return data as Provider[];
  }

  async getProvider(id: string): Promise<Provider | null> {
    try {
      const providers = await this.getProviders();
      return providers.find((p: Provider) => p.id === id) || null;
    } catch (_error) {
      return null;
    }
  }
}

// Configuration schema for the ModelsPlus API
export const configSchema = z.object({
  apiTimeout: z
    .number()
    .default(API_TIMEOUT_MS)
    .describe('API request timeout in milliseconds'),
  debug: z.boolean().default(false).describe('Enable debug logging'),
});

export default function createServer() {
  const api = new ModelsAPI();

  const server = new McpServer({
    name: 'modelsplus',
    version: '0.1.0',
  });

  // Tool: Search Models
  server.registerTool(
    'search_models',
    {
      title: 'Search Models',
      description: 'Search for AI models by name, provider, or capabilities',
      inputSchema: {
        q: z
          .string()
          .optional()
          .describe('Search query (model name, provider, etc.)'),
        provider: z
          .string()
          .optional()
          .describe('Filter by provider (e.g., openai, anthropic)'),
        tool_call: z
          .boolean()
          .optional()
          .describe('Filter by tool calling support'),
        reasoning: z
          .boolean()
          .optional()
          .describe('Filter by reasoning capabilities'),
        limit: z
          .number()
          .default(DEFAULT_SEARCH_LIMIT)
          .describe('Maximum number of results'),
      },
    },
    async (args: {
      q?: string;
      provider?: string;
      tool_call?: boolean;
      reasoning?: boolean;
      limit?: number;
    }) => {
      const {
        q,
        provider,
        tool_call,
        reasoning,
        limit = DEFAULT_SEARCH_LIMIT,
      } = args;
      const searchOptions: Parameters<ModelsAPI['searchModels']>[0] = {};

      if (q !== undefined) {
        searchOptions.q = q;
      }
      if (provider !== undefined) {
        searchOptions.provider = provider;
      }
      if (tool_call !== undefined) {
        searchOptions.tool_call = tool_call;
      }
      if (reasoning !== undefined) {
        searchOptions.reasoning = reasoning;
      }
      if (limit !== undefined) {
        searchOptions.limit = limit;
      }

      try {
        const models = await api.searchModels(searchOptions);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${models.length} AI models matching your criteria:\n\n${JSON.stringify(
                models,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(
          `Failed to search models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Tool: Get Model
  server.registerTool(
    'get_model',
    {
      title: 'Get Model',
      description: 'Get detailed information about a specific AI model',
      inputSchema: {
        id: z.string().describe('Model ID (e.g., gpt-4, claude-3-sonnet)'),
      },
    },
    async (args) => {
      const { id } = args as { id: string };

      try {
        const model = await api.getModel(id);
        if (!model) {
          throw new Error(`AI model with ID '${id}' not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `AI model details for ${model.id}:\n\n${JSON.stringify(model, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(
          `Failed to get model '${id}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Tool: Search Providers
  server.registerTool(
    'search_providers',
    {
      title: 'Search Providers',
      description:
        'Search for AI model providers by name or environment variables',
      inputSchema: {
        q: z.string().optional().describe('Search query (provider name)'),
        env: z
          .string()
          .optional()
          .describe('Filter by required environment variable'),
        limit: z
          .number()
          .default(DEFAULT_PROVIDERS_LIMIT)
          .describe('Maximum number of results'),
      },
    },
    async (args: { q?: string; env?: string; limit?: number }) => {
      const { q, env, limit = DEFAULT_PROVIDERS_LIMIT } = args;
      const searchOptions: Parameters<ModelsAPI['searchProviders']>[0] = {};

      if (q !== undefined) {
        searchOptions.q = q;
      }
      if (env !== undefined) {
        searchOptions.env = env;
      }
      if (limit !== undefined) {
        searchOptions.limit = limit;
      }

      try {
        const providers = await api.searchProviders(searchOptions);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${providers.length} AI model providers matching your criteria:\n\n${JSON.stringify(
                providers,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(
          `Failed to search providers: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Tool: Get Provider
  server.registerTool(
    'get_provider',
    {
      title: 'Get Provider',
      description:
        'Get detailed information about a specific AI model provider',
      inputSchema: {
        id: z.string().describe('Provider ID'),
      },
    },
    async (args) => {
      const { id } = args as { id: string };

      try {
        const provider = await api.getProvider(id);
        if (!provider) {
          throw new Error(`AI model provider with ID '${id}' not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `AI model provider details for ${provider.id}:\n\n${JSON.stringify(provider, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(
          `Failed to get provider '${id}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Resource: ModelsPlus API Info
  server.registerResource(
    'modelsplus-api-info',
    'info://modelsplus-api',
    {
      title: 'ModelsPlus API Information',
      description: 'Information about the ModelsPlus API and data sources',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `ModelsPlus MCP Server v0.1.1

Data Source: https://modelsplus.quivr.tech
API Documentation: https://github.com/vivek-k3/modelsplus

This server provides real-time access to AI model specifications and provider information from the Models.dev database.

Available Tools:
- search_models: Search AI models by various criteria
- get_model: Get detailed information about a specific model
- search_providers: Search AI model providers
- get_provider: Get detailed information about a specific provider
`,
          mimeType: 'text/plain',
        },
      ],
    })
  );

  return server.server;
}
