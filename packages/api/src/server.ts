import { Hono } from 'hono';
import {
  handleMCPOptions,
  handleMCPRequest,
  handleMCPStream,
} from './mcp-http';

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

type QueryOptions = {
  q?: string;
  provider?: string;
  tool_call?: string;
  attachment?: string;
  reasoning?: string;
  temperature?: string;
  open_weights?: string;
  min_input_cost?: string;
  max_input_cost?: string;
  min_output_cost?: string;
  max_output_cost?: string;
  min_context?: string;
  max_context?: string;
  min_output_limit?: string;
  max_output_limit?: string;
  modalities?: string;
  release_after?: string;
  release_before?: string;
  updated_after?: string;
  updated_before?: string;
  sort?: string;
  order?: string;
  limit?: string;
  offset?: string;
  fields?: string;
};

// Import pre-generated JSON data (compatible with both Bun and Node.js)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON data at runtime for compatibility
const modelsData: Model[] = JSON.parse(
  readFileSync(join(__dirname, 'models.json'), 'utf-8')
);
const providersData: Provider[] = JSON.parse(
  readFileSync(join(__dirname, 'providers.json'), 'utf-8')
);

// Helper functions
function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return;
  }
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return;
  }
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? undefined : num;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function filterModels(models: Model[], options: QueryOptions): Model[] {
  const predicates: Array<(model: Model) => boolean> = [];

  // Text search
  const buildTextPredicate = () => {
    if (!options.q) {
      return [] as Array<(m: Model) => boolean>;
    }
    const query = options.q.toLowerCase();
    return [
      (model: Model) =>
        `${model.id} ${model.name ?? ''} ${model.provider}`
          .toLowerCase()
          .includes(query),
    ];
  };

  // Provider filter
  const buildProviderPredicate = () => {
    if (!options.provider) {
      return [] as Array<(m: Model) => boolean>;
    }
    return [(model: Model) => model.provider === options.provider];
  };

  // Boolean filters
  const buildBooleanPredicates = () => {
    const list: Array<(m: Model) => boolean> = [];
    if (options.tool_call !== undefined) {
      const val = parseBoolean(options.tool_call);
      list.push((m) => m.tool_call === val);
    }
    if (options.attachment !== undefined) {
      const val = parseBoolean(options.attachment);
      list.push((m) => m.attachment === val);
    }
    if (options.reasoning !== undefined) {
      const val = parseBoolean(options.reasoning);
      list.push((m) => m.reasoning === val);
    }
    if (options.temperature !== undefined) {
      const val = parseBoolean(options.temperature);
      list.push((m) => m.temperature === val);
    }
    if (options.open_weights !== undefined) {
      const val = parseBoolean(options.open_weights);
      list.push((m) => m.open_weights === val);
    }
    return list;
  };

  // Cost filters
  const buildCostPredicates = () => {
    const list: Array<(m: Model) => boolean> = [];
    if (options.min_input_cost !== undefined) {
      const min = parseNumber(options.min_input_cost);
      list.push(
        (m) =>
          Boolean(min && m.cost?.input) &&
          (m.cost?.input as number) >= (min as number)
      );
    }
    if (options.max_input_cost !== undefined) {
      const max = parseNumber(options.max_input_cost);
      list.push(
        (m) =>
          Boolean(max && m.cost?.input) &&
          (m.cost?.input as number) <= (max as number)
      );
    }
    if (options.min_output_cost !== undefined) {
      const min = parseNumber(options.min_output_cost);
      list.push(
        (m) =>
          Boolean(min && m.cost?.output) &&
          (m.cost?.output as number) >= (min as number)
      );
    }
    if (options.max_output_cost !== undefined) {
      const max = parseNumber(options.max_output_cost);
      list.push(
        (m) =>
          Boolean(max && m.cost?.output) &&
          (m.cost?.output as number) <= (max as number)
      );
    }
    return list;
  };

  // Limit filters
  const buildLimitPredicates = () => {
    const list: Array<(m: Model) => boolean> = [];
    if (options.min_context !== undefined) {
      const min = parseNumber(options.min_context);
      list.push(
        (m) =>
          Boolean(min && m.limit?.context) &&
          (m.limit?.context as number) >= (min as number)
      );
    }
    if (options.max_context !== undefined) {
      const max = parseNumber(options.max_context);
      list.push(
        (m) =>
          Boolean(max && m.limit?.context) &&
          (m.limit?.context as number) <= (max as number)
      );
    }
    if (options.min_output_limit !== undefined) {
      const min = parseNumber(options.min_output_limit);
      list.push(
        (m) =>
          Boolean(min && m.limit?.output) &&
          (m.limit?.output as number) >= (min as number)
      );
    }
    if (options.max_output_limit !== undefined) {
      const max = parseNumber(options.max_output_limit);
      list.push(
        (m) =>
          Boolean(max && m.limit?.output) &&
          (m.limit?.output as number) <= (max as number)
      );
    }
    return list;
  };

  // Date filters
  const buildDatePredicates = () => {
    const list: Array<(m: Model) => boolean> = [];
    if (options.release_after) {
      const after = parseDate(options.release_after);
      list.push(
        (m) =>
          Boolean(after && m.release_date) &&
          new Date(m.release_date as string) >= (after as Date)
      );
    }
    if (options.release_before) {
      const before = parseDate(options.release_before);
      list.push(
        (m) =>
          Boolean(before && m.release_date) &&
          new Date(m.release_date as string) <= (before as Date)
      );
    }
    if (options.updated_after) {
      const after = parseDate(options.updated_after);
      list.push(
        (m) =>
          Boolean(after && m.last_updated) &&
          new Date(m.last_updated as string) >= (after as Date)
      );
    }
    if (options.updated_before) {
      const before = parseDate(options.updated_before);
      list.push(
        (m) =>
          Boolean(before && m.last_updated) &&
          new Date(m.last_updated as string) <= (before as Date)
      );
    }
    return list;
  };

  // Modalities
  const buildModalitiesPredicate = () => {
    if (!options.modalities) {
      return [] as Array<(m: Model) => boolean>;
    }
    const requested = options.modalities
      .split(',')
      .map((m) => m.trim().toLowerCase());
    return [
      (m: Model) => {
        const available = [
          ...(m.modalities?.input || []),
          ...(m.modalities?.output || []),
        ].map((v) => v.toLowerCase());
        return requested.every((mod) => available.includes(mod));
      },
    ];
  };

  predicates.push(
    ...buildTextPredicate(),
    ...buildProviderPredicate(),
    ...buildBooleanPredicates(),
    ...buildCostPredicates(),
    ...buildLimitPredicates(),
    ...buildDatePredicates(),
    ...buildModalitiesPredicate()
  );

  if (!predicates.length) {
    return models;
  }
  return models.filter((m) => predicates.every((p) => p(m)));
}

