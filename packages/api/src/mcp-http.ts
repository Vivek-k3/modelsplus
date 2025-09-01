import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  InitializeRequestSchema,
  type InitializeResult,
  type JSONRPCRequest,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Constants for pagination limits
const DEFAULT_MODELS_LIMIT = 50;
const DEFAULT_PROVIDERS_LIMIT = 20;

// JSON-RPC response type
type JSONRPCResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

// Tool call parameters type
type ToolCallParams = {
  name: string;
  arguments: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON data at runtime for compatibility
const modelsData: Model[] = JSON.parse(
  readFileSync(join(__dirname, 'models.json'), 'utf-8')
);
const providersData: Provider[] = JSON.parse(
  readFileSync(join(__dirname, 'providers.json'), 'utf-8')
);

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

// API Client for internal use
class ModelsAPI {
  searchModels(options: {
    q?: string;
    provider?: string;
    tool_call?: boolean;
    reasoning?: boolean;
    limit?: number;
    offset?: number;
  }): Model[] {
    let filteredModels = [...modelsData];

    // Text search
    if (options.q) {
      const query = options.q.toLowerCase();
      filteredModels = filteredModels.filter((model: Model) => {
        const searchableText =
          `${model.id} ${model.name ?? ''} ${model.provider}`.toLowerCase();
        return searchableText.includes(query);
      });
    }

    // Provider filter
    if (options.provider) {
      filteredModels = filteredModels.filter(
        (model: Model) => model.provider === options.provider
      );
    }

    // Boolean filters
    if (options.tool_call !== undefined) {
      filteredModels = filteredModels.filter(
        (model: Model) => model.tool_call === options.tool_call
      );
    }
    if (options.reasoning !== undefined) {
      filteredModels = filteredModels.filter(
        (model: Model) => model.reasoning === options.reasoning
      );
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || DEFAULT_MODELS_LIMIT;

    if (offset > 0) {
      filteredModels = filteredModels.slice(offset);
    }

    if (limit > 0) {
      filteredModels = filteredModels.slice(0, limit);
    }

    return filteredModels;
  }

  getModel(id: string): Model | null {
    const model = modelsData.find((m: Model) => m.id === id);
    return model || null;
  }

  searchProviders(options: {
    q?: string;
    env?: string;
    limit?: number;
    offset?: number;
  }): Provider[] {
    let filteredProviders = [...providersData];

    // Text search
    if (options.q) {
      const query = options.q.toLowerCase();
      filteredProviders = filteredProviders.filter(
        (p: Provider) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      );
    }

    // Environment filter
    if (options.env) {
      filteredProviders = filteredProviders.filter((p: Provider) =>
        p.env.some((e) =>
          e.toLowerCase().includes(options.env?.toLowerCase() ?? '')
        )
      );
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || DEFAULT_PROVIDERS_LIMIT;

    if (offset > 0) {
      filteredProviders = filteredProviders.slice(offset);
    }

    if (limit > 0) {
      filteredProviders = filteredProviders.slice(0, limit);
    }

    return filteredProviders;
  }

  getProviders(): Provider[] {
    return [...providersData];
  }
}

// Tool definitions
const SEARCH_MODELS_TOOL: Tool = {
  name: 'search_models',
  description: 'Search for AI models by name, provider, or capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        description: 'Search query (model name, provider, etc.)',
      },
      provider: {
        type: 'string',
        description: 'Filter by provider (e.g., openai, anthropic)',
      },
      tool_call: {
        type: 'boolean',
        description: 'Filter by tool calling support',
      },
      reasoning: {
        type: 'boolean',
        description: 'Filter by reasoning capabilities',
      },
      limit: {
        type: 'number',
        default: 50,
        description: 'Maximum number of results',
      },
    },
    required: [],
  },
};

const GET_MODEL_TOOL: Tool = {
  name: 'get_model',
  description: 'Get detailed information about a specific AI model',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Model ID (e.g., gpt-4, claude-3-sonnet)',
      },
    },
    required: ['id'],
  },
};

const SEARCH_PROVIDERS_TOOL: Tool = {
  name: 'search_providers',
  description: 'Search for AI model providers by name or environment variables',
  inputSchema: {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        description: 'Search query (provider name)',
      },
      env: {
        type: 'string',
        description: 'Filter by required environment variable',
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Maximum number of results',
      },
    },
    required: [],
  },
};

const GET_PROVIDER_TOOL: Tool = {
  name: 'get_provider',
  description: 'Get detailed information about a specific AI model provider',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Provider ID',
      },
    },
    required: ['id'],
  },
};

