# Contributing to DreyzeLab

Thanks for your interest in contributing. DreyzeLab is under active development and its current
scope is intentionally small.

## Before you start

- Check the current milestone and open issues before proposing a change.
- Keep pull requests focused on one behavior or maintenance task.
- Do not add placeholder subsystems for features that are not part of the current milestone.
- Do not include credentials, API keys, or personal project data in commits or test fixtures.

## Development checks

Use Node.js 20.19 or newer and pnpm 11.25.0. Before opening a pull request, run:

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Describe the behavior changed and the checks you ran. Add or update tests with behavior changes.

## Commits

Use Conventional Commit messages, such as `feat(cli): add an interactive session` or
`test(cli): cover help output`. Each commit should represent a real, logically complete change.
