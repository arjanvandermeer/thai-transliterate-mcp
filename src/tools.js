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
 */
export function registerTools(server) {
  server.tool(
    'transliterate',
    'Transliterate Thai text to the single most likely Roman/Latin spelling',
    {
      thai: z.string().describe('Thai text to transliterate'),
    },
    async ({ thai }) => {
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      return { content: [{ type: 'text', text: transliterate(thai) }] };
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
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(transliterateVariants(thai, { maxVariants }), null, 2) }] };
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
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      const opts = {};
      if (maxDistance !== undefined) opts.maxDistance = maxDistance;
      const result = matchThai(thai, target, opts);
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
      if (!containsThai(thai)) {
        return { content: [{ type: 'text', text: 'Input does not contain Thai text' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(transliterateWords(thai, { maxVariants }), null, 2) }] };
    }
  );
}
