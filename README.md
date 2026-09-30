# DreyzeLab

DreyzeLab is an open-source, terminal-first coding environment. It is being built in small,
reviewable milestones.

## Current status

The repository is at **STEP 0 — Repository Foundation**. The `dreyze` command currently supports
`--help` and `--version`. Interactive chat, model providers, tools, and code modification are not
implemented yet.

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

To try the current CLI after building:

```sh
node dist/index.js --help
node dist/index.js --version
```

## License

DreyzeLab is available under the MIT License. See [LICENSE](LICENSE).
