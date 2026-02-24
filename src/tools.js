import { z } from 'zod';
import {
  transliterate,
  transliterateVariants,
  transliterateWords,
  matchThai,
  containsThai,
} from 'thai-transliterate';

/**
 * Register all transliteration tools on an McpServer instance.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ logRequest?: Function, version?: object }} [opts]
 */
export function registerTools(server, opts = {}) {
  const log = opts.logRequest || (() => {});
  const version = opts.version || {};

  server.tool(
    'transliterate',
    'Transliterate Thai text to the single most likely Roman/Latin spelling',
    {
      thai: z.string().describe('Thai text to transliterate'),
    },
    async ({ thai }) => {
      const startMs = Date.now();
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      const text = transliterate(thai);
      log({ source: 'mcp', tool: 'transliterate', input: { thai }, response: { text }, latencyMs: Date.now() - startMs, version });
      return { content: [{ type: 'text', text }] };
    }
  );

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
      const startMs = Date.now();
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      const variants = transliterateVariants(thai, { maxVariants });
      log({ source: 'mcp', tool: 'transliterate_variants', input: { thai, maxVariants }, response: { text: variants[0]?.text, variantCount: variants.length }, latencyMs: Date.now() - startMs, version });
      return { content: [{ type: 'text', text: JSON.stringify(variants, null, 2) }] };
    }
  );

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
      const startMs = Date.now();
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      const opts2 = {};
      if (maxDistance !== undefined) opts2.maxDistance = maxDistance;
      const result = matchThai(thai, target, opts2);
      log({ source: 'mcp', tool: 'match_thai', input: { thai, target, maxDistance }, response: result ? { variant: result.variant, distance: result.distance } : { match: false }, latencyMs: Date.now() - startMs, version });
      if (!result) {
        return { content: [{ type: 'text', text: 'No match found' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

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
      const startMs = Date.now();
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      const words = transliterateWords(thai, { maxVariants });
      log({ source: 'mcp', tool: 'transliterate_words', input: { thai, maxVariants }, response: { wordCount: words.length }, latencyMs: Date.now() - startMs, version });
      return { content: [{ type: 'text', text: JSON.stringify(words, null, 2) }] };
    }
  );
}