function sortModels(models: Model[], sortBy = 'name', order = 'asc'): Model[] {
  const getters: Record<string, (m: Model) => string | number> = {
    name: (m) => (m.name || m.id).toLowerCase(),
    provider: (m) => m.provider.toLowerCase(),
    release_date: (m) =>
      m.release_date ? new Date(m.release_date).getTime() : 0,
    last_updated: (m) =>
      m.last_updated ? new Date(m.last_updated).getTime() : 0,
    cost_input: (m) => m.cost?.input || 0,
    cost_output: (m) => m.cost?.output || 0,
    context_limit: (m) => m.limit?.context || 0,
    output_limit: (m) => m.limit?.output || 0,
  };

  const getter = getters[sortBy] ?? getters.name;

  return [...models].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);

    let cmp = 0;
    if (aVal === bVal) {
      cmp = 0;
    } else if (aVal > bVal) {
      cmp = 1;
    } else {
      cmp = -1;
    }
    return order === 'desc' ? -cmp : cmp;
  });
}

function selectFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[]
): Partial<T> {
  if (!fields.length) {
    return obj;
  }
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field as keyof T] = obj[field as keyof T];
    }
  }
  return result;
}

const app = new Hono();

app.get('/v1/admin/reload', (c) => {
  return c.text('ok'); // In Cloudflare Workers, data is static
});

// Health check endpoint for MCP server scanning
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'modelsplus',
    version: '0.0.1',
  });
});

// MCP server info endpoint for discovery
app.get('/.well-known/mcp', (c) => {
  return c.json({
    name: 'modelsplus',
    version: '0.0.1',
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    endpoints: {
      mcp: '/mcp',
      http: '/mcp/http',
    },
  });
});

