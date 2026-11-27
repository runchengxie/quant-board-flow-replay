"""Small invented archive data; never copy production observations into tests."""

import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

LAYOUT = {
    "schema_meta": (["key", "value"], ["TEXT", "TEXT"], ["key"]),
    "board_catalog": (
        ["board_code", "board_name", "board_type", "first_seen_at", "last_seen_at"],
        ["TEXT"] * 5,
        ["board_code"],
    ),
    "board_catalog_daily": (
        ["trade_date", "board_code", "board_name", "board_type", "captured_at"],
        ["TEXT"] * 5,
        ["trade_date", "board_code"],
    ),
    "collection_run": (
        [
            "run_id",
            "kind",
            "trade_date",
            "started_at",
            "finished_at",
            "status",
            "board_count",
            "row_count",
            "detail",
        ],
        ["TEXT"] * 6 + ["INTEGER", "INTEGER", "TEXT"],
        ["run_id"],
    ),
    "flow_snapshot": (
        [
            "trade_date",
            "board_code",
            "board_type",
            "captured_at",
            "main_net_yuan",
            "main_net_ratio_pct",
            "change_pct",
            "amount_yuan",
        ],
        ["TEXT"] * 4 + ["REAL"] * 4,
        ["trade_date", "board_code", "captured_at"],
    ),
    "flow_minute": (
        [
            "trade_date",
            "board_code",
            "board_type",
            "trade_time",
            "main_net_yuan",
            "small_net_yuan",
            "mid_net_yuan",
            "large_net_yuan",
            "xlarge_net_yuan",
            "source",
            "archived_at",
        ],
        ["TEXT"] * 4 + ["REAL"] * 5 + ["TEXT"] * 2,
        ["trade_date", "board_code", "trade_time"],
    ),
}
TIMES = [
    f"{minute // 60:02}:{minute % 60:02}"
    for start, end in [(571, 690), (781, 900)]
    for minute in range(start, end + 1)
]


def archive(root: Path) -> Path:
    root.mkdir()
    files = []

    def add(table, date, rows):
        columns, types, key = LAYOUT[table]
        arrow = {"TEXT": pa.string(), "INTEGER": pa.int64(), "REAL": pa.float64()}
        data = pa.Table.from_pylist(
            rows,
            schema=pa.schema(
                [(name, arrow[kind]) for name, kind in zip(columns, types, strict=True)]
            ),
        )
        path = root / table / ((date or "all") + ".parquet")
        path.parent.mkdir(exist_ok=True)
        pq.write_table(data, path, compression="zstd")
        files.append(
            {
                "table": table,
                "date": date,
                "columns": columns,
                "types": types,
                "key": key,
                "rows": len(rows),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )

    add("schema_meta", None, [{"key": "schema_version", "value": "1"}])
    add(
        "board_catalog",
        None,
        [
            {
                "board_code": "BK0001",
                "board_name": "Later name",
                "board_type": "concept",
                "first_seen_at": "2026-01-01T09:00:00+08:00",
                "last_seen_at": "2026-02-01T09:00:00+08:00",
            }
        ],
    )
    add("collection_run", None, [])
    add("flow_snapshot", "2026-01-05", [])
    for date in ["2026-01-05", "2026-01-06"]:
        rows = []
        for number, kind in enumerate(["concept", "industry", "region"], 1):
            code = f"BK{number:04}"
            for index, clock in enumerate(TIMES):
                rows.append(
                    {
                        "trade_date": date,
                        "board_code": code,
                        "board_type": kind,
                        "trade_time": f"{date} {clock}:00",
                        "main_net_yuan": float(index + number),
                        "small_net_yuan": 0.0,
                        "mid_net_yuan": 0.0,
                        "large_net_yuan": 0.0,
                        "xlarge_net_yuan": 0.0,
                        "source": "synthetic",
                        "archived_at": f"{date}T15:10:00+08:00",
                    }
                )
        add("flow_minute", date, rows)
        if date == "2026-01-05":
            add(
                "board_catalog_daily",
                date,
                [
                    {
                        "trade_date": date,
                        "board_code": f"BK{n:04}",
                        "board_name": f"Invented board {n}",
                        "board_type": kind,
                        "captured_at": f"{date}T09:25:00+08:00",
                    }
                    for n, kind in enumerate(["concept", "industry", "region"], 1)
                ],
            )
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "format": "board-flow-parquet-v1",
                "snapshot_started_utc": "2026-01-07T08:00:00+00:00",
                "files": files,
            }
        )
    )
    return root


def rewrite(root, update):
    path = root / "manifest.json"
    value = json.loads(path.read_text())
    update(value)
    path.write_text(json.dumps(value))


def rewrite_table(root, table, day, change):
    path = root / table / ((day or "all") + ".parquet")
    data = pq.ParquetFile(path).read()
    rows = data.to_pylist()
    change(rows)
    pq.write_table(pa.Table.from_pylist(rows, schema=data.schema), path, compression="zstd")

    def update(manifest):
        entry = next(
            item for item in manifest["files"] if item["table"] == table and item["date"] == day
        )
        entry.update(
            rows=len(rows),
            bytes=path.stat().st_size,
            sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        )

    rewrite(root, update)
