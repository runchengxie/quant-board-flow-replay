# Development checks

[简体中文](development.zh-CN.md)

Use an isolated task worktree and a task-owned environment/cache outside source.
Run `uv sync --locked --group dev`, `npm ci --ignore-scripts`, then
`bash scripts/check-quality.sh`. The gate runs all Python unit tests, Ruff format
and lint, ty, all Node tests and Python/npm dependency audits. Set TMPDIR outside
any project checkout. Never use source exclusions to conceal a failure.

For browser acceptance, first build an invented fixture with
`uv run python scripts/make-fixture.py --archive "$SYNTHETIC_ARCHIVE" --out "$REPLAY_OUTPUT"`.
Then run `npm run test:browser -- --bundle "$REPLAY_OUTPUT" --out "$BROWSER_RESULTS"`.
Install the browser matching locked playwright-core, or explicitly select a local
Chrome via PLAYWRIGHT_EXECUTABLE_PATH. The script keeps Chromium sandbox enabled,
uses a disposable profile and blocks external page requests. On Unix choose a
short task TMPDIR to avoid the browser's socket path limit. Screenshots/results
stay outside Git. Public CI runs synthetic unit/static/dependency checks; browser
acceptance is a separate explicit check and must be recorded.

An optional `--expected` JSON supplies independent SQL rankings by day/type/window.
This is task evidence, not production data to commit. Test all input failures,
future-point and axis invariance, lunch/gaps, missing catalogs, delayed day loads,
locale persistence and mobile layout. No real provider request is part of tests.
