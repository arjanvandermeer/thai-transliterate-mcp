# thai-transliterate-mcp

MCP server and web UI for [thai-transliterate](https://github.com/arjanvandermeer/thai-transliterate-js) — multi-variant Thai-to-Roman transliteration.

## Quick Start

```bash
npm install

# Web UI + REST API on http://localhost:3000
npm run start:http

# MCP server (stdio transport, for Claude / IDE integration)
npm start
```

## Web UI

Open `http://localhost:3000` after starting the HTTP server. Type Thai text and see:

- Best romanization
- Ranked variant list with confidence weights
- Match-against-English with edit distance scoring

## MCP Tools

Four tools are exposed via the [Model Context Protocol](https://modelcontextprotocol.io):

| Tool | Description |
|------|-------------|
| `transliterate` | Thai text to single best romanization |
| `transliterate_variants` | Ranked list of romanization variants |
| `match_thai` | Best match against an English target string |
| `transliterate_words` | Per-word variant arrays |

### Claude Desktop config

```json
{
  "mcpServers": {
    "thai-transliterate": {
      "command": "node",
      "args": ["/path/to/thai-transliterate-mcp/src/index.js"]
    }
  }
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Web UI |
| `POST` | `/api/transliterate` | REST API (`{ thai, target?, maxVariants? }`) |
| `GET` | `/api/version` | Library and server version info |
| `GET` | `/health` | Health check with version + commit |
| `POST` | `/mcp` | MCP protocol (streamable HTTP transport) |

## Deployment

Deploys to AWS ECS Fargate via GitHub Actions on push to `main`. The deploy pipeline auto-updates the `thai-transliterate` library to its latest version.

Request logging goes to DynamoDB (`thai-transliterate-logs` table) in production, or `logs/requests.jsonl` locally.

## License

MIT
