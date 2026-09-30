import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/index.js';
import { createModelInputHandler } from '../src/cli/chat.js';
import { handleSessionInput, helpText } from '../src/cli/commands.js';
import { type InteractiveLineReader, runInteractiveSession } from '../src/cli/interactive.js';
import type { ModelProvider } from '../src/providers/provider.js';

function createOutputCapture(): { output: Writable; text: () => string } {
  let captured = '';
  const output = new Writable({
    write(chunk, _encoding, callback) {
      captured += chunk.toString();
      callback();
    },
  });

  return { output, text: () => captured };
}

class CtrlCLineReader implements InteractiveLineReader {
  #closed = false;
  #sigintListener: (() => void) | undefined;

  on(event: 'SIGINT', listener: () => void): void {
    if (event === 'SIGINT') {
      this.#sigintListener = listener;
    }
  }

  close(): void {
    this.#closed = true;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    yield 'before interrupt';
    this.#sigintListener?.();

    if (!this.#closed) {
      yield 'after interrupt';
    }
  }
}

describe('interactive CLI session', () => {
  it('echoes input, shows help, and exits on /exit', async () => {
    const capture = createOutputCapture();

    await runInteractiveSession({
      input: Readable.from(['/help\nhello\n/exit\nignored\n']),
      output: capture.output,
      handleInput: handleSessionInput,
    });

    expect(capture.text()).toBe(`DreyzeLab\n> ${helpText}\n> Echo: hello\n> Goodbye.\n`);
  });

  it('closes the session when Ctrl+C is received', async () => {
    const capture = createOutputCapture();

    await runInteractiveSession({
      input: Readable.from([]),
      output: capture.output,
      createLineReader: () => new CtrlCLineReader(),
    });

    expect(capture.text()).toBe('DreyzeLab\n> Echo: before interrupt\n> \n');
    expect(capture.text()).not.toContain('after interrupt');
  });

  it('starts an interactive session when invoked without options', async () => {
    let started = false;
    const program = createProgram(async () => {
      started = true;
    });

    await program.parseAsync(['node', 'dreyze'], { from: 'node' });

    expect(started).toBe(true);
  });

  it('waits for a model-backed response before prompting again', async () => {
    const capture = createOutputCapture();
    const provider: ModelProvider = {
      id: 'mock',
      async complete() {
        return { text: 'Model response.' };
      },
    };

    await runInteractiveSession({
      input: Readable.from(['hello\n/exit\n']),
      output: capture.output,
      handleInput: createModelInputHandler(provider, 'test-model'),
    });

    expect(capture.text()).toBe('DreyzeLab\n> Model response.\n> Goodbye.\n');
  });
});
