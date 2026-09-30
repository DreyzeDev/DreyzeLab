import type { SessionInputHandler, SessionInputResult } from './session.js';

export const helpText = [
  'Available commands:',
  '  /help  Show available commands',
  '  /exit  End the session',
].join('\n');

export const handleSessionInput: SessionInputHandler = (input: string): SessionInputResult => {
  const normalizedInput = input.trim();

  if (normalizedInput === '/exit') {
    return { type: 'exit' };
  }

  if (normalizedInput === '/help') {
    return { type: 'continue', output: helpText };
  }

  if (normalizedInput.length === 0) {
    return { type: 'continue' };
  }

  return { type: 'continue', output: `Echo: ${normalizedInput}` };
};
