import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findGitRoot, resolveWorkspaceRoot } from './root.js';

const skippedEntryNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'vendor',
]);

const manifestNames = new Set([
  'package.json',
  'pyproject.toml',
  'cargo.toml',
  'go.mod',
  'cmakelists.txt',
]);

export type WorkspaceEntryKind = 'file' | 'directory' | 'symlink' | 'other';

export interface WorkspaceEntry {
  readonly name: string;
  readonly kind: WorkspaceEntryKind;
}

export interface WorkspaceSnapshot {
  readonly workspaceRoot: string;
  readonly gitRoot?: string;
  readonly topLevelEntries: readonly WorkspaceEntry[];
  readonly manifestFiles: readonly string[];
  readonly languageHints: readonly string[];
}

export async function discoverWorkspace(
  startDirectory = process.cwd(),
): Promise<WorkspaceSnapshot> {
  const workspaceRoot = await resolveWorkspaceRoot(resolve(startDirectory));
  const [gitRoot, directoryEntries] = await Promise.all([
    findGitRoot(workspaceRoot),
    readdir(workspaceRoot, { withFileTypes: true }),
  ]);

  const topLevelEntries = directoryEntries
    .filter(({ name }) => !skippedEntryNames.has(name.toLowerCase()))
    .map((entry): WorkspaceEntry => ({
      name: entry.name,
      kind: getEntryKind(entry),
    }))
    .sort((left, right) => compareNames(left.name, right.name));

  const manifestFiles = topLevelEntries
    .filter(({ kind, name }) => kind === 'file' && isManifest(name))
    .map(({ name }) => name);

  const snapshot: WorkspaceSnapshot = {
    workspaceRoot,
    topLevelEntries,
    manifestFiles,
    languageHints: getLanguageHints(manifestFiles),
    ...(gitRoot === undefined ? {} : { gitRoot }),
  };

  return snapshot;
}

function getEntryKind(entry: Dirent): WorkspaceEntryKind {
  if (entry.isFile()) {
    return 'file';
  }
  if (entry.isDirectory()) {
    return 'directory';
  }
  if (entry.isSymbolicLink()) {
    return 'symlink';
  }
  return 'other';
}

function isManifest(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return (
    manifestNames.has(normalizedName) ||
    normalizedName.endsWith('.sln') ||
    normalizedName.endsWith('.csproj')
  );
}

function getLanguageHints(manifestFiles: readonly string[]): string[] {
  const hints = new Set<string>();

  for (const manifest of manifestFiles) {
    switch (manifest.toLowerCase()) {
      case 'package.json':
        hints.add('JavaScript/TypeScript');
        break;
      case 'pyproject.toml':
        hints.add('Python');
        break;
      case 'cargo.toml':
        hints.add('Rust');
        break;
      case 'go.mod':
        hints.add('Go');
        break;
      case 'cmakelists.txt':
        hints.add('C/C++');
        break;
      default:
        if (manifest.toLowerCase().endsWith('.sln') || manifest.toLowerCase().endsWith('.csproj')) {
          hints.add('C#');
        }
    }
  }

  return [...hints].sort(compareNames);
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
