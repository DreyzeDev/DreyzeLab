#!/usr/bin/env node

import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInteractiveSession } from './cli/interactive.js';

const version = '0.0.1';

export function createProgram(
  startInteractiveSession: () => Promise<void> = runInteractiveSession,
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
  await createProgram().parseAsync(process.argv);
}
