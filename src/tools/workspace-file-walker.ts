import { readdir, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import {
  IGNORED_WORKSPACE_DIRECTORIES,
  isPathInsideWorkspace,
  WorkspacePathError,
} from './workspace-paths.js';

export interface WorkspaceFile {
  readonly absolutePath: string;
  readonly relativePath: string;
}

export interface WalkWorkspaceOptions {
  readonly signal?: AbortSignal;
  readonly startDirectory?: string;
}

export async function* walkWorkspaceFiles(
  workspaceRoot: string,
  options: WalkWorkspaceOptions = {},
): AsyncGenerator<WorkspaceFile> {
  const canonicalRoot = await realpath(workspaceRoot);
  const canonicalStart = await realpath(options.startDirectory ?? canonicalRoot);

  if (!isPathInsideWorkspace(canonicalRoot, canonicalStart)) {
    throw new WorkspacePathError('Workspace paths must stay inside the workspace.');
  }

  const startRelativePath = relative(canonicalRoot, canonicalStart).split(sep).join('/');

  async function* walkDirectory(
    currentDirectory: string,
    relativeDirectory: string,
  ): AsyncGenerator<WorkspaceFile> {
    throwIfAborted(options.signal);
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareNames(left.name, right.name));

    for (const entry of entries) {
      throwIfAborted(options.signal);

      if (entry.isDirectory()) {
        if (IGNORED_WORKSPACE_DIRECTORIES.has(entry.name.toLowerCase())) {
          continue;
        }

        const childRelativeDirectory = joinRelativePath(relativeDirectory, entry.name);
        yield* walkDirectory(resolve(currentDirectory, entry.name), childRelativeDirectory);
        continue;
      }

      if (entry.isFile()) {
        const relativePath = joinRelativePath(relativeDirectory, entry.name);
        yield {
          absolutePath: resolve(currentDirectory, entry.name),
          relativePath,
        };
      }
    }
  }

  yield* walkDirectory(canonicalStart, startRelativePath);
}

function joinRelativePath(directory: string, name: string): string {
  return directory.length === 0 ? name : `${directory}/${name}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    throw error;
  }
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
