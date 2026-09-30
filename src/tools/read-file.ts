import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { resolveWorkspacePath, toWorkspaceRelativePath } from './workspace-paths.js';
import type { ToolDefinition } from './types.js';

const MAX_FILE_SIZE_BYTES = 512 * 1024;

const readFileInputSchema = z
  .object({
    path: z.string().min(1),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
  })
  .strict();

type ReadFileInput = z.output<typeof readFileInputSchema>;

export function createReadFileTool(): ToolDefinition<ReadFileInput, string> {
  return {
    name: 'read_file',
    description: 'Read a UTF-8 text file inside the workspace, optionally limited to a line range.',
    inputSchema: readFileInputSchema,
    async execute(input, context) {
      if (input.endLine !== undefined && input.startLine !== undefined) {
        if (input.endLine < input.startLine) {
          return {
            status: 'failure',
            error: 'endLine must be greater than or equal to startLine.',
          };
        }
      }

      const filePath = await resolveWorkspacePath(context.workspaceRoot, input.path);
      const fileStats = await stat(filePath);

      if (!fileStats.isFile()) {
        return { status: 'failure', error: 'The requested path is not a file.' };
      }

      if (fileStats.size > MAX_FILE_SIZE_BYTES) {
        return { status: 'failure', error: 'The file exceeds the 512 KiB read limit.' };
      }

      const contents = await readFile(
        filePath,
        context.signal === undefined ? undefined : { signal: context.signal },
      );

      if (contents.includes(0)) {
        return { status: 'failure', error: 'The file appears to be binary, not UTF-8 text.' };
      }

      let text: string;

      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(contents);
      } catch {
        return { status: 'failure', error: 'The file is not valid UTF-8 text.' };
      }

      const lines = text.split(/\r\n|\n|\r/);
      const startLine = input.startLine ?? 1;
      const endLine = Math.min(input.endLine ?? lines.length, lines.length);
      const selectedLines = lines.slice(startLine - 1, endLine);

      if (selectedLines.length === 0) {
        return {
          status: 'success',
          output: `File: ${toWorkspaceRelativePath(context.workspaceRoot, filePath)}\nNo lines in the requested range.`,
        };
      }

      const lineNumberWidth = String(endLine).length;
      const numberedLines = selectedLines.map((line, index) => {
        const lineNumber = startLine + index;
        return `${String(lineNumber).padStart(lineNumberWidth)} | ${line}`;
      });

      return {
        status: 'success',
        output: `File: ${toWorkspaceRelativePath(context.workspaceRoot, filePath)}\n${numberedLines.join('\n')}`,
      };
    },
  };
}
