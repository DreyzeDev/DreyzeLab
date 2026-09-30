import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { walkWorkspaceFiles } from './workspace-file-walker.js';
import { resolveWorkspacePath, toWorkspaceRelativePath } from './workspace-paths.js';
import type { ToolDefinition } from './types.js';

const MAX_SEARCH_FILE_BYTES = 1024 * 1024;
const DEFAULT_MAX_RESULTS = 100;
const MAX_ALLOWED_RESULTS = 1000;
const MAX_MATCH_LINE_LENGTH = 500;

const grepInputSchema = z
  .object({
    query: z.string().min(1),
    path: z.string().optional(),
    caseSensitive: z.boolean().optional(),
    maxResults: z.number().int().min(1).max(MAX_ALLOWED_RESULTS).optional(),
  })
  .strict();

type GrepInput = z.output<typeof grepInputSchema>;

interface FileMatch {
  readonly filePath: string;
  readonly line: number;
  readonly content: string;
}

export function createGrepTool(): ToolDefinition<GrepInput, string> {
  return {
    name: 'grep',
    description:
      'Search workspace text files for a literal query. Results are capped and large or binary files are skipped.',
    inputSchema: grepInputSchema,
    async execute(input, context) {
      const requestedPath = input.path ?? '.';
      const searchPath = await resolveWorkspacePath(context.workspaceRoot, requestedPath);
      const searchStats = await stat(searchPath);

      if (!searchStats.isDirectory() && !searchStats.isFile()) {
        return { status: 'failure', error: 'The requested path is not a file or directory.' };
      }

      const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
      const query = input.caseSensitive === true ? input.query : input.query.toLowerCase();
      const matches: FileMatch[] = [];
      let truncated = false;

      if (searchStats.isFile()) {
        await searchFile(
          {
            absolutePath: searchPath,
            relativePath: toWorkspaceRelativePath(context.workspaceRoot, searchPath),
          },
          query,
          input.caseSensitive === true,
          maxResults,
          matches,
          context.signal,
        );
        truncated = matches.length > maxResults;
      } else {
        for await (const file of walkWorkspaceFiles(context.workspaceRoot, {
          ...(context.signal === undefined ? {} : { signal: context.signal }),
          startDirectory: searchPath,
        })) {
          await searchFile(
            file,
            query,
            input.caseSensitive === true,
            maxResults,
            matches,
            context.signal,
          );

          if (matches.length > maxResults) {
            truncated = true;
            break;
          }
        }
      }

      const visibleMatches = matches.slice(0, maxResults);

      if (visibleMatches.length === 0) {
        return {
          status: 'success',
          output: `No matches for ${JSON.stringify(input.query)} under ${JSON.stringify(requestedPath)}.`,
        };
      }

      const lines = visibleMatches.map(
        ({ filePath, line, content }) => `${filePath}:${line}: ${content}`,
      );

      if (truncated) {
        lines.push(`[truncated at ${maxResults} results]`);
      }

      return { status: 'success', output: lines.join('\n') };
    },
  };
}

async function searchFile(
  file: { readonly absolutePath: string; readonly relativePath: string },
  query: string,
  caseSensitive: boolean,
  maxResults: number,
  matches: FileMatch[],
  signal?: AbortSignal,
): Promise<void> {
  if (matches.length > maxResults) {
    return;
  }

  const fileStats = await stat(file.absolutePath);

  if (!fileStats.isFile() || fileStats.size > MAX_SEARCH_FILE_BYTES) {
    return;
  }

  const contents = await readFile(file.absolutePath, signal === undefined ? undefined : { signal });

  if (contents.includes(0)) {
    return;
  }

  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(contents);
  } catch {
    return;
  }

  const lines = text.split(/\r\n|\n|\r/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line === undefined) {
      continue;
    }

    const searchableLine = caseSensitive ? line : line.toLowerCase();

    if (!searchableLine.includes(query)) {
      continue;
    }

    matches.push({
      filePath: file.relativePath,
      line: index + 1,
      content:
        line.length > MAX_MATCH_LINE_LENGTH ? `${line.slice(0, MAX_MATCH_LINE_LENGTH)}…` : line,
    });

    if (matches.length > maxResults) {
      return;
    }
  }
}
