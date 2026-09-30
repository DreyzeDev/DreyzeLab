import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { echoSessionInput, type SessionInputHandler } from './session.js';

export interface InteractiveLineReader extends AsyncIterable<string> {
  on(event: 'SIGINT', listener: () => void): void;
  close(): void;
}

export type InteractiveLineReaderFactory = (
  input: Readable,
  output: Writable,
) => InteractiveLineReader;

export interface InteractiveSessionOptions {
  input?: Readable;
  output?: Writable;
  createLineReader?: InteractiveLineReaderFactory;
  handleInput?: SessionInputHandler;
}

function createDefaultLineReader(input: Readable, output: Writable): InteractiveLineReader {
  return createInterface({
    input,
    output,
    terminal:
      'isTTY' in input && input.isTTY === true && 'isTTY' in output && output.isTTY === true,
  });
}

export async function runInteractiveSession(
  options: InteractiveSessionOptions = {},
): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const createLineReader = options.createLineReader ?? createDefaultLineReader;
  const handleInput = options.handleInput ?? echoSessionInput;
  const lineReader = createLineReader(input, output);

  output.write('DreyzeLab\n');
  output.write('> ');

  lineReader.on('SIGINT', () => {
    output.write('\n');
    lineReader.close();
  });

  try {
    for await (const line of lineReader) {
      const inputResult = handleInput(line);

      if (inputResult.type === 'exit') {
        output.write('Goodbye.\n');
        break;
      }

      if (inputResult.output !== undefined) {
        output.write(`${inputResult.output}\n`);
      }

      output.write('> ');
    }
  } finally {
    lineReader.close();
  }
}
