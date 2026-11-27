"""Generate a new local static bundle, without mutating an authoritative archive."""

import hashlib
import json
import math
import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from board_flow_replay.archive import Archive

TIMES = [
    f"{minute // 60:02}:{minute % 60:02}"
    for start, end in [(571, 690), (781, 900)]
    for minute in range(start, end + 1)
]
POSITIONS = {clock: index for index, clock in enumerate(TIMES)}
KINDS = {"concept", "industry", "region"}


def _js(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        .replace("\u2028", r"\u2028")
        .replace("\u2029", r"\u2029")
        .replace("<", r"\u003c")
    )


def _stamp(value: str) -> str:
    if not isinstance(value, str) or not re.match(
        r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}", value
    ):
        raise ValueError("invalid provenance timestamp")
    parsed = datetime.fromisoformat(value)
    zone = ZoneInfo("Asia/Shanghai")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=zone)
    return parsed.astimezone(zone).isoformat()


def _day(reader: Archive, day: str) -> dict:
    has_catalog = ("board_catalog_daily", day) in reader.entries
    catalog = {}
    if has_catalog:
        for row in reader.read("board_catalog_daily", day).to_pylist():
            catalog[row["board_code"]] = row
    boards = {}
    sources, archived, captured = set(), [], []
    warnings = set() if has_catalog else {"missing_daily_catalog"}
    for row in catalog.values():
        captured.append(_stamp(row["captured_at"]))
        if row["board_type"] not in KINDS:
            raise ValueError("invalid catalog board type")
    for row in reader.read("flow_minute", day).to_pylist():
        code, kind = row["board_code"], row["board_type"]
        if not isinstance(code, str) or not code or kind not in KINDS:
            raise ValueError("invalid board identity")
        ts = datetime.fromisoformat(row["trade_time"])
        index = POSITIONS.get(ts.strftime("%H:%M"))
        if (
            ts.date().isoformat() != day
            or ts.second
            or ts.microsecond
            or ts.tzinfo is not None
            or index is None
        ):
            raise ValueError("invalid Shanghai minute timestamp")
        value = row["main_net_yuan"]
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("invalid main net flow")
        known = catalog.get(code)
        if known and known["board_type"] != kind:
            raise ValueError("catalog board type mismatch")
        if has_catalog and known is None:
            warnings.add("minute_board_missing_from_catalog")
        board = boards.setdefault(
            code,
            {
                "code": code,
                "type": kind,
                "name": (known["board_name"] or code) if known else code,
                "values": [None] * len(TIMES),
            },
        )
        if board["type"] != kind or board["values"][index] is not None:
            raise ValueError("duplicate minute or inconsistent board type")
        board["values"][index] = value
        if not isinstance(row["source"], str) or not row["source"].strip():
            raise ValueError("invalid minute source provenance")
        sources.add(row["source"])
        archived.append(_stamp(row["archived_at"]))
    counts = {}
    for kind in sorted(KINDS):
        selected = [board for board in boards.values() if board["type"] == kind]
        expected = (
            sum(row["board_type"] == kind for row in catalog.values()) if has_catalog else None
        )
        points = sum(sum(value is not None for value in board["values"]) for board in selected)
        counts[kind] = {
            "observedPoints": points,
            "observedBoards": len(selected),
            "expectedBoards": expected,
        }
        if expected is not None and points != expected * len(TIMES):
            warnings.add("minute_gaps")
    return {
        "boards": sorted(boards.values(), key=lambda board: board["code"]),
        "counts": counts,
        "hasCatalog": has_catalog,
        "warnings": sorted(warnings),
        "provenance": {
            "sources": sorted(sources),
            "archivedAtMin": min(archived) if archived else None,
            "archivedAtMax": max(archived) if archived else None,
            "catalogCapturedAtMin": min(captured) if captured else None,
            "catalogCapturedAtMax": max(captured) if captured else None,
        },
    }


def _output_path(archive: Path, output: Path) -> Path:
    if output.exists() or output.is_symlink():
        raise FileExistsError(f"output already exists: {output}")
    output = output.resolve()
    if output.is_relative_to(archive.resolve()):
        raise ValueError("output must be outside the source archive")
    for parent in (output, *output.parents):
        # A home-level dotfiles repository does not own every project's DATA_ROOT.
        if parent == Path.home():
            break
        if (parent / ".git").exists():
            raise ValueError("generated data must be outside Git checkouts")
    return output


def build(archive: Path, output: Path) -> dict:
    output = _output_path(archive, output)
    reader = Archive(archive)
    assets = Path(__file__).parent / "static"
    if not assets.is_dir():
        assets = Path(__file__).parents[2] / "static"
    required = ["index.html", "style.css", "model.js", "locales.js", "app.js"]
    if any(not (assets / name).is_file() for name in required):
        raise ValueError("application static assets are incomplete")
    output.parent.mkdir(parents=True, exist_ok=True)
    coverage = {}
    with tempfile.TemporaryDirectory(prefix=".replay-stage-", dir=output.parent) as temp:
        stage = Path(temp)
        for day in reader.dates:
            payload = _day(reader, day)
            coverage[day] = {
                "boards": len(payload["boards"]),
                "rows": sum(v["observedPoints"] for v in payload["counts"].values()),
                "hasCatalog": payload["hasCatalog"],
            }
            (stage / f"{day}.js").write_text(
                f"window.ARCHIVE_DAYS[{_js(day)}]={_js(payload)};\n", encoding="utf-8"
            )
        meta = {
            "format": "board-flow-replay-v1",
            "dates": reader.dates,
            "times": TIMES,
            "coverage": coverage,
            "archive": {
                "format": reader.manifest["format"],
                "manifestSha256": reader.manifest_sha256,
                "snapshotAt": (
                    _stamp(reader.manifest["snapshot_started_utc"])
                    if reader.manifest.get("snapshot_started_utc") is not None
                    else None
                ),
                "producer": reader.manifest.get("producer"),
            },
        }
        (stage / "dates.js").write_text(
            "window.ARCHIVE_DAYS=Object.create(null);window.REPLAY_META=" + _js(meta) + ";\n",
            encoding="utf-8",
        )
        for name in required:
            shutil.copyfile(assets / name, stage / name)
        record = {
            "format": "board-flow-replay-build-v1",
            "archive": meta["archive"],
            "dates": reader.dates,
            "consumer": {
                "version": "0.1.0",
                "source_sha256": {
                    file.name: hashlib.sha256(file.read_bytes()).hexdigest()
                    for file in sorted(Path(__file__).parent.glob("*.py"))
                },
            },
            "files": {
                path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                for path in stage.iterdir()
                if path.is_file()
            },
        }
        (stage / "build-manifest.json").write_text(json.dumps(record, indent=2) + "\n")
        if not reader.unchanged():
            raise ValueError("source manifest changed during build")
        # Exclusive directory reservation prevents overwriting an existing user output.
        # The entry point is published last. An interrupted reserved directory is
        # preserved without a valid entry point; callers must choose a new output.
        output.mkdir()
        for path in sorted(stage.iterdir()):
            if path.name != "index.html":
                os.replace(path, output / path.name)
        os.replace(stage / "index.html", output / "index.html")
    return {
        "status": "built",
        "output": str(output),
        "dates": reader.dates,
        "archive_manifest_sha256": reader.manifest_sha256,
    }
