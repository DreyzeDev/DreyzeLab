import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverWorkspace } from '../src/workspace/discovery.js';
import { findGitRoot, resolveWorkspaceRoot } from '../src/workspace/root.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('workspace root discovery', () => {
  it('resolves the workspace root to an absolute canonical path', async () => {
    const root = await createTemporaryDirectory();

    await expect(resolveWorkspaceRoot(root)).resolves.toBe(resolve(root));
  });

  it('finds the nearest Git root when .git is a worktree marker file', async () => {
    const root = await createTemporaryDirectory();
    const nestedDirectory = join(root, 'packages', 'app');
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(join(root, '.git'), 'gitdir: ../.git/worktrees/app');

    await expect(findGitRoot(nestedDirectory)).resolves.toBe(root);
  });

  it('returns no Git root for a directory outside a repository', async () => {
    const root = await createTemporaryDirectory();

    await expect(findGitRoot(root)).resolves.toBeUndefined();
  });
});

describe('workspace snapshot', () => {
  it('collects only lightweight top-level metadata and known manifests', async () => {
    const root = await createTemporaryDirectory();
    await mkdir(join(root, '.git'));
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'node_modules'));
    await mkdir(join(root, 'dist'));
    await mkdir(join(root, 'build'));
    await mkdir(join(root, 'coverage'));
    await mkdir(join(root, '.next'));
    await mkdir(join(root, 'vendor'));
    await mkdir(join(root, 'nested'));

    await writeFile(join(root, 'package.json'), '{ invalid json');
    await writeFile(join(root, 'pyproject.toml'), 'not parsed');
    await writeFile(join(root, 'Cargo.toml'), 'not parsed');
    await writeFile(join(root, 'go.mod'), 'not parsed');
    await writeFile(join(root, 'CMakeLists.txt'), 'not parsed');
    await writeFile(join(root, 'Solution.sln'), 'not parsed');
    await writeFile(join(root, 'Sample.csproj'), 'not parsed');
    await writeFile(join(root, 'nested', 'nested.csproj'), 'not parsed');

    const snapshot = await discoverWorkspace(root);

    expect(snapshot.workspaceRoot).toBe(root);
    expect(snapshot.gitRoot).toBe(root);
    expect(snapshot.topLevelEntries.map(({ name }) => name)).toEqual([
      'CMakeLists.txt',
      'Cargo.toml',
      'Sample.csproj',
      'Solution.sln',
      'go.mod',
      'nested',
      'package.json',
      'pyproject.toml',
      'src',
    ]);
    expect(snapshot.topLevelEntries.find(({ name }) => name === 'src')?.kind).toBe('directory');
    expect(snapshot.manifestFiles).toEqual([
      'CMakeLists.txt',
      'Cargo.toml',
      'Sample.csproj',
      'Solution.sln',
      'go.mod',
      'package.json',
      'pyproject.toml',
    ]);
    expect(snapshot.languageHints).toEqual([
      'C#',
      'C/C++',
      'Go',
      'JavaScript/TypeScript',
      'Python',
      'Rust',
    ]);
  });

  it('omits the optional Git root when the workspace is not in a repository', async () => {
    const root = await createTemporaryDirectory();
    const snapshot = await discoverWorkspace(root);

    expect(snapshot).not.toHaveProperty('gitRoot');
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dreyze-workspace-'));
  temporaryDirectories.push(directory);
  return directory;
}
