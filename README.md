# DreyzeLab

DreyzeLab is an open-source, terminal-first coding environment. It is being built in small,
reviewable milestones.

## Current status

The repository has completed **STEP 2 — Config System**. The environment configuration loader
validates `DREYZE_API_KEY`, `DREYZE_BASE_URL`, and `DREYZE_MODEL`. Running `dreyze` still starts a
local echo session with `/help`, `/exit`, and Ctrl+C support; the settings are not connected to a
model provider yet. Tools and code modification are not implemented.

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
