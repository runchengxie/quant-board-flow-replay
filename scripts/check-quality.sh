#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
uv sync --locked --group dev
uv run --locked python -B -m unittest discover -s tests -p 'test_*.py'
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked ty check
node --test tests/ui*.mjs
requirements=$(mktemp)
trap 'rm -f -- "$requirements"' EXIT
uv export --locked --group dev --format requirements-txt --no-hashes --no-emit-project > "$requirements"
uv run --locked pip-audit --strict --no-deps -r "$requirements"
npm audit --audit-level=low
git diff --check
