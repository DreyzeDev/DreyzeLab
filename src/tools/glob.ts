import { z } from 'zod';
import { walkWorkspaceFiles } from './workspace-file-walker.js';
import { normalizeWorkspaceRelativePath } from './workspace-paths.js';
import type { ToolDefinition } from './types.js';

const DEFAULT_MAX_RESULTS = 100;
const MAX_ALLOWED_RESULTS = 1000;

const globInputSchema = z
  .object({
    pattern: z.string().min(1).max(512),
    maxResults: z.number().int().min(1).max(MAX_ALLOWED_RESULTS).optional(),
  })
  .strict();

type GlobInput = z.output<typeof globInputSchema>;

export function createGlobTool(): ToolDefinition<GlobInput, string> {
  return {
    name: 'glob',
    description:
      'Find workspace files by a relative glob pattern. Supports *, **, and ?; ignores generated and dependency directories.',
    inputSchema: globInputSchema,
    async execute(input, context) {
      const pattern = normalizeWorkspaceRelativePath(input.pattern);
      const matcher = compileGlob(pattern);
      const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
      const matches: string[] = [];
      let truncated = false;

      for await (const file of walkWorkspaceFiles(context.workspaceRoot, {
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      })) {
        if (!matcher.test(file.relativePath)) {
          continue;
        }

        matches.push(file.relativePath);

        if (matches.length > maxResults) {
          truncated = true;
          break;
        }
      }

      const visibleMatches = matches.slice(0, maxResults);

      if (visibleMatches.length === 0) {
        return {
          status: 'success',
          output: `No files matched pattern ${JSON.stringify(pattern)}.`,
        };
      }

      return {
        status: 'success',
        output: [
          ...visibleMatches,
          ...(truncated ? [`[truncated at ${maxResults} results]`] : []),
        ].join('\n'),
      };
    },
  };
}

function compileGlob(pattern: string): RegExp {
  let expression = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === undefined) {
      continue;
    }

    if (character === '*') {
      const nextCharacter = pattern[index + 1];

      if (nextCharacter === '*') {
        index += 1;

        if (pattern[index + 1] === '/') {
          expression += '(?:.*/)?';
          index += 1;
        } else {
          expression += '.*';
        }
      } else {
        expression += '[^/]*';
      }

      continue;
    }

    if (character === '?') {
      expression += '[^/]';
      continue;
    }

    expression += '.^$+?{}()|[]\\'.includes(character) ? `\\${character}` : character;
  }

  return new RegExp(`${expression}$`);
}
