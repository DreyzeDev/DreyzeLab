import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig({
  files: ['**/*.{js,ts}'],
  ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  extends: [js.configs.recommended, tseslint.configs.recommended],
});
