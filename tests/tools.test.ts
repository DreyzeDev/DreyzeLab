import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReadOnlyToolRegistry, ToolRegistry } from '../src/tools/index.js';
import type { ToolExecutionContext, ToolResult } from '../src/tools/types.js';
import { z } from 'zod';

const temporaryDirectories: string[] = [];
let workspaceRoot = '';

beforeEach(async () => {
  workspaceRoot = await createTemporaryDirectory();
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function createContext(): ToolExecutionContext {
  return { workspaceRoot };
}

describe('tool registry', () => {
  it('publishes JSON schemas and validates inputs before execution', async () => {
    const registry = new ToolRegistry();
    let receivedValue = '';
    registry.register({
      name: 'echo_value',
      description: 'Return a value for this test.',
      inputSchema: z.object({ value: z.string() }).strict(),
      async execute(input): Promise<ToolResult<string>> {
        receivedValue = input.value;
        return { status: 'success', output: input.value };
      },
    });

    const [definition] = registry.getDefinitions();
    expect(definition).toMatchObject({
      name: 'echo_value',
      description: 'Return a value for this test.',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      },
    });
    await expect(registry.execute('echo_value', { value: 'ok' }, createContext())).resolves.toEqual(
      {
        status: 'success',
        output: 'ok',
      },
    );
    expect(receivedValue).toBe('ok');
    await expect(
      registry.execute('echo_value', { value: 42 }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: expect.stringContaining('Invalid input for echo_value'),
    });
  });

  it('returns structured failures for unknown tools and tool crashes', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'crash_tool',
      description: 'Always crashes for this test.',
      inputSchema: z.object({}).strict(),
      async execute(): Promise<ToolResult<string>> {
        throw new Error('private internal detail');
      },
    });

    await expect(registry.execute('missing_tool', {}, createContext())).resolves.toEqual({
      status: 'failure',
      error: 'Unknown tool: missing_tool.',
    });
    await expect(registry.execute('crash_tool', {}, createContext())).resolves.toEqual({
      status: 'failure',
      error: 'Tool execution failed.',
    });
  });

  it('rejects duplicate tool names', () => {
    const registry = new ToolRegistry();
    const tool = {
      name: 'duplicate_tool',
      description: 'A test tool.',
      inputSchema: z.object({}).strict(),
      async execute(): Promise<ToolResult<string>> {
        return { status: 'success', output: 'ok' };
      },
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow('already registered');
  });

  it('caps tool output to 64 KiB without splitting UTF-8 characters', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'large_output',
      description: 'Return large text to verify output truncation.',
      inputSchema: z.object({}).strict(),
      async execute(): Promise<ToolResult<string>> {
        return { status: 'success', output: '🙂'.repeat(40_000) };
      },
    });

    const result = await registry.execute('large_output', {}, createContext());

    expect(result.status).toBe('success');
    if (result.status !== 'success' || typeof result.output !== 'string') {
      throw new Error('Expected a string tool result.');
    }
    expect(Buffer.byteLength(result.output, 'utf8')).toBeLessThanOrEqual(64 * 1024);
    expect(result.output).toContain('[tool output truncated at 64 KiB]');
  });
});

