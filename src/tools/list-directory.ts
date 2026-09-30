import { readdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import {
  IGNORED_WORKSPACE_DIRECTORIES,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
} from './workspace-paths.js';
import type { ToolDefinition } from './types.js';

const MAX_DIRECTORY_ENTRIES = 500;

const listDirectoryInputSchema = z
  .object({
    path: z.string().optional(),
  })
  .strict();

type ListDirectoryInput = z.output<typeof listDirectoryInputSchema>;

export function createListDirectoryTool(): ToolDefinition<ListDirectoryInput, string> {
  return {
    name: 'list_directory',
    description: 'List one workspace directory without traversing child directories.',
    inputSchema: listDirectoryInputSchema,
    async execute(input, context) {
      const directoryPath = await resolveWorkspacePath(context.workspaceRoot, input.path ?? '.');
      const directoryStats = await stat(directoryPath);

      if (!directoryStats.isDirectory()) {
        return { status: 'failure', error: 'The requested path is not a directory.' };
      }

      const entries = await readdir(directoryPath, { withFileTypes: true });
      const visibleEntries = entries
        .filter(({ name }) => !IGNORED_WORKSPACE_DIRECTORIES.has(name.toLowerCase()))
        .sort((left, right) => compareNames(left.name, right.name));
      const truncated = visibleEntries.length > MAX_DIRECTORY_ENTRIES;
      const lines = visibleEntries.slice(0, MAX_DIRECTORY_ENTRIES).map((entry) => {
        const kind = entry.isDirectory() ? 'dir' : entry.isSymbolicLink() ? 'link' : 'file';
        return `[${kind}] ${entry.name}`;
      });
      const displayPath = toWorkspaceRelativePath(context.workspaceRoot, directoryPath);

      if (truncated) {
        lines.push(
          `[truncated: showing ${MAX_DIRECTORY_ENTRIES} of ${visibleEntries.length} entries]`,
        );
      }

      return {
        status: 'success',
        output: [`Directory: ${displayPath}`, ...lines].join('\n'),
      };
    },
  };
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
