# Board Flow Replay

[简体中文](README.zh-CN.md)

An offline A-share board fund-flow replay. Read a verified market-data archive,
choose a trading day and inspect cumulative main-flow changes over 5, 15 or 30
minutes. No provider access, database service or external page resources.

The data platform continues to own collection, archival and quality. This project
owns presentation. **A post-close minute curve is not a record of what was known
at that historical instant.** Hiding future points does not make it a signal
backtest. Board memberships overlap; their flows must not be added as market flow.

## Build a local page

Requires Python 3.12+ and uv. Set the paths to your existing archive and a **new**
output directory outside any project checkout:

```sh
uv sync --locked --no-dev
uv run --locked --no-dev board-flow-replay build --archive "$BOARD_FLOW_ARCHIVE" --out "$REPLAY_OUTPUT"
```

Open `$REPLAY_OUTPUT/index.html` in a browser. Keep its neighboring files together.
It works from `file://` without a server. English is the default; use the language
selector for Simplified Chinese. Selections persist when browser storage permits.

The builder accepts `board-flow-parquet-v1`, including existing archives without
producer metadata. It verifies hashes, schema, row counts and keys, preserves gaps
and marks missing daily catalogs. It never writes the archive or the original
SQLite. It refuses existing output; the entry point is published last. An
interrupted new output is retained for inspection rather than overwritten.

See [usage and interpretation](docs/usage.md), [archive contract](docs/archive-contract.md)
and [development checks](docs/development.md). Real data and generated pages stay
outside this repository; examples and CI fixtures are invented.

Use **Compact window** for a narrow view and **Watch selected sector** to keep up to 12 sector identities in a fixed order. The watchlist shows 5/15/30-minute changes at the replay cursor; incomplete windows remain —. Preferences stay in browser storage when available. Names always come from the selected day, and missing sectors remain listed by code. This is an offline archive widget, with the latest archived day shown prominently; it does not monitor live collection or refresh itself.
