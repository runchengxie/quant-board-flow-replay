import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.fixtures import archive, rewrite, rewrite_table


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.archive = archive(self.base / "archive")

    def build(self, output=None):
        from board_flow_replay.build import build

        return build(self.archive, output or self.base / "output")

    def test_missing_catalog_keeps_code_without_future_name(self):
        self.build()
        value = (self.base / "output/2026-01-06.js").read_text()
        payload = json.loads(value.split("=", 1)[1].removesuffix(";\n"))
        self.assertFalse(payload["hasCatalog"])
        self.assertEqual(payload["boards"][0]["name"], "BK0001")
        self.assertIsNone(payload["counts"]["concept"]["expectedBoards"])
        self.assertIn("missing_daily_catalog", payload["warnings"])

    def test_new_bundle_preserves_provenance_and_values(self):
        result = self.build()
        self.assertEqual(result["dates"], ["2026-01-05", "2026-01-06"])
        output = self.base / "output"
        self.assertTrue((output / "index.html").is_file())
        self.assertTrue((output / "build-manifest.json").is_file())
        payload = json.loads((output / "2026-01-05.js").read_text().split("=", 1)[1][:-2])
        self.assertEqual(payload["boards"][0]["values"], [float(i + 1) for i in range(240)])
        self.assertEqual(payload["provenance"]["sources"], ["synthetic"])
        self.assertEqual(payload["counts"]["concept"]["observedPoints"], 240)

    def test_existing_output_never_overwritten(self):
        target = self.base / "output"
        target.mkdir()
        (target / "sentinel").write_text("keep")
        with self.assertRaises(FileExistsError):
            self.build(target)
        self.assertEqual((target / "sentinel").read_text(), "keep")

    def test_build_inside_source_or_archive_rejected(self):
        with self.assertRaises(ValueError):
            self.build(self.archive / "output")
        repo = self.base / "repo"
        repo.mkdir()
        (repo / ".git").mkdir()
        with self.assertRaises(ValueError):
            self.build(repo / "output")

    def test_build_does_not_change_source(self):
        before = {
            p: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in self.archive.rglob("*")
            if p.is_file()
        }
        self.build()
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in before})

    def test_home_dotfiles_git_does_not_make_data_a_project_checkout(self):
        (self.base / ".git").mkdir()
        with patch.object(Path, "home", return_value=self.base):
            result = self.build()
        self.assertEqual(result["status"], "built")

    def test_changed_already_read_input_blocks_entry_point_publication(self):
        from board_flow_replay import build as builder

        original = builder._day

        def read_then_change(*args):
            payload = original(*args)
            (self.archive / "schema_meta/all.parquet").write_bytes(b"changed")
            return payload

        with patch.object(builder, "_day", side_effect=read_then_change):
            with self.assertRaisesRegex(ValueError, "changed"):
                self.build()
        self.assertFalse((self.base / "output/index.html").exists())

    def test_provenance_ranges_use_actual_instants_across_offsets(self):
        def change(rows):
            rows[0]["archived_at"] = "2026-01-05T10:00:00+00:00"

        rewrite_table(self.archive, "flow_minute", "2026-01-05", change)
        self.build()
        payload = json.loads((self.base / "output/2026-01-05.js").read_text().split("=", 1)[1][:-2])
        self.assertEqual(payload["provenance"]["archivedAtMin"], "2026-01-05T15:10:00+08:00")
        self.assertEqual(payload["provenance"]["archivedAtMax"], "2026-01-05T18:00:00+08:00")

    def test_provided_snapshot_metadata_must_include_a_clock(self):
        rewrite(self.archive, lambda m: m.update(snapshot_started_utc="2026-01-07"))
        with self.assertRaisesRegex(ValueError, "timestamp"):
            self.build()

    def test_nonfinite_flow_and_ambiguous_minutes_rejected(self):
        for field, value in [
            ("main_net_yuan", float("nan")),
            ("source", None),
            ("archived_at", "2026-01-05"),
            ("trade_time", "2026-01-05 09:31:00.000001"),
            ("trade_time", "2026-01-05 09:31:00+08:00"),
        ]:
            with self.subTest(field=field, value=value):
                original = (self.archive / "flow_minute/2026-01-05.parquet").read_bytes()
                manifest = (self.archive / "manifest.json").read_bytes()
                rewrite_table(
                    self.archive,
                    "flow_minute",
                    "2026-01-05",
                    lambda rows, f=field, v=value: rows[0].update({f: v}),
                )
                with self.assertRaises(ValueError):
                    self.build()
                (self.archive / "flow_minute/2026-01-05.parquet").write_bytes(original)
                (self.archive / "manifest.json").write_bytes(manifest)

    def test_interrupted_output_has_no_entry_point_and_is_preserved(self):
        import os

        real_replace = os.replace
        calls = 0

        def interrupt(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated interruption")
            return real_replace(source, destination)

        with patch("board_flow_replay.build.os.replace", side_effect=interrupt):
            with self.assertRaisesRegex(OSError, "simulated"):
                self.build()
        self.assertTrue((self.base / "output").exists())
        self.assertFalse((self.base / "output/index.html").exists())
