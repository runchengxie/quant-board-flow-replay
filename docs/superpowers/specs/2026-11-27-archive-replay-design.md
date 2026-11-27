# Archive-backed board-flow replay

The user requested an independent public source project with no real data. Keep
collection, lossless archival and authoritative quality in the provider. This
consumer builds an offline static application from the existing v1 archive.
The alternatives were keeping an unversioned page in a data folder, or copying
collection into a second application. The former loses maintainable delivery;
the latter duplicates ownership and state. Separate only the consumer.

Use Python/PyArrow for a read-only, hash-checked build and dependency-free classic
JavaScript for file:// operation. Write only a new output directory outside the
checkout. Do not overwrite a current/latest alias or modify a source archive.
Retain source manifest hash, timestamps, units, timezone and per-day coverage.
The contract is board-flow-parquet-v1: fixed six tables, dated/all Parquet files,
SQLite declared types, file hashes, row counts and keys. Reject unsafe paths,
unknown versions, duplicate entries, malformed times or nonfinite observations.

Default to English with an explicit remembered Chinese switch. Default replay
starts at the first minute with a deterministic selected board. As-of mode masks
future curve points and computes its axis only from visible values. Full-day
overview is explicitly selected. Rankings compare cumulative main flow at exact
5/15/30 minute endpoints within a session; any missing point in that interval
excludes the board. Never impute zero or sum overlapping board memberships.
Use only same-day catalog names; a missing catalog shows codes and incomplete
coverage. A cursor-limited post-close archive is not an information-availability
or signal backtest. Display that limitation prominently.

Validate with synthetic Python/Node fixtures, a real Chromium interaction run,
and a read-only comparison to the existing archive/SQLite. Preserve the original
prototype and archive. No production service switch, retention deletion, index
removal, realtime push, new database or trading signal is included.