app.get('/v1/models', (c) => {
  // Parse query parameters
  const options: QueryOptions = {
    q: c.req.query('q'),
    provider: c.req.query('provider'),
    tool_call: c.req.query('tool_call'),
    attachment: c.req.query('attachment'),
    reasoning: c.req.query('reasoning'),
    temperature: c.req.query('temperature'),
    open_weights: c.req.query('open_weights'),
    min_input_cost: c.req.query('min_input_cost'),
    max_input_cost: c.req.query('max_input_cost'),
    min_output_cost: c.req.query('min_output_cost'),
    max_output_cost: c.req.query('max_output_cost'),
    min_context: c.req.query('min_context'),
    max_context: c.req.query('max_context'),
    min_output_limit: c.req.query('min_output_limit'),
    max_output_limit: c.req.query('max_output_limit'),
    modalities: c.req.query('modalities'),
    release_after: c.req.query('release_after'),
    release_before: c.req.query('release_before'),
    updated_after: c.req.query('updated_after'),
    updated_before: c.req.query('updated_before'),
    sort: c.req.query('sort') || 'name',
    order: c.req.query('order') || 'asc',
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    fields: c.req.query('fields'),
  };

  // Filter models
  let filteredModels = filterModels(modelsData, options);

  // Sort models
  filteredModels = sortModels(filteredModels, options.sort, options.order);

  // Apply pagination
  const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined;
  const offset = options.offset ? Number.parseInt(options.offset, 10) : 0;

  if (offset && offset > 0) {
    filteredModels = filteredModels.slice(offset);
  }

  if (limit && limit > 0) {
    filteredModels = filteredModels.slice(0, limit);
  }

  // Apply field selection
  let result: Model[] | Partial<Model>[] = filteredModels;
  if (options.fields) {
    const fields = options.fields.split(',').map((f) => f.trim());
    result = filteredModels.map((model) => selectFields(model, fields));
  }

  return c.json(result);
});

// Count endpoints (must be defined before :id route)
app.get('/v1/models/count', (c) => {
  const options: QueryOptions = {
    q: c.req.query('q'),
    provider: c.req.query('provider'),
    tool_call: c.req.query('tool_call'),
    attachment: c.req.query('attachment'),
    reasoning: c.req.query('reasoning'),
    temperature: c.req.query('temperature'),
    open_weights: c.req.query('open_weights'),
    min_input_cost: c.req.query('min_input_cost'),
    max_input_cost: c.req.query('max_input_cost'),
    min_output_cost: c.req.query('min_output_cost'),
    max_output_cost: c.req.query('max_output_cost'),
    min_context: c.req.query('min_context'),
    max_context: c.req.query('max_context'),
    min_output_limit: c.req.query('min_output_limit'),
    max_output_limit: c.req.query('max_output_limit'),
    modalities: c.req.query('modalities'),
    release_after: c.req.query('release_after'),
    release_before: c.req.query('release_before'),
    updated_after: c.req.query('updated_after'),
    updated_before: c.req.query('updated_before'),
  };

  const count = filterModels(modelsData, options).length;
  return c.json({ count });
});

app.get('/v1/models/:id', (c) => {
  const m = modelsData.find((x: Model) => x.id === c.req.param('id'));
  return m ? c.json(m) : c.notFound();
});

app.get('/v1/providers', (c) => {
  const q = c.req.query('q');
  const env = c.req.query('env');
  const npm = c.req.query('npm');
  const limit = c.req.query('limit');
  const offset = c.req.query('offset');

  let filteredProviders = providersData;

  // Text search in name
  if (q) {
    const query = q.toLowerCase();
    filteredProviders = filteredProviders.filter(
      (p: Provider) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
    );
  }

  // Filter by environment variable
  if (env) {
    filteredProviders = filteredProviders.filter((p: Provider) =>
      p.env.some((e) => e.toLowerCase().includes(env.toLowerCase()))
    );
  }

  // Filter by npm package
  if (npm) {
    filteredProviders = filteredProviders.filter((p: Provider) =>
      p.npm?.toLowerCase().includes(npm.toLowerCase())
    );
  }

  // Apply pagination
  const limitNum = limit ? Number.parseInt(limit, 10) : undefined;
  const offsetNum = offset ? Number.parseInt(offset, 10) : 0;

  if (offsetNum && offsetNum > 0) {
    filteredProviders = filteredProviders.slice(offsetNum);
  }

  if (limitNum && limitNum > 0) {
    filteredProviders = filteredProviders.slice(0, limitNum);
  }

  return c.json(filteredProviders);
});

