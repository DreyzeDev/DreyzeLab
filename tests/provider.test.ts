import { describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  ProviderConnectionError,
  ProviderHttpError,
  RateLimitError,
  ProviderResponseError,
} from '../src/providers/errors.js';
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.js';
import type { ModelRequest } from '../src/providers/provider.js';

const request: ModelRequest = {
  model: 'test-model',
  messages: [
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'Hello.' },
  ],
};

function createProvider(fetchImplementation: typeof fetch): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    { apiKey: 'test-secret', baseUrl: 'https://gateway.example/v1/' },
    fetchImplementation,
  );
}

describe('OpenAI-compatible provider', () => {
  it('sends chat completions and returns assistant text', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Hello from the model.' } }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const provider = createProvider(fetchImplementation);
    const controller = new AbortController();

    await expect(provider.complete(request, controller.signal)).resolves.toEqual({
      text: 'Hello from the model.',
    });

    const call = fetchImplementation.mock.calls[0];
    expect(call).toBeDefined();

    if (call === undefined) {
      throw new Error('Expected a provider request.');
    }

    const [url, init] = call;
    expect(String(url)).toBe('https://gateway.example/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-secret');
    expect(init?.signal).toBe(controller.signal);
    expect(JSON.parse(String(init?.body))).toEqual({
      model: request.model,
      messages: request.messages,
    });
  });

  it('sends JSON tool schemas and translates provider tool calls', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: { name: 'read_file', arguments: '{"path":"src/app.ts"}' },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const provider = createProvider(fetchImplementation);
    const tool = {
      name: 'read_file',
      description: 'Read a text file.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    };

    await expect(provider.complete({ ...request, tools: [tool] })).resolves.toEqual({
      text: '',
      toolCalls: [{ id: 'call_123', name: 'read_file', arguments: '{"path":"src/app.ts"}' }],
    });

    const call = fetchImplementation.mock.calls[0];
    expect(call).toBeDefined();

    if (call === undefined) {
      throw new Error('Expected a provider request.');
    }

    const [, init] = call;
    expect(JSON.parse(String(init?.body))).toEqual({
      model: request.model,
      messages: request.messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read a text file.',
            parameters: tool.inputSchema,
          },
        },
      ],
      tool_choice: 'auto',
    });
  });

  it('maps authentication and rate-limit responses to typed errors', async () => {
    const unauthorizedProvider = createProvider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('secret response body', { status: 401 })),
    );
    const rateLimitedProvider = createProvider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('secret response body', { status: 429 })),
    );

    await expect(unauthorizedProvider.complete(request)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await expect(rateLimitedProvider.complete(request)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('does not include provider response bodies in HTTP errors', async () => {
    const provider = createProvider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private response detail', { status: 503 })),
    );

    await expect(provider.complete(request)).rejects.toMatchObject({
      name: 'ProviderHttpError',
      statusCode: 503,
      message: 'The model provider returned HTTP 503.',
    } satisfies Partial<ProviderHttpError>);
  });

  it('rejects malformed success responses', async () => {
    const provider = createProvider(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not-json', { status: 200 })),
    );

    await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderResponseError);
  });

  it('rejects empty responses that contain neither text nor tool calls', async () => {
    const provider = createProvider(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(provider.complete(request)).rejects.toBeInstanceOf(ProviderResponseError);
  });

  it('maps network failures without exposing their details', async () => {
    const provider = createProvider(
      vi.fn<typeof fetch>().mockRejectedValue(new Error('test-secret leaked by server')),
    );

    await expect(provider.complete(request)).rejects.toMatchObject({
      name: 'ProviderConnectionError',
      message: 'Could not connect to the model provider.',
    } satisfies Partial<ProviderConnectionError>);
  });
});
