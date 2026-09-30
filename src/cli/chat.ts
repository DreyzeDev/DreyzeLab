import { ConfigurationError, loadEnvironmentConfig } from '../config/environment.js';
import {
  AuthenticationError,
  ProviderConnectionError,
  ProviderError,
  ProviderHttpError,
  RateLimitError,
  ProviderResponseError,
} from '../providers/errors.js';
import { OpenAICompatibleProvider } from '../providers/openai-compatible.js';
import type { ModelMessage, ModelProvider } from '../providers/provider.js';
import { handleBuiltInCommand } from './commands.js';
import { runInteractiveSession } from './interactive.js';
import type { SessionInputHandler, SessionInputResult } from './session.js';

export function createModelInputHandler(
  provider: ModelProvider,
  model: string,
): SessionInputHandler {
  const history: ModelMessage[] = [];

  return async (input: string): Promise<SessionInputResult> => {
    const commandResult = handleBuiltInCommand(input);

    if (commandResult !== undefined) {
      return commandResult;
    }

    const userMessage: ModelMessage = { role: 'user', content: input };

    try {
      const response = await provider.complete({
        model,
        messages: [...history, userMessage],
      });
      history.push(userMessage, { role: 'assistant', content: response.text });

      return { type: 'continue', output: response.text };
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        throw error;
      }

      return { type: 'continue', output: formatProviderError(error) };
    }
  };
}

function formatProviderError(error: ProviderError): string {
  if (error instanceof AuthenticationError) {
    return '✖ Provider authentication failed.\n  Check DREYZE_API_KEY.';
  }

  if (error instanceof RateLimitError) {
    return '✖ Provider rate limit reached.\n  Try again later.';
  }

  if (error instanceof ProviderConnectionError) {
    return '✖ Could not reach the model provider.\n  Check DREYZE_BASE_URL and your network connection.';
  }

  if (error instanceof ProviderResponseError) {
    return '✖ The model provider returned an invalid response.';
  }

  if (error instanceof ProviderHttpError) {
    return `✖ Provider request failed with HTTP ${error.statusCode}.`;
  }

  return '✖ The model provider request failed.';
}

function requireProviderSettings(config: ReturnType<typeof loadEnvironmentConfig>): {
  apiKey: string;
  model: string;
} {
  const apiKey = config.apiKey;
  const model = config.model;
  const issues = [
    ...(apiKey === undefined || apiKey.length === 0
      ? ['DREYZE_API_KEY is required to use the OpenAI-compatible provider.']
      : []),
    ...(model === undefined || model.length === 0
      ? ['DREYZE_MODEL is required to use the OpenAI-compatible provider.']
      : []),
  ];

  if (apiKey === undefined || apiKey.length === 0 || model === undefined || model.length === 0) {
    throw new ConfigurationError(issues);
  }

  return { apiKey, model };
}

export async function startModelInteractiveSession(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = loadEnvironmentConfig(environment);
  const providerSettings = requireProviderSettings(config);
  const provider = new OpenAICompatibleProvider({
    apiKey: providerSettings.apiKey,
    baseUrl: config.baseUrl,
  });

  await runInteractiveSession({
    handleInput: createModelInputHandler(provider, providerSettings.model),
  });
}
