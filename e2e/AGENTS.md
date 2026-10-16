# e2e

Playwright E2E and smoke tests. Owner: `e2e-tester`. Details: skill `testing`.

## Rules

- Tests run against the production stack (`http://localhost:8080`). `pnpm test:e2e` (re)starts it with its own ENV.
- `E2E_BASE_URL=http://localhost:5173` may be used while developing, but a step is done only when tests pass against the stack.
- Tests create their own data (unique emails) and never assume an empty database; the DB is shared with dev mode.
- Log in once per role in a setup project and reuse `storageState`.
- Browsers: Chromium and WebKit.
- Never change production code. Report failures to the orchestrator with reproduction steps.