app.get('/v1/providers/count', (c) => {
  const q = c.req.query('q');
  const env = c.req.query('env');
  const npm = c.req.query('npm');

  let filteredProviders = providersData;

  // Text search in name
  if (q) {
    const query = q.toLowerCase();
    filteredProviders = filteredProviders.filter(
      (p: Provider) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
    );
  }

  // Filter by environment variable
  if (env) {
    filteredProviders = filteredProviders.filter((p: Provider) =>
      p.env.some((e) => e.toLowerCase().includes(env.toLowerCase()))
    );
  }

  // Filter by npm package
  if (npm) {
    filteredProviders = filteredProviders.filter((p: Provider) =>
      p.npm?.toLowerCase().includes(npm.toLowerCase())
    );
  }

  return c.json({ count: filteredProviders.length });
});

// Search suggestions
app.get('/v1/search/suggestions', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  const limit = Number.parseInt(c.req.query('limit') || '10', 10);

  if (!q || q.length < 2) {
    return c.json({ suggestions: [] });
  }

  const suggestions = new Set<string>();

  // Model name suggestions
  for (const model of modelsData) {
    if (model.name?.toLowerCase().includes(q)) {
      suggestions.add(model.name);
    }
    if (model.id.toLowerCase().includes(q)) {
      suggestions.add(model.id);
    }
  }

  // Provider name suggestions
  for (const provider of providersData) {
    if (provider.name.toLowerCase().includes(q)) {
      suggestions.add(provider.name);
    }
  }

  const result = Array.from(suggestions).slice(0, limit);
  return c.json({ suggestions: result });
});

// MCP HTTP endpoint - Regular HTTP for JSON-RPC
app.get('/mcp/http', (c) => {
  return handleMCPRequest(c.req.raw);
});

app.post('/mcp/http', (c) => {
  return handleMCPRequest(c.req.raw);
});

// MCP endpoint - Combined HTTP endpoint for both GET and POST
app.get('/mcp', (c) => {
  return handleMCPStream(c.req.raw);
});

app.post('/mcp', (c) => {
  return handleMCPRequest(c.req.raw);
});

// MCP CORS preflight
app.options('/mcp/http', (_c) => {
  return handleMCPOptions();
});

app.options('/mcp', (_c) => {
  return handleMCPOptions();
});

// For standalone server execution
if (
  import.meta.main ||
  (typeof process !== 'undefined' && process.argv[1]?.endsWith('server.js'))
) {
  const DEFAULT_PORT = 8788;
  const port = process.env.PORT || DEFAULT_PORT;

  // Try Bun first, fallback to Node.js
  if (typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined') {
    (
      globalThis as unknown as { Bun: { serve: (opts: unknown) => void } }
    ).Bun.serve({
      port: Number.parseInt(port.toString(), 10),
      fetch: app.fetch,
    });
  } else {
    // Node.js fallback using built-in HTTP server
    import('node:http').then(({ createServer }) => {
      const server = createServer(async (req, res) => {
        const request = await convertNodeRequestToWebRequest(req, port);
        const response = await app.fetch(request);
        await sendWebResponseToNodeResponse(response, res);
      });

      server.listen(port);
    });
  }
}

// Helper functions to reduce cognitive complexity
async function convertNodeRequestToWebRequest(
  req: import('node:http').IncomingMessage,
  port: number
): Promise<Request> {
  const url = `http://localhost:${port}${req.url}`;
  const method = req.method || 'GET';
  const headers = convertNodeHeadersToWebHeaders(req.headers);

  const body = await getRequestBody(req, method);
  const options: RequestInit = { method, headers };

  if (body) {
    options.body = body;
    options.duplex = 'half';
  }

  return new Request(url, options);
}

function convertNodeHeadersToWebHeaders(
  nodeHeaders: import('node:http').IncomingHttpHeaders
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
}

async function getRequestBody(
  req: import('node:http').IncomingMessage,
  method: string
): Promise<ReadableStream<Uint8Array> | undefined> {
  if (method === 'GET' || method === 'HEAD') {
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

async function sendWebResponseToNodeResponse(
  response: Response,
  res: import('node:http').ServerResponse
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const responseBody = await response.text();
  res.end(responseBody);
}

export default app;
