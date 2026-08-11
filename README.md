# Container Diet

> Image shrink recommendations

**Author:** zAx4hub

## Problem

Container images quietly accumulate fat: fat bases, apt caches, full build toolchains, and noisy build contexts.

## Solution

`container-diet` parses Dockerfiles, estimates layer cost, and emits ranked shrink recommendations (slim bases, multi-stage, cache cleanup, `.dockerignore`).

## Why different

- Heuristic layer sizing you can run offline
- Actionable suggestions with estimated MB savings
- Deterministic tests, no daemon required
- Owned and credited to **zAx4hub**

## Quickstart

```bash
cd container-diet
npm install
npm test
npm run demo
```

## Features

- Dockerfile parse + layer classification
- Slim/alpine base mapping
- Multi-stage build advice
- Apt cache / debug package tips
- `.dockerignore` generator

## Architecture

Pure analysis in `src/engine.ts`; CLI wraps `demo` / `run` / `inspect`.

## Contributing

PRs welcome — keep changes focused and add tests.

## Credits

Built and maintained by **zAx4hub**.

## License

MIT © 2026 zAx4hub
