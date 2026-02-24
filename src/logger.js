import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { appendFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'crypto';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'thai-transliterate-logs';
const TTL_DAYS = 90;

// Try DynamoDB first; fall back to local file logging
let docClient = null;
try {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
  docClient = DynamoDBDocumentClient.from(client);
} catch {
  // No AWS credentials — will use file fallback
}

// Local file log path: <project-root>/logs/requests.jsonl
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'requests.jsonl');
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

/** Build the log item from an entry */
function buildItem(entry) {
  const now = new Date();
  const id = crypto.randomUUID().slice(0, 8);
  const iso = now.toISOString();

  return {
    date: iso.slice(0, 10),
    sk: `${iso}#${id}`,
    source: entry.source,
    tool: entry.tool,
    input: entry.input,
    response: entry.response,
    latencyMs: entry.latencyMs,
    version: entry.version,
    ttl: Math.floor(now.getTime() / 1000) + TTL_DAYS * 86400,
  };
}

/**
 * Log a transliteration request. Fire-and-forget — never throws.
 *
 * In production (AWS creds available): writes to DynamoDB.
 * In dev (no creds): appends JSON line to logs/requests.jsonl.
 *
 * @param {{ source: string, tool: string, input: object, response: object, latencyMs: number, version: object }} entry
 */
export function logRequest(entry) {
  const item = buildItem(entry);

  if (docClient) {
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }))
      .catch(err => {
        console.error('DynamoDB log error:', err.message);
        // Fall back to file on DynamoDB failure
        appendFile(LOG_FILE, JSON.stringify(item) + '\n').catch(() => {});
      });
  } else {
    appendFile(LOG_FILE, JSON.stringify(item) + '\n')
      .catch(err => console.error('File log error:', err.message));
  }
}
