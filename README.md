# DreyzeLab

DreyzeLab is an open-source, terminal-first coding environment. It is being built in small,
reviewable milestones.

## Current status

The repository has completed **STEP 3 — First Real Model Provider**. `dreyze` can send text chat
requests through an OpenAI-compatible provider using `DREYZE_API_KEY`, `DREYZE_BASE_URL`, and
`DREYZE_MODEL`. The interactive session supports `/help` and `/exit`. Tool calls, streaming, and
code modification are not implemented yet.

## Requirements

- Node.js 20.19 or newer
- pnpm 11.25.0

The package manager version is recorded in `package.json`; Corepack can select that pinned version.

## Development

```sh
pnpm install
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

To try the CLI after building:

```sh
node dist/index.js --help
node dist/index.js --version
node dist/index.js
```

## License

DreyzeLab is available under the MIT License. See [LICENSE](LICENSE).
