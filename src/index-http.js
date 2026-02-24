#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'http';
import crypto from 'crypto';
import { registerTools } from './tools.js';

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 3000;

// Active sessions: sessionId -> { server, transport, createdAt }
const sessions = new Map();

/** Create a new McpServer instance with all tools registered */
function createServer() {
  const server = new McpServer({
    name: 'thai-transliterate-mcp',
    version: '0.1.0',
  });
  registerTools(server);
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, MCP-Protocol-Version');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'thai-transliterate-mcp',
      version: '0.1.0',
      transport: 'streamable-http',
      activeSessions: sessions.size,
    }));
    return;
  }

  // MCP endpoint
  if (pathname === '/mcp') {
    try {
      const sessionId = req.headers['mcp-session-id'];

      if (sessionId && sessions.has(sessionId)) {
        // Existing session
        const session = sessions.get(sessionId);
        await session.transport.handleRequest(req, res);
      } else {
        // New session
        const newSessionId = crypto.randomUUID();
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });

        await server.connect(transport);
        sessions.set(newSessionId, { server, transport, createdAt: Date.now() });
        console.error(`New session: ${newSessionId} (total: ${sessions.size})`);

        await transport.handleRequest(req, res);
      }
    } catch (err) {
      console.error('MCP request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not Found',
    message: `POST to /mcp for MCP protocol, GET /health for status.`,
  }));
});

// Clean up stale sessions every 5 minutes
setInterval(() => {
  const maxAge = 30 * 60 * 1000;
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(id);
      console.error(`Session expired: ${id} (remaining: ${sessions.size})`);
    }
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.error(`Thai Transliterate MCP Server (HTTP) running on port ${PORT}`);
  console.error(`MCP endpoint: /mcp`);
  console.error(`Health check: /health`);
});

process.on('SIGTERM', () => {
  console.error('SIGTERM received, shutting down...');
  process.exit(0);
});
