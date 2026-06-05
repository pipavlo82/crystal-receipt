import json
import shutil
import tempfile
import unittest
from pathlib import Path

import generate


class CrystalReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="crystal-receipt-test-"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_same_hash_generates_same_metadata(self):
        out1 = self.tmp / "a"
        out2 = self.tmp / "b"
        generate.write_outputs("demo-receipt-hash-001", out1)
        generate.write_outputs("demo-receipt-hash-001", out2)
        meta1 = json.loads((out1 / "crystal.metadata.json").read_text(encoding="utf-8"))
        meta2 = json.loads((out2 / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(meta1, meta2)

    def test_different_hash_generates_different_metadata(self):
        out1 = self.tmp / "a"
        out2 = self.tmp / "b"
        generate.write_outputs("demo-receipt-hash-001", out1)
        generate.write_outputs("demo-receipt-hash-002", out2)
        meta1 = json.loads((out1 / "crystal.metadata.json").read_text(encoding="utf-8"))
        meta2 = json.loads((out2 / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertNotEqual(meta1["sha256"], meta2["sha256"])
        self.assertNotEqual(meta1["seed"], meta2["seed"])
        self.assertNotEqual(meta1["layer_specs"], meta2["layer_specs"])


if __name__ == "__main__":
    unittest.main()
