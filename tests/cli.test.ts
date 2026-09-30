import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/index.js';

async function runOption(option: string): Promise<string> {
  let output = '';
  const program = createProgram().exitOverride();

  program.configureOutput({
    writeOut: (text) => {
      output += text;
    },
    writeErr: () => undefined,
  });

  await expect(
    program.parseAsync(['node', 'dreyze', option], { from: 'node' }),
  ).rejects.toMatchObject({
    exitCode: 0,
  });

  return output;
}

describe('DreyzeLab CLI foundation', () => {
  it('prints its version', async () => {
    await expect(runOption('--version')).resolves.toBe('0.0.1\n');
  });

  it('prints help with the available built-in options', async () => {
    const output = await runOption('--help');

    expect(output).toContain('Usage: dreyze [options]');
    expect(output).toContain('-V, --version');
    expect(output).toContain('-h, --help');
  });
});
