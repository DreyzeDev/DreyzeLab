import { realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

export const IGNORED_WORKSPACE_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'vendor',
]);

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspacePathError';
  }
}

export async function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
): Promise<string> {
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath);
  const pathSegments = normalizedPath === '.' ? [] : normalizedPath.split('/');

  const canonicalRoot = await realpath(workspaceRoot);
  const candidatePath = resolve(canonicalRoot, ...pathSegments);

  if (!isPathInsideWorkspace(canonicalRoot, candidatePath)) {
    throw new WorkspacePathError('Workspace paths must stay inside the workspace.');
  }

  const canonicalPath = await realpath(candidatePath);

  if (!isPathInsideWorkspace(canonicalRoot, canonicalPath)) {
    throw new WorkspacePathError('Workspace paths must stay inside the workspace.');
  }

  return canonicalPath;
}

export function normalizeWorkspaceRelativePath(relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new WorkspacePathError('Workspace paths cannot contain a null character.');
  }

  const normalizedPath = relativePath.replaceAll('\\', '/');

  if (
    normalizedPath.startsWith('/') ||
    /^[a-z]:/i.test(normalizedPath) ||
    isUncPath(normalizedPath)
  ) {
    throw new WorkspacePathError('Workspace paths must be relative.');
  }

  const pathSegments = normalizedPath
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (pathSegments.includes('..')) {
    throw new WorkspacePathError('Workspace paths must stay inside the workspace.');
  }

  return pathSegments.length === 0 ? '.' : pathSegments.join('/');
}

export function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  return relative(workspaceRoot, absolutePath).split(sep).join('/') || '.';
}

function isUncPath(path: string): boolean {
  return path.startsWith('//');
}

export function isPathInsideWorkspace(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot.length === 0 ||
    (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolutePath(pathFromRoot))
  );
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith(sep) || /^[a-z]:[\\/]/i.test(path);
}
