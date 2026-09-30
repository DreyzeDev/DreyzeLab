import { z } from 'zod';
import { ConfigurationError } from '../config/environment.js';
import {
  AuthenticationError,
  ProviderConnectionError,
  ProviderHttpError,
  RateLimitError,
  ProviderResponseError,
} from './errors.js';
import type { ModelProvider, ModelRequest, ModelResponse } from './provider.js';

const completionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                type: z.literal('function').optional(),
                function: z.object({
                  name: z.string().min(1),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
});

export interface OpenAICompatibleProviderOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
}

function createCompletionEndpoint(baseUrl: string): URL {
  let endpoint: URL;

  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new ConfigurationError([
      'DREYZE_BASE_URL must be an HTTP or HTTPS URL without embedded credentials, query parameters, or a fragment.',
    ]);
  }

  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username.length > 0 ||
    endpoint.password.length > 0 ||
    endpoint.search.length > 0 ||
    endpoint.hash.length > 0
  ) {
    throw new ConfigurationError([
      'DREYZE_BASE_URL must be an HTTP or HTTPS URL without embedded credentials, query parameters, or a fragment.',
    ]);
  }

  const basePath = endpoint.pathname.replace(/\/+$/, '');
  endpoint.pathname = `${basePath}/chat/completions`;

  return endpoint;
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id = 'openai-compatible';

  readonly #apiKey: string;
  readonly #endpoint: URL;
  readonly #fetch: typeof fetch;

  constructor(options: OpenAICompatibleProviderOptions, fetchImplementation: typeof fetch = fetch) {
    const apiKey = options.apiKey.trim();

    if (apiKey.length === 0) {
      throw new ConfigurationError(['DREYZE_API_KEY must not be empty.']);
    }

    this.#apiKey = apiKey;
    this.#endpoint = createCompletionEndpoint(options.baseUrl);
    this.#fetch = fetchImplementation;
  }

  async complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
    let response: Response;

    const body = {
      model: request.model,
      messages: request.messages,
      ...(request.tools === undefined || request.tools.length === 0
        ? {}
        : {
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            })),
            tool_choice: 'auto',
          }),
    };

    try {
      response = await this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      throw new ProviderConnectionError(error);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError();
    }

    if (response.status === 429) {
      throw new RateLimitError();
    }

    if (!response.ok) {
      throw new ProviderHttpError(response.status);
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch (error) {
      throw new ProviderResponseError(error);
    }

    const parsed = completionResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ProviderResponseError();
    }

    const choice = parsed.data.choices[0];

    if (choice === undefined) {
      throw new ProviderResponseError();
    }

    const toolCalls = choice.message.tool_calls?.map(({ id, function: tool }) => ({
      id,
      name: tool.name,
      arguments: tool.arguments,
    }));

    if (
      (choice.message.content === undefined || choice.message.content === null) &&
      (toolCalls?.length ?? 0) === 0
    ) {
      throw new ProviderResponseError();
    }

    return {
      text: choice.message.content ?? '',
      ...(toolCalls === undefined || toolCalls.length === 0 ? {} : { toolCalls }),
    };
  }
}
