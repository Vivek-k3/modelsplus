<p align="center">
  <picture>
    <source srcset="public/logo.svg" media="(prefers-color-scheme: dark)">
    <img src="public/logo.svg" alt="Models PLUS" width="300">
  </picture>
</p>

<p align="center">
  <strong>Comprehensive AI Model Directory & MCP Server</strong>
</p>

<p align="center">
  Unified REST API and Model Context Protocol (MCP) server for AI model metadata, built on <a href="https://models.dev">models.dev</a> data.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-guide">API Docs</a> •
  <a href="#mcp-integration">MCP</a> •
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <a href="https://modelsplus.quivr.tech">
    <img src="https://img.shields.io/badge/Public%20API-Online-brightgreen" alt="Public API">
  </a>
  <a href="https://github.com/vivek-k3/modelsplus/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  </a>
</p>

## Features

Models PLUS provides a comprehensive AI model catalog with modern tooling:

### **Core Features**
- **Unified REST API** - Advanced search and filtering for 100+ AI models
- **Model Context Protocol (MCP)** - Native MCP support with 4 powerful tools
- **Real-time Data** - Fresh data from [models.dev](https://models.dev) database
- **Lightning Fast** - Built with Bun runtime and SST v3

### **Developer Experience**
- **Zero Config** - Biome + Ultracite for ultra-fast formatting and linting
- **TypeScript** - Full type safety with strict TypeScript configuration
- **Cloudflare Workers** - Global edge deployment with SST

### **Rich Metadata**
- **Comprehensive Model Info** - Pricing, limits, capabilities, modalities
- **Provider Details** - Environment variables, documentation, integrations
- **Advanced Filtering** - Search by cost, context length, features, and more

**Public API**: [https://modelsplus.quivr.tech](https://modelsplus.quivr.tech)

## Quick Start

### **Try the Public API**

```bash
# List latest models
curl "https://modelsplus.quivr.tech/v1/models?limit=5"

# Find reasoning-capable models
curl "https://modelsplus.quivr.tech/v1/models?reasoning=true"

# Get specific model details
curl "https://modelsplus.quivr.tech/v1/models/openai:gpt-4o"
```

### **Local Development**

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Installation

### 📋 **Requirements**
- **Bun** `1.2.21` - Runtime and package manager
- **Node.js types** - For tooling compatibility (bundled via SST)

### **Quick Install**
```bash
# Install dependencies
bun install

# Generate JSON assets from vendor data
cd packages/api && bun run generate && bun run build
```

## **Development**

### **Useful Scripts**
- `bun run build` — Build all workspaces
- `bun run dev` — SST Dev with Cloudflare Worker locally
- `bun run dev:api` — Direct Worker dev for API only
- `bun run deploy` — Deploy via SST to Cloudflare Workers
- `bun run sync:upstream` — Sync vendor subtree

### **Development Setup**
1. Generate JSON assets from vendor TOML files:
   ```bash
   cd packages/api
   bun run generate
   bun run build
   ```

2. Run development servers:
   ```bash
   # SST Dev (recommended)
   bun run dev

   # Direct Worker dev
   cd packages/api && bun run dev
   ```

**Note**: SST config (`sst.config.ts`) auto-builds `@modelsplus/api` and exposes the Worker URL.

## **API Guide**

### Authentication

No authentication required. The API is publicly accessible.

### Base URL

```
https://modelsplus.quivr.tech
```

### Response Format

All API responses return JSON. Error responses include:

```json
{
  "error": "Error message",
  "status": 400
}
```

### Rate Limits

Currently no rate limiting is enforced, but please be respectful.

### Query Parameters

#### Models API (`/v1/models`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query (model name, provider, etc.) | `q=gpt` |
| `provider` | string | Filter by provider | `provider=openai` |
| `tool_call` | boolean | Filter by tool calling support | `tool_call=true` |
| `attachment` | boolean | Filter by attachment support | `attachment=true` |
| `reasoning` | boolean | Filter by reasoning capabilities | `reasoning=true` |
| `temperature` | boolean | Filter by temperature support | `temperature=true` |
| `open_weights` | boolean | Filter by open weights availability | `open_weights=true` |
| `min_input_cost` | number | Minimum input cost filter | `min_input_cost=0.001` |
| `max_input_cost` | number | Maximum input cost filter | `max_input_cost=0.01` |
| `min_output_cost` | number | Minimum output cost filter | `min_output_cost=0.002` |
| `max_output_cost` | number | Maximum output cost filter | `max_output_cost=0.05` |
| `min_context` | number | Minimum context length | `min_context=32000` |
| `max_context` | number | Maximum context length | `max_context=128000` |
| `min_output_limit` | number | Minimum output limit | `min_output_limit=4000` |
| `max_output_limit` | number | Maximum output limit | `max_output_limit=8000` |
| `modalities` | string | Comma-separated modalities | `modalities=image,text` |
| `release_after` | string | Released after date (ISO) | `release_after=2024-01-01` |
| `release_before` | string | Released before date (ISO) | `release_before=2024-12-31` |
| `updated_after` | string | Updated after date (ISO) | `updated_after=2024-06-01` |
| `updated_before` | string | Updated before date (ISO) | `updated_before=2024-12-31` |
| `sort` | string | Sort field | `sort=name` or `sort=cost_input` |
| `order` | string | Sort order | `order=asc` or `order=desc` |
| `limit` | number | Maximum results (default: unlimited) | `limit=10` |
| `offset` | number | Skip number of results | `offset=20` |
| `fields` | string | Comma-separated fields to return | `fields=id,name,provider` |

#### Providers API (`/v1/providers`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query (provider name) | `q=openai` |
| `env` | string | Filter by environment variable | `env=API_KEY` |
| `npm` | string | Filter by npm package | `npm=openai` |
| `limit` | number | Maximum results | `limit=10` |
| `offset` | number | Skip number of results | `offset=5` |

### Model Object Schema

```json
{
  "id": "openai:gpt-4o",
  "provider": "openai",
  "name": "GPT-4o",
  "release_date": "2024-05-13",
  "last_updated": "2024-08-06",
  "attachment": true,
  "reasoning": false,
  "temperature": true,
  "tool_call": true,
  "open_weights": false,
  "knowledge": "2023-10",
  "cost": {
    "input": 0.0025,
    "output": 0.01,
    "cache_read": 0.00125,
    "cache_write": 0.00625
  },
  "limit": {
    "context": 128000,
    "output": 16384
  },
  "modalities": {
    "input": ["text", "image"],
    "output": ["text"]
  }
}
```

### Provider Object Schema

```json
{
  "id": "openai",
  "name": "OpenAI",
  "env": ["OPENAI_API_KEY"],
  "npm": "openai",
  "api": "https://api.openai.com/v1",
  "doc": "https://platform.openai.com/docs"
}
```





### 🔗 **API Endpoints**

**Base URL**: `https://modelsplus.quivr.tech`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health/status check |
| `GET` | `/.well-known/mcp` | MCP discovery |
| `GET` | `/v1/models` | List/search models |
| `GET` | `/v1/models/count` | Count models after filters |
| `GET` | `/v1/models/:id` | Get specific model details |
| `GET` | `/v1/providers` | List/search providers |
| `GET` | `/v1/providers/count` | Count providers after filters |
| `GET/POST` | `/mcp` | MCP over HTTP (JSON-RPC) |
| `GET/POST` | `/mcp/http` | Alternate MCP endpoint |

### **Code Examples**

**JavaScript/TypeScript:**
```typescript
// Search models
const models = await fetch('https://modelsplus.quivr.tech/v1/models?reasoning=true&limit=5')
  .then(res => res.json());

// Get specific model
const model = await fetch('https://modelsplus.quivr.tech/v1/models/openai:gpt-4o')
  .then(res => res.json());
```

**Python:**
```python
import requests

# Find vision-capable models
response = requests.get('https://modelsplus.quivr.tech/v1/models',
                       params={'modalities': 'image', 'limit': 5})
models = response.json()
```


## **MCP Integration**

Models PLUS provides native Model Context Protocol (MCP) support for seamless integration with AI assistants.

### **Available Tools**
- `search_models` - Advanced search and filtering for AI models
- `get_model` - Detailed information about specific models
- `search_providers` - Search and filter AI providers
- `get_provider` - Detailed provider information

### **Quick Setup**

#### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "models-plus": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/sdk", "server", "https://modelsplus.quivr.tech/mcp"]
    }
  }
}
```

#### Cursor
Configure MCP server with URL: `https://modelsplus.quivr.tech/mcp`

