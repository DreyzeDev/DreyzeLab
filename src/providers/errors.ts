export class ProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor() {
    super('Provider authentication failed.');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProviderError {
  constructor() {
    super('Provider rate limit reached.');
    this.name = 'RateLimitError';
  }
}

export class ProviderConnectionError extends ProviderError {
  constructor(cause?: unknown) {
    super('Could not connect to the model provider.', cause === undefined ? undefined : { cause });
    this.name = 'ProviderConnectionError';
  }
}

export class ProviderResponseError extends ProviderError {
  constructor(cause?: unknown) {
    super(
      'The model provider returned an invalid response.',
      cause === undefined ? undefined : { cause },
    );
    this.name = 'ProviderResponseError';
  }
}

export class ProviderHttpError extends ProviderError {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super(`The model provider returned HTTP ${statusCode}.`);
    this.name = 'ProviderHttpError';
    this.statusCode = statusCode;
  }
}
