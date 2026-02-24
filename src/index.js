#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  transliterate,
  transliterateVariants,
  transliterateWords,
  matchThai,
} from 'thai-transliterate';

const server = new McpServer({
  name: 'thai-transliterate-mcp',
  version: '0.1.0',
});

// Tool 1: transliterate — single best romanization
server.tool(
  'transliterate',
  'Transliterate Thai text to the single most likely Roman/Latin spelling',
  {
    thai: z.string().describe('Thai text to transliterate'),
  },
  async ({ thai }) => {
    const result = transliterate(thai);
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

// Tool 2: transliterate_variants — ranked list of romanizations
server.tool(
  'transliterate_variants',
  'Transliterate Thai text and return multiple weighted romanization variants sorted by likelihood',
  {
    thai: z.string().describe('Thai text to transliterate'),
    maxVariants: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of variants to return (default: 10)'),
  },
  async ({ thai, maxVariants }) => {
    const variants = transliterateVariants(thai, { maxVariants });
    return {
      content: [{ type: 'text', text: JSON.stringify(variants, null, 2) }],
    };
  }
);

// Tool 3: match_thai — match Thai text against an English target
server.tool(
  'match_thai',
  'Transliterate Thai text and find the best match against an English target string. Returns the closest variant with edit distance and score.',
  {
    thai: z.string().describe('Thai text to transliterate'),
    target: z.string().describe('English/Roman string to match against'),
    maxDistance: z
      .number()
      .optional()
      .describe('Maximum edit distance to accept (default: unlimited)'),
  },
  async ({ thai, target, maxDistance }) => {
    const opts = {};
    if (maxDistance !== undefined) opts.maxDistance = maxDistance;
    const result = matchThai(thai, target, opts);
    if (!result) {
      return {
        content: [{ type: 'text', text: 'No match found' }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: transliterate_words — per-word variant arrays
server.tool(
  'transliterate_words',
  'Transliterate Thai text and return per-word variant arrays, preserving word boundaries',
  {
    thai: z.string().describe('Thai text to transliterate'),
    maxVariants: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum variants per word (default: 10)'),
  },
  async ({ thai, maxVariants }) => {
    const words = transliterateWords(thai, { maxVariants });
    return {
      content: [{ type: 'text', text: JSON.stringify(words, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
