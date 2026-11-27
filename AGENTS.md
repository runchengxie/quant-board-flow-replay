# Project boundaries

This application reads the `board-flow-parquet-v1` archive produced by
quant-market-data-platform. It owns replay presentation and its derived static
bundle, not collection, authoritative data, provider credentials or scheduling.
Never fill missing observations with zero, use a later catalog as a historical
name source, or describe a post-close curve as point-in-time captured data.

Keep real archives, generated pages, screenshots and runtime logs outside Git.
Build to an explicitly selected new directory outside the source checkout.
Default display language is English; locale catalogs also provide Simplified
Chinese. Machine keys, units and source values are locale-independent.

## Validation

```sh
uv sync --locked --group dev
uv run --locked python -m unittest discover -s tests -p 'test_*.py'
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked ty check
node --test tests/ui*.mjs
npm ci
npm run test:browser -- --bundle /absolute/path/to/bundle --out /absolute/path/to/task-results
```

The browser command uses a disposable browser profile and blocks external page
requests. Set `PLAYWRIGHT_EXECUTABLE_PATH` only when testing an existing local
browser; otherwise install the browser matching the locked Playwright package.
Keep browser output in the task data directory. Public CI uses synthetic data.

Changes to the provider contract must be delivered in the provider first.
Validate the exact provider archive and consumer revisions together. A passing
replay test does not establish healthy collection or permission to prune a store.
