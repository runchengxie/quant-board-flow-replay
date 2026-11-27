# Archive input contract

[简体中文](archive-contract.zh-CN.md)

The provider is [quant-market-data-platform](https://github.com/runchengxie/quant-market-data-platform).
Its [board-flow operations](https://github.com/runchengxie/quant-market-data-platform/blob/main/docs/operations/board-flow.en.md)
own lossless export, verification and restore. This consumer reads an existing
`board-flow-parquet-v1` directory. No provider source import or data copy into Git.

`manifest.json` lists table, date/null, ordered columns and SQLite declared types,
ordered primary-key columns, rows, bytes and SHA-256. Files are derived as
`TABLE/YYYY-MM-DD.parquet` or `TABLE/all.parquet`; incoming paths and SQL are never
executed. JSON duplicate keys, duplicate table/date entries, unsupported tables,
unsafe dates, symlinks, wrong hashes/sizes/schema/rows and duplicate/null primary
keys fail closed. TEXT is Arrow string, INTEGER int64 and REAL float64.

The six canonical tables are schema_meta, board_catalog, board_catalog_daily,
collection_run, flow_snapshot and flow_minute. The reader's column/type/key map is
explicit and versioned in archive.py. All six table identities must be represented;
individual dates may lack partitions. Unlisted Parquet files are rejected.
At least one flow_minute partition is required. This reader
validates the data schema, not a SQLite restoration schema; manifest SQL is ignored.
Use the provider restore tool for full-store reconstruction.

Replay uses board_code, board_type, trade_time, main_net_yuan, source and archived_at
from minutes, and same-day names/captured_at from the daily catalog. Minute times
must be exact local Shanghai minute timestamps in the 09:31–11:30 or13:01–15:00
grid, without offset or fractional seconds. Source identifiers must be nonempty;
main flow must be finite. Provenance timestamps require date and clock and are
normalized to Shanghai before computing ranges. All source files are rehashed
before entry-point publication. Hashes detect byte drift, not vendor truth or
cryptographic producer authenticity.

Legacy manifests need not contain producer metadata. Its absence does not permit
inventing a source revision. The page records the archive snapshot/hash, source
identifiers and collection-time ranges. Missing daily catalogs leave expected
coverage unknown and never borrow future names. Build metadata binds output files
to the source manifest. No current/latest pointer or authoritative data is changed.

Publishing reserves a new output directory exclusively, moves validated staged
assets there and publishes index.html last. This is not a multi-file filesystem
transaction. If interrupted after reservation, retain the incomplete directory
and choose a new output; do not delete unknown contents or overwrite it.
