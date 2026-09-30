export type SessionInputResult = { type: 'continue'; output?: string } | { type: 'exit' };

export type SessionInputHandler = (input: string) => SessionInputResult;

export function echoSessionInput(input: string): SessionInputResult {
  const message = input.trim();

  if (message.length === 0) {
    return { type: 'continue' };
  }

  return { type: 'continue', output: `Echo: ${message}` };
}
