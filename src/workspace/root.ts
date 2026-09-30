import { realpath, stat } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';

export async function resolveWorkspaceRoot(startDirectory = process.cwd()): Promise<string> {
  const workspaceRoot = await realpath(startDirectory);
  const rootStats = await stat(workspaceRoot);

  if (!rootStats.isDirectory()) {
    throw new TypeError(`Workspace root is not a directory: ${workspaceRoot}`);
  }

  return workspaceRoot;
}

export async function findGitRoot(startDirectory = process.cwd()): Promise<string | undefined> {
  let currentDirectory = await resolveWorkspaceRoot(startDirectory);
  const filesystemRoot = parse(currentDirectory).root;

  while (true) {
    try {
      await stat(join(currentDirectory, '.git'));
      return currentDirectory;
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }
    }

    if (currentDirectory === filesystemRoot) {
      return undefined;
    }

    currentDirectory = dirname(currentDirectory);
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
