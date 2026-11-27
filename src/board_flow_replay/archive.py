"""Validate the data portion of the provider's v1 archive, never incoming SQL."""

import hashlib
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

TEXT = "TEXT"
LAYOUT = {
    "schema_meta": (["key", "value"], [TEXT] * 2, ["key"]),
    "board_catalog": (
        ["board_code", "board_name", "board_type", "first_seen_at", "last_seen_at"],
        [TEXT] * 5,
        ["board_code"],
    ),
    "board_catalog_daily": (
        ["trade_date", "board_code", "board_name", "board_type", "captured_at"],
        [TEXT] * 5,
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
        [TEXT] * 6 + ["INTEGER", "INTEGER", TEXT],
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
        [TEXT] * 4 + ["REAL"] * 4,
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
        [TEXT] * 4 + ["REAL"] * 5 + [TEXT] * 2,
        ["trade_date", "board_code", "trade_time"],
    ),
}
DATED = {"flow_minute", "flow_snapshot", "board_catalog_daily"}
ARROW = {TEXT: pa.string(), "INTEGER": pa.int64(), "REAL": pa.float64()}


def _unique_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate manifest key: {key}")
        result[key] = value
    return result


class Archive:
    """Fail closed on corrupt data and retain no write connection to its source."""

    def __init__(self, root: Path):
        if root.is_symlink():
            raise ValueError("archive root must not be a symlink")
        self.root = root.resolve(strict=True)
        manifest = self.root / "manifest.json"
        if manifest.is_symlink():
            raise ValueError("manifest must not be a symlink")
        raw = manifest.read_bytes()
        self.manifest_sha256 = hashlib.sha256(raw).hexdigest()
        self.manifest = json.loads(raw, object_pairs_hook=_unique_pairs)
        if (
            not isinstance(self.manifest, dict)
            or self.manifest.get("format") != "board-flow-parquet-v1"
        ):
            raise ValueError("unsupported archive format")
        entries = self.manifest.get("files")
        if not isinstance(entries, list) or not entries:
            raise ValueError("missing archive files")
        self.entries: dict[tuple[str, str | None], dict] = {}
        for entry in entries:
            self._admit(entry)
        if {table for table, _ in self.entries} != set(LAYOUT):
            raise ValueError("archive inventory must represent all six tables")
        if set(self.root.rglob("*.parquet")) != self.file_paths():
            raise ValueError("archive inventory contains unlisted Parquet files")
        self.dates = sorted(
            day for table, day in self.entries if table == "flow_minute" and day is not None
        )
        if not self.dates:
            raise ValueError("no minute partitions")

    def _admit(self, entry: dict) -> None:
        if not isinstance(entry, dict) or entry.get("table") not in LAYOUT:
            raise ValueError("unknown archive table")
        table, day = entry["table"], entry.get("date")
        if table in DATED:
            if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
                raise ValueError("invalid partition date")
            date.fromisoformat(day)
        elif day is not None:
            raise ValueError("unexpected partition date")
        key = (table, day)
        if key in self.entries:
            raise ValueError("duplicate table partition")
        columns, types, primary = LAYOUT[table]
        if (entry.get("columns"), entry.get("types"), entry.get("key")) != (
            columns,
            types,
            primary,
        ):
            raise ValueError("archive schema mismatch")
        for name in ("rows", "bytes"):
            if type(entry.get(name)) is not int or entry[name] < 0:
                raise ValueError(f"invalid {name}")
        if not isinstance(entry.get("sha256"), str) or not re.fullmatch(
            r"[0-9a-f]{64}", entry["sha256"]
        ):
            raise ValueError("invalid archive hash")
        self.entries[key] = entry
        data = self.read(table, day)
        keys = zip(*(data[name].to_pylist() for name in primary), strict=True)
        seen = set()
        for row in keys:
            if any(value is None for value in row) or row in seen:
                raise ValueError("duplicate or null primary key")
            seen.add(row)
        if day is not None and any(value != day for value in data["trade_date"].to_pylist()):
            raise ValueError("partition date mismatch")

    def read(self, table: str, day: str | None) -> pa.Table:
        entry = self.entries[table, day]
        directory = self.root / table
        path = directory / ((day or "all") + ".parquet")
        if directory.is_symlink() or path.is_symlink():
            raise ValueError("archive file must not be a symlink")
        raw = path.read_bytes()
        if len(raw) != entry["bytes"]:
            raise ValueError("archive file size mismatch")
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("archive file hash mismatch")
        data = pq.ParquetFile(pa.BufferReader(raw)).read()
        if data.num_rows != entry["rows"]:
            raise ValueError("archive rows mismatch")
        expected = pa.schema(
            [
                (name, ARROW[kind])
                for name, kind in zip(entry["columns"], entry["types"], strict=True)
            ]
        )
        if not data.schema.equals(expected, check_metadata=False):
            raise ValueError("physical archive schema mismatch")
        return data

    def unchanged(self) -> bool:
        manifest = self.root / "manifest.json"
        if (
            manifest.is_symlink()
            or hashlib.sha256(manifest.read_bytes()).hexdigest() != self.manifest_sha256
        ):
            return False
        if set(self.root.rglob("*.parquet")) != self.file_paths():
            return False
        for (table, day), entry in self.entries.items():
            directory = self.root / table
            path = directory / ((day or "all") + ".parquet")
            if directory.is_symlink() or path.is_symlink():
                return False
            raw = path.read_bytes()
            if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
                return False
        return True

    def file_paths(self) -> set[Path]:
        return {self.root / table / ((day or "all") + ".parquet") for table, day in self.entries}