// Create MCP Server instance (unused - keeping for reference)
function _createMCPServer() {
  const api = new ModelsAPI();

  const server = new Server(
    {
      name: 'modelsplus',
      version: '0.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize handler - required for MCP protocol
  server.setRequestHandler(InitializeRequestSchema, (_request) => {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'modelsplus',
        version: '0.0.1',
      },
    } as InitializeResult;
  });

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return {
      tools: [
        SEARCH_MODELS_TOOL,
        GET_MODEL_TOOL,
        SEARCH_PROVIDERS_TOOL,
        GET_PROVIDER_TOOL,
      ],
    };
  });

  // Tool execution helpers to reduce handler complexity
  async function execSearchModels(args: unknown) {
    if (!isSearchModelsArgs(args)) {
      throw new Error('Invalid arguments for search_models');
    }
    const { q, provider, tool_call, reasoning, limit = 50 } = args;
    const models = await api.searchModels({
      q,
      provider,
      tool_call,
      reasoning,
      limit,
    });
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
  }

  async function execGetModel(args: unknown) {
    if (!isGetModelArgs(args)) {
      throw new Error('Invalid arguments for get_model');
    }
    const { id } = args;
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
  }

  async function execSearchProviders(args: unknown) {
    if (!isSearchProvidersArgs(args)) {
      throw new Error('Invalid arguments for search_providers');
    }
    const { q, env, limit = 20 } = args;
    const providers = await api.searchProviders({ q, env, limit });
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
  }

  async function execGetProvider(args: unknown) {
    if (!isGetProviderArgs(args)) {
      throw new Error('Invalid arguments for get_provider');
    }
    const { id } = args;
    const providers = await api.getProviders();
    const provider = providers.find((p: Provider) => p.id === id);
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
  }

  function execToolByName(name: string, args: unknown) {
    switch (name) {
      case 'search_models':
        return execSearchModels(args);
      case 'get_model':
        return execGetModel(args);
      case 'search_providers':
        return execSearchProviders(args);
      case 'get_provider':
        return execGetProvider(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Call tools handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await execToolByName(name, args);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Helper functions to reduce complexity
function createResponseHeaders(): Headers {
  return new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
}

function createServerCapabilities(): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'modelsplus', version: '0.0.1' },
    },
  };
}

function createToolsList(): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id: null,
    result: {
      tools: [
        {
          name: 'search_models',
          description:
            'Search for AI models by name, provider, or capabilities',
          inputSchema: {
            type: 'object',
            properties: {
              q: {
                type: 'string',
                description: 'Search query (model name, provider, etc.)',
              },
              provider: {
                type: 'string',
                description: 'Filter by provider (e.g., openai, anthropic)',
              },
              tool_call: {
                type: 'boolean',
                description: 'Filter by tool calling support',
              },
              reasoning: {
                type: 'boolean',
                description: 'Filter by reasoning capabilities',
              },
              limit: {
                type: 'number',
                default: 50,
                description: 'Maximum number of results',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_model',
          description: 'Get detailed information about a specific AI model',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Model ID (e.g., gpt-4, claude-3-sonnet)',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'search_providers',
          description:
            'Search for AI model providers by name or environment variables',
          inputSchema: {
            type: 'object',
            properties: {
              q: {
                type: 'string',
                description: 'Search query (provider name)',
              },
              env: {
                type: 'string',
                description: 'Filter by required environment variable',
              },
              limit: {
                type: 'number',
                default: 20,
                description: 'Maximum number of results',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_provider',
          description:
            'Get detailed information about a specific AI model provider',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string', description: 'Provider ID' } },
            required: ['id'],
          },
        },
      ],
    },
  };
}

function handleToolCall(
  name: string,
  args: unknown,
  id: string | number | null
): Promise<JSONRPCResponse> {
  const api = new ModelsAPI();

  switch (name) {
    case 'search_models':
      return handleSearchModels(args, api, id);
    case 'get_model':
      return handleGetModel(args, api, id);
    case 'search_providers':
      return handleSearchProviders(args, api, id);
    case 'get_provider':
      return handleGetProvider(args, api, id);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleSearchModels(
  args: unknown,
  api: ModelsAPI,
  id: string | number | null
): Promise<JSONRPCResponse> {
  if (!isSearchModelsArgs(args)) {
    throw new Error('Invalid arguments for search_models');
  }

  const { q, provider, tool_call, reasoning, limit = 50 } = args;
  const models = await api.searchModels({
    q,
    provider,
    tool_call,
    reasoning,
    limit,
  });

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `Found ${models.length} AI models:\n\n${JSON.stringify(models, null, 2)}`,
        },
      ],
    },
  };
}

async function handleGetModel(
  args: unknown,
  api: ModelsAPI,
  id: string | number | null
): Promise<JSONRPCResponse> {
  if (!isGetModelArgs(args)) {
    throw new Error('Invalid arguments for get_model');
  }

  const { id: modelId } = args;
  const model = await api.getModel(modelId);

  if (!model) {
    throw new Error(`AI model with ID '${modelId}' not found`);
  }

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `AI model details for ${model.id}:\n\n${JSON.stringify(model, null, 2)}`,
        },
      ],
    },
  };
}

