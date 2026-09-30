# DreyzeLab

DreyzeLab is an open-source, terminal-first coding environment. It is being built in small,
reviewable milestones.

## Current status

The repository has completed **STEP 5 — Read-only Tools**. The workspace layer can identify the
canonical project path, find a Git root, and collect a lightweight top-level file and manifest
snapshot. A tool registry exposes `read_file`, `list_directory`, `glob`, and `grep`, and the
OpenAI-compatible provider can send their JSON schemas and return tool calls. The CLI does not
execute model tool calls yet; the agent loop is the next milestone. File editing, shell execution,
and streaming are not implemented yet.

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
