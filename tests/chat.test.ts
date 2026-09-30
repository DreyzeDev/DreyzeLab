import { describe, expect, it } from 'vitest';
import { createModelInputHandler, startModelInteractiveSession } from '../src/cli/chat.js';
import { helpText } from '../src/cli/commands.js';
import { ConfigurationError } from '../src/config/environment.js';
import { AuthenticationError } from '../src/providers/errors.js';
import type { ModelMessage, ModelProvider, ModelRequest } from '../src/providers/provider.js';

describe('model-backed CLI session', () => {
  it('keeps conversation history between requests and skips built-in commands', async () => {
    const requests: ModelRequest[] = [];
    const provider: ModelProvider = {
      id: 'mock',
      async complete(request) {
        requests.push(request);
        return { text: `Reply ${requests.length}` };
      },
    };
    const handleInput = createModelInputHandler(provider, 'test-model');

    await expect(handleInput('/help')).resolves.toEqual({ type: 'continue', output: helpText });
    await expect(handleInput('   ')).resolves.toEqual({ type: 'continue' });
    await expect(handleInput('Hello')).resolves.toEqual({ type: 'continue', output: 'Reply 1' });
    await expect(handleInput('Follow up')).resolves.toEqual({
      type: 'continue',
      output: 'Reply 2',
    });
    await expect(handleInput('/exit')).resolves.toEqual({ type: 'exit' });

    expect(requests).toEqual([
      { model: 'test-model', messages: [{ role: 'user', content: 'Hello' }] },
      {
        model: 'test-model',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Reply 1' },
          { role: 'user', content: 'Follow up' },
        ] satisfies ModelMessage[],
      },
    ]);
  });

  it('turns authentication failures into a friendly prompt', async () => {
    const provider: ModelProvider = {
      id: 'mock',
      async complete() {
        throw new AuthenticationError();
      },
    };
    const handleInput = createModelInputHandler(provider, 'test-model');

    await expect(handleInput('Hello')).resolves.toEqual({
      type: 'continue',
      output: '✖ Provider authentication failed.\n  Check DREYZE_API_KEY.',
    });
  });

  it('requires an API key and model before starting the provider session', async () => {
    await expect(startModelInteractiveSession({})).rejects.toBeInstanceOf(ConfigurationError);
    await expect(startModelInteractiveSession({})).rejects.toThrow('DREYZE_API_KEY is required');
    await expect(startModelInteractiveSession({})).rejects.toThrow('DREYZE_MODEL is required');
  });
});
