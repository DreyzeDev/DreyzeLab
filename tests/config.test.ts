import { describe, expect, it } from 'vitest';
import {
  ConfigurationError,
  DEFAULT_BASE_URL,
  loadEnvironmentConfig,
} from '../src/config/environment.js';

describe('environment configuration', () => {
  it('uses defaults when no provider environment variables are set', () => {
    expect(loadEnvironmentConfig({})).toEqual({ baseUrl: DEFAULT_BASE_URL });
  });

  it('accepts local HTTP endpoints for compatible gateways', () => {
    expect(loadEnvironmentConfig({ DREYZE_BASE_URL: 'http://localhost:11434/v1' })).toEqual({
      baseUrl: 'http://localhost:11434/v1',
    });
  });

  it('uses configured values instead of defaults and trims surrounding whitespace', () => {
    expect(
      loadEnvironmentConfig({
        DREYZE_API_KEY: ' test-key ',
        DREYZE_BASE_URL: ' http://127.0.0.1:11434/v1 ',
        DREYZE_MODEL: ' local-model ',
      }),
    ).toEqual({
      apiKey: 'test-key',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'local-model',
    });
  });

  it('rejects a blank API key with a field-specific error', () => {
    expect(() => loadEnvironmentConfig({ DREYZE_API_KEY: '   ' })).toThrow(
      'DREYZE_API_KEY must not be empty.',
    );
  });

  it('reports invalid provider settings without echoing their values', () => {
    const secret = 'private-token-value';

    try {
      loadEnvironmentConfig({
        DREYZE_BASE_URL: `https://${secret}@example.test/v1?token=${secret}`,
        DREYZE_MODEL: '   ',
      });
      throw new Error('Expected invalid environment configuration to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain('DREYZE_BASE_URL');
      expect((error as ConfigurationError).message).toContain('DREYZE_MODEL');
      expect((error as ConfigurationError).message).not.toContain(secret);
    }
  });
});