#### Other MCP Clients
For any MCP-compatible client, use: `https://modelsplus.quivr.tech/mcp`

### **Usage Examples**
Once integrated, use natural language:
- *"Find all GPT-4 models from OpenAI"*
- *"Show me reasoning-capable models under $1 per million tokens"*
- *"What are the specs for Claude 3 Opus?"*
- *"Which providers support tool calling?"*

### **Direct HTTP API**
```bash
# Discover capabilities
curl "https://modelsplus.quivr.tech/mcp"

# List available tools
curl -s "https://modelsplus.quivr.tech/mcp" \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```


## **Data Source**

Model and provider metadata sourced from [models.dev](https://models.dev) TOML files. The build process (`packages/api/src/generate.ts`) converts these into optimized JSON artifacts for the API and MCP handlers.

## **Deployment**

Deploys via SST to Cloudflare Workers:

```bash
bun run deploy
```

SST config creates a `sst.cloudflare.Worker` with global edge deployment.

## **Contributing**

We welcome contributions! Here's how to get started:

1. **Fork** and create a feature branch
2. **Install** dependencies: `bun install`
3. **Build** and ensure tests pass: `bun run build`
4. **Format** code: `npx ultracite format && npx ultracite lint`
5. **Test** your changes thoroughly
6. **Submit** a pull request with a clear description

## **Acknowledgments**

Built on top of **[models.dev](https://models.dev)** - a comprehensive open-source database of AI model specifications, pricing, and capabilities maintained by the [SST](https://sst.dev) team.

---


