#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'http';
import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerTools } from './tools.js';
import { logRequest } from './logger.js';
import {
  transliterate,
  transliterateVariants,
  transliterateWords,
  matchThai,
  containsThai,
} from 'thai-transliterate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 3000;

/** Read version info for both libraries (cached after first call) */
let versionInfo;
function getVersionInfo() {
  if (versionInfo) return versionInfo;

  const mcpPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  let libVersion = 'unknown';
  const libPkgPath = path.join(rootDir, 'node_modules', 'thai-transliterate', 'package.json');
  try { libVersion = JSON.parse(fs.readFileSync(libPkgPath, 'utf8')).version; } catch {}

  let libCommit = 'unknown';
  try {
    const lockfile = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
    const resolved = lockfile.packages?.['node_modules/thai-transliterate']?.resolved || '';
    const match = resolved.match(/#([0-9a-f]+)$/);
    if (match) libCommit = match[1].slice(0, 7);
  } catch {}

  let mcpCommit = process.env.GIT_COMMIT_SHORT || 'unknown';
  if (mcpCommit === 'unknown') {
    try { mcpCommit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim(); } catch {}
  }

  versionInfo = {
    mcp: { version: mcpPkg.version, commit: mcpCommit },
    lib: { version: libVersion, commit: libCommit },
  };
  return versionInfo;
}

// Active sessions: sessionId -> { server, transport, createdAt }
const sessions = new Map();

/** Create a new McpServer instance with all tools registered */
function createServer() {
  const vi = getVersionInfo();
  const server = new McpServer({
    name: 'thai-transliterate-mcp',
    version: vi.mcp.version,
  });
  registerTools(server, { logRequest, version: vi });
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
    const vi = getVersionInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'thai-transliterate-mcp',
      version: vi.mcp.version,
      commit: vi.mcp.commit,
      lib: vi.lib,
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

  // Version info
  if (pathname === '/api/version' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getVersionInfo()));
    return;
  }

  // REST API endpoint for the web UI
  if (pathname === '/api/transliterate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const startMs = Date.now();
      try {
        const { thai, target, maxVariants } = JSON.parse(body);
        if (!thai) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "thai" field' }));
          return;
        }
        if (!containsThai(thai)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Input does not contain Thai text' }));
          return;
        }
        const result = {
          text: transliterate(thai),
          variants: transliterateVariants(thai, { maxVariants: maxVariants || 10 }),
          words: transliterateWords(thai, { maxVariants: maxVariants || 10 }),
        };
        if (target) {
          result.match = matchThai(thai, target);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

        logRequest({
          source: 'rest',
          tool: target ? 'transliterate+match' : 'transliterate',
          input: { thai, target, maxVariants },
          response: { text: result.text, variantCount: result.variants.length },
          latencyMs: Date.now() - startMs,
          version: getVersionInfo(),
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve web UI
  if (pathname === '/' && req.method === 'GET') {
    const htmlPath = path.join(__dirname, '..', 'web', 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Web UI not found');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not Found',
    message: `GET / for web UI, POST /mcp for MCP protocol, GET /health for status.`,
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
