import { z } from 'zod';

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const httpBaseUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }))
  .refine((value) => {
    const url = new URL(value);
    return (
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  });

const environmentSchema = z.object({
  DREYZE_API_KEY: z.string().trim().min(1).optional(),
  DREYZE_BASE_URL: httpBaseUrlSchema.optional().default(DEFAULT_BASE_URL),
  DREYZE_MODEL: z.string().trim().min(1).optional(),
});

export class ConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

export interface EnvironmentConfig {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly model?: string;
}

export function loadEnvironmentConfig(
  environment: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  const parsed = environmentSchema.safeParse({
    DREYZE_API_KEY: environment.DREYZE_API_KEY,
    DREYZE_BASE_URL: environment.DREYZE_BASE_URL,
    DREYZE_MODEL: environment.DREYZE_MODEL,
  });

  if (!parsed.success) {
    const issues = new Set(
      parsed.error.issues.map(({ path }) => {
        switch (path[0]) {
          case 'DREYZE_API_KEY':
            return 'DREYZE_API_KEY must not be empty.';
          case 'DREYZE_BASE_URL':
            return 'DREYZE_BASE_URL must be an HTTP or HTTPS URL without embedded credentials, query parameters, or a fragment.';
          case 'DREYZE_MODEL':
            return 'DREYZE_MODEL must not be empty.';
          default:
            return 'Provider environment configuration is invalid.';
        }
      }),
    );

    throw new ConfigurationError([...issues]);
  }

  const { DREYZE_API_KEY: apiKey, DREYZE_BASE_URL: baseUrl, DREYZE_MODEL: model } = parsed.data;
  return {
    baseUrl,
    ...(apiKey === undefined ? {} : { apiKey }),
    ...(model === undefined ? {} : { model }),
  };
}
