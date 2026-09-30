#!/usr/bin/env node

import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startModelInteractiveSession } from './cli/chat.js';
import { ConfigurationError } from './config/environment.js';

const version = '0.0.1';

export function createProgram(
  startInteractiveSession: () => Promise<void> = startModelInteractiveSession,
): Command {
  return new Command()
    .name('dreyze')
    .description('Terminal-first coding environment.')
    .version(version)
    .action(() => startInteractiveSession());
}

const invokedScript = process.argv[1];

if (
  invokedScript !== undefined &&
  realpathSync(resolve(invokedScript)) === fileURLToPath(import.meta.url)
) {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }

    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  }
}
