#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerTools } from './tools.js';
import { logRequest } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const server = new McpServer({
  name: 'thai-transliterate-mcp',
  version: pkg.version,
});

const version = { mcp: { version: pkg.version, commit: process.env.GIT_COMMIT_SHORT || 'unknown' } };
registerTools(server, { logRequest, version });

const transport = new StdioServerTransport();
await server.connect(transport);
