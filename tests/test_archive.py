import json
import tempfile
import unittest
from pathlib import Path

from tests.fixtures import archive, rewrite, rewrite_table


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = archive(Path(self.temp.name) / "archive")

    def reader(self):
        from board_flow_replay.archive import Archive

        return Archive(self.root)

    def test_existing_v1_without_producer_is_supported(self):
        reader = self.reader()
        self.assertEqual(reader.dates, ["2026-01-05", "2026-01-06"])

    def test_corrupt_file_rejected(self):
        (self.root / "flow_minute/2026-01-05.parquet").write_bytes(b"broken")
        with self.assertRaisesRegex(ValueError, "hash|size"):
            self.reader()

    def test_unknown_version_rejected(self):
        rewrite(self.root, lambda m: m.update(format="other-v2"))
        with self.assertRaisesRegex(ValueError, "format"):
            self.reader()

    def test_duplicate_table_partition_rejected(self):
        rewrite(self.root, lambda m: m["files"].append(m["files"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.reader()

    def test_missing_table_inventory_rejected(self):
        rewrite(
            self.root,
            lambda m: m.update(
                files=[item for item in m["files"] if item["table"] != "collection_run"]
            ),
        )
        with self.assertRaisesRegex(ValueError, "inventory|table"):
            self.reader()

    def test_unlisted_parquet_rejected(self):
        original = self.root / "schema_meta/all.parquet"
        (self.root / "unlisted.parquet").write_bytes(original.read_bytes())
        with self.assertRaisesRegex(ValueError, "inventory|unlisted"):
            self.reader()

    def test_unsafe_table_and_partition_rejected(self):
        rewrite(self.root, lambda m: m["files"][0].update(table="../escape"))
        with self.assertRaises(ValueError):
            self.reader()

    def test_symlink_file_rejected(self):
        target = self.root / "schema_meta/all.parquet"
        target.rename(target.with_suffix(".saved"))
        target.symlink_to("all.saved")
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.reader()

    def test_declared_schema_and_row_count_enforced(self):
        rewrite(self.root, lambda m: m["files"][0].update(rows=999))
        with self.assertRaisesRegex(ValueError, "rows"):
            self.reader()

    def test_manifest_sql_is_never_executed(self):
        rewrite(self.root, lambda m: m.update(tables_sql=["DROP TABLE anything;"]))
        self.assertEqual(len(self.reader().dates), 2)

    def test_manifest_json_duplicate_keys_rejected(self):
        path = self.root / "manifest.json"
        text = path.read_text().replace('"format":', '"format":"wrong","format":', 1)
        json.loads(text)  # Ordinary json.loads would silently select the later value.
        path.write_text(text)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.reader()

    def test_duplicate_observation_key_rejected(self):
        rewrite_table(self.root, "flow_minute", "2026-01-05", lambda rows: rows.append(rows[0]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.reader()

    def test_changed_parquet_without_changed_manifest_is_not_unchanged(self):
        reader = self.reader()
        (self.root / "schema_meta/all.parquet").write_bytes(b"changed")
        self.assertFalse(reader.unchanged())
