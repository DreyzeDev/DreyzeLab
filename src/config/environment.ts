export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface EnvironmentConfig {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly model?: string;
}

export function loadEnvironmentConfig(
  environment: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  const apiKey = environment.DREYZE_API_KEY;
  const model = environment.DREYZE_MODEL;

  return {
    baseUrl: environment.DREYZE_BASE_URL ?? DEFAULT_BASE_URL,
    ...(apiKey === undefined ? {} : { apiKey }),
    ...(model === undefined ? {} : { model }),
  };
}
