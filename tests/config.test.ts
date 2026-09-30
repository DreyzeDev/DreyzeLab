import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, loadEnvironmentConfig } from '../src/config/environment.js';

describe('environment configuration', () => {
  it('uses defaults when no provider environment variables are set', () => {
    expect(loadEnvironmentConfig({})).toEqual({ baseUrl: DEFAULT_BASE_URL });
  });
});