describe('read-only workspace tools', () => {
  it('reads UTF-8 files with line numbers and an optional range', async () => {
    await mkdir(join(workspaceRoot, 'src'));
    await writeFile(join(workspaceRoot, 'src', 'app.ts'), 'first\nsecond\nthird\n');
    const registry = createReadOnlyToolRegistry();

    await expect(
      registry.execute(
        'read_file',
        { path: 'src/app.ts', startLine: 2, endLine: 3 },
        createContext(),
      ),
    ).resolves.toEqual({
      status: 'success',
      output: 'File: src/app.ts\n2 | second\n3 | third',
    });
  });

  it('rejects binary files, oversized files, and paths outside the workspace', async () => {
    await writeFile(join(workspaceRoot, 'binary.dat'), Buffer.from([0x61, 0x00, 0x62]));
    await writeFile(join(workspaceRoot, 'large.txt'), Buffer.alloc(512 * 1024 + 1, 0x61));
    const registry = createReadOnlyToolRegistry();

    await expect(
      registry.execute('read_file', { path: 'binary.dat' }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: 'The file appears to be binary, not UTF-8 text.',
    });
    await expect(
      registry.execute('read_file', { path: 'large.txt' }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: 'The file exceeds the 512 KiB read limit.',
    });
    await expect(
      registry.execute('read_file', { path: '..\\..\\secret.txt' }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: 'Workspace paths must stay inside the workspace.',
    });
    await expect(
      registry.execute('read_file', { path: 'C:\\private\\secret.txt' }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: 'Workspace paths must be relative.',
    });
  });

  it('does not follow a symlink that escapes the workspace', async ({ skip }) => {
    const outsideDirectory = await createTemporaryDirectory();
    const outsideFile = join(outsideDirectory, 'secret.txt');
    await writeFile(outsideFile, 'outside workspace secret');

    try {
      await symlink(outsideFile, join(workspaceRoot, 'external.txt'), 'file');
    } catch (error) {
      if (isSymlinkUnavailableError(error)) {
        skip();
      }
      throw error;
    }

    const registry = createReadOnlyToolRegistry();
    await expect(
      registry.execute('read_file', { path: 'external.txt' }, createContext()),
    ).resolves.toMatchObject({
      status: 'failure',
      error: 'Workspace paths must stay inside the workspace.',
    });
  });

  it('lists one directory and hides dependency and generated folders', async () => {
    await mkdir(join(workspaceRoot, 'src'));
    await mkdir(join(workspaceRoot, 'node_modules'));
    await mkdir(join(workspaceRoot, 'dist'));
    await mkdir(join(workspaceRoot, 'src', 'nested'));
    await writeFile(join(workspaceRoot, 'README.md'), 'readme');
    const registry = createReadOnlyToolRegistry();

    const result = await registry.execute('list_directory', {}, createContext());
    expect(result).toEqual({
      status: 'success',
      output: 'Directory: .\n[file] README.md\n[dir] src',
    });
  });

  it('finds files with glob patterns while pruning ignored directories', async () => {
    await mkdir(join(workspaceRoot, 'src', 'nested'), { recursive: true });
    await mkdir(join(workspaceRoot, 'node_modules', 'hidden'), { recursive: true });
    await mkdir(join(workspaceRoot, 'dist'), { recursive: true });
    await writeFile(join(workspaceRoot, 'src', 'main.ts'), 'export {};');
    await writeFile(join(workspaceRoot, 'src', 'nested', 'helper.test.ts'), 'export {};');
    await writeFile(join(workspaceRoot, 'node_modules', 'hidden', 'vendor.ts'), 'export {};');
    await writeFile(join(workspaceRoot, 'dist', 'built.ts'), 'export {};');
    const registry = createReadOnlyToolRegistry();

    await expect(
      registry.execute('glob', { pattern: 'src/**/*.ts' }, createContext()),
    ).resolves.toEqual({
      status: 'success',
      output: 'src/main.ts\nsrc/nested/helper.test.ts',
    });
  });

  it('searches literal text with case and result limits', async () => {
    await mkdir(join(workspaceRoot, 'src'));
    await writeFile(join(workspaceRoot, 'src', 'one.ts'), 'Needle\nneedle\nother');
    await writeFile(join(workspaceRoot, 'src', 'two.ts'), 'needle');
    await writeFile(join(workspaceRoot, 'src', 'binary.bin'), Buffer.from([0x6e, 0x00, 0x65]));
    const registry = createReadOnlyToolRegistry();

    await expect(
      registry.execute('grep', { query: 'needle', path: 'src', maxResults: 1 }, createContext()),
    ).resolves.toEqual({
      status: 'success',
      output: 'src/one.ts:1: Needle\n[truncated at 1 results]',
    });

    await expect(
      registry.execute(
        'grep',
        { query: 'Needle', path: 'src', caseSensitive: true },
        createContext(),
      ),
    ).resolves.toEqual({ status: 'success', output: 'src/one.ts:1: Needle' });
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dreyze-tools-'));
  temporaryDirectories.push(directory);
  return directory;
}

function isSymlinkUnavailableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP')
  );
}