async function handleSearchProviders(
  args: unknown,
  api: ModelsAPI,
  id: string | number | null
): Promise<JSONRPCResponse> {
  if (!isSearchProvidersArgs(args)) {
    throw new Error('Invalid arguments for search_providers');
  }

  const { q, env, limit = 20 } = args;
  const providers = await api.searchProviders({ q, env, limit });

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `Found ${providers.length} AI model providers:\n\n${JSON.stringify(providers, null, 2)}`,
        },
      ],
    },
  };
}

async function handleGetProvider(
  args: unknown,
  api: ModelsAPI,
  id: string | number | null
): Promise<JSONRPCResponse> {
  if (!isGetProviderArgs(args)) {
    throw new Error('Invalid arguments for get_provider');
  }

  const { id: providerId } = args;
  const providers = await api.getProviders();
  const provider = providers.find((p: Provider) => p.id === providerId);

  if (!provider) {
    throw new Error(`AI model provider with ID '${providerId}' not found`);
  }

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `AI model provider details for ${provider.id}:\n\n${JSON.stringify(provider, null, 2)}`,
        },
      ],
    },
  };
}

// Type guards
function isSearchModelsArgs(args: unknown): args is {
  q?: string;
  provider?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  limit?: number;
} {
  return typeof args === 'object' && args !== null;
}

function isGetModelArgs(args: unknown): args is { id: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'id' in args &&
    typeof (args as { id: unknown }).id === 'string'
  );
}

function isSearchProvidersArgs(
  args: unknown
): args is { q?: string; env?: string; limit?: number } {
  return typeof args === 'object' && args !== null;
}

function isGetProviderArgs(args: unknown): args is { id: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'id' in args &&
    typeof (args as { id: unknown }).id === 'string'
  );
}

// MCP HTTP Transport Handler
export async function handleMCPStream(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405 });
  }

  const headers = createResponseHeaders();

  try {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(createServerCapabilities()), {
        headers,
      });
    }

    const body = (await request.json()) as JSONRPCRequest;
    let response: JSONRPCResponse;

    if (body.method === 'initialize') {
      response = createServerCapabilities();
      response.id = body.id;
    } else if (body.method === 'tools/list') {
      response = createToolsList();
      response.id = body.id;
    } else if (body.method === 'tools/call') {
      const { name, arguments: args } = body.params as ToolCallParams;
      response = await handleToolCall(name, args, body.id);
    } else {
      response = {
        jsonrpc: '2.0',
        id: body.id || 1,
        error: {
          code: ErrorCode.MethodNotFound,
          message: `Method not found: ${body.method}`,
        },
      };
    }

    return new Response(JSON.stringify(response), { headers });
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: ErrorCode.ParseError,
        message: 'Parse error',
        data: error instanceof Error ? error.message : String(error),
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers,
    });
  }
}

// Alternative MCP handler for POST requests
export async function handleMCPRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const headers = createResponseHeaders();

  try {
    const body = (await request.json()) as JSONRPCRequest;
    let response: JSONRPCResponse;

    if (body.method === 'initialize') {
      response = createServerCapabilities();
      response.id = body.id;
    } else if (body.method === 'tools/list') {
      response = createToolsList();
      response.id = body.id;
    } else if (body.method === 'tools/call') {
      const { name, arguments: args } = body.params as ToolCallParams;
      response = await handleToolCall(name, args, body.id);
    } else {
      response = {
        jsonrpc: '2.0',
        id: body.id || 1,
        error: {
          code: ErrorCode.MethodNotFound,
          message: `Method not found: ${body.method}`,
        },
      };
    }

    return new Response(JSON.stringify(response), { headers });
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32_700,
        message: 'Parse error',
        data: error instanceof Error ? error.message : String(error),
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers,
    });
  }
}

// CORS preflight handler
export function handleMCPOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
