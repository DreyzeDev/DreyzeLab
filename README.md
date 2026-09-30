# DreyzeLab

DreyzeLab is an open-source, terminal-first coding environment. It is being built in small,
reviewable milestones.

## Current status

The repository is at **STEP 1 — Basic Interactive CLI**. Running `dreyze` starts a local echo
session with `/help`, `/exit`, and Ctrl+C support. Model providers, tools, and code modification
are not implemented yet.

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
