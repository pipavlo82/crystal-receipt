import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


EXPECTED_ACTION_GROWTH_EFFECTS = {
    "session_id": "base_orientation",
    "agent_id": "core_geometry_bias",
    "receiptHash": "primary_crystal_identity",
    "eventRoot": "global_growth_structure",
    "diffHash": "fracture_step_pattern",
    "changed_files": "terrace_branch_count",
    "scope": "outer_boundary",
    "authority": "boundary_strength",
    "verifier_result": "seal_clarity_glow",
    "signature_trust_block": "trust_ring_edge_accent",
    "timestamp": "layer_rhythm",
}


class GenerateReceiptModeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="crystal-receipt-generate-"))
        self.repo_root = Path(__file__).resolve().parents[1]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_generate(self, *args):
        return subprocess.run(
            [sys.executable, "generate.py", *args],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            check=True,
        )

    def test_hash_mode_still_works(self):
        out = self.tmp / "hash"
        self.run_generate("--hash", "demo-receipt-hash-001", "--out", str(out))
        self.assertTrue((out / "crystal.svg").exists())
        meta = json.loads((out / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["mode"], "hash")

    def test_receipt_mode_writes_outputs(self):
        out = self.tmp / "receipt"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out))
        self.assertTrue((out / "crystal.svg").exists())
        self.assertTrue((out / "crystal.metadata.json").exists())

    def test_same_receipt_twice_produces_identical_metadata(self):
        out1 = self.tmp / "r1"
        out2 = self.tmp / "r2"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out1))
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out2))
        meta1 = json.loads((out1 / "crystal.metadata.json").read_text(encoding="utf-8"))
        meta2 = json.loads((out2 / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(meta1, meta2)

    def test_changed_receipt_produces_different_metadata(self):
        out1 = self.tmp / "r1"
        out2 = self.tmp / "r2"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out1))
        self.run_generate("--receipt", "examples/receipt-demo/receipt_changed.json", "--out", str(out2))
        meta1 = json.loads((out1 / "crystal.metadata.json").read_text(encoding="utf-8"))
        meta2 = json.loads((out2 / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertNotEqual(meta1, meta2)
        self.assertNotEqual(meta1["canonical_receipt_hash"], meta2["canonical_receipt_hash"])

    def test_changed_receipt_produces_different_svg(self):
        out1 = self.tmp / "r1"
        out2 = self.tmp / "r2"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out1))
        self.run_generate("--receipt", "examples/receipt-demo/receipt_changed.json", "--out", str(out2))
        svg1 = (out1 / "crystal.svg").read_text(encoding="utf-8")
        svg2 = (out2 / "crystal.svg").read_text(encoding="utf-8")
        self.assertNotEqual(svg1, svg2)

    def test_receipt_metadata_contains_provenance_and_boundary(self):
        out = self.tmp / "receipt"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out))
        meta = json.loads((out / "crystal.metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["mode"], "receipt")
        self.assertIn("canonical_receipt_hash", meta)
        self.assertIn("derived_seeds", meta)
        self.assertIn("visual_traits", meta)
        self.assertIn("action_growth_map", meta)
        self.assertIn("generator_version", meta)
        self.assertIn("ruleset", meta)
        self.assertIn("boundary", meta)
        self.assertIn("not the security verifier", meta["boundary"])

    def test_action_growth_map_contains_expected_keys_and_effects(self):
        out = self.tmp / "receipt"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out))
        meta = json.loads((out / "crystal.metadata.json").read_text(encoding="utf-8"))
        action_growth_map = meta["action_growth_map"]

        self.assertEqual(set(action_growth_map.keys()), set(EXPECTED_ACTION_GROWTH_EFFECTS.keys()))
        for key, visual_effect in EXPECTED_ACTION_GROWTH_EFFECTS.items():
            self.assertIn("source", action_growth_map[key])
            self.assertEqual(action_growth_map[key]["visual_effect"], visual_effect)

    def test_changed_receipt_changes_action_growth_map_sources_for_changed_fields(self):
        out1 = self.tmp / "r1"
        out2 = self.tmp / "r2"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out1))
        self.run_generate("--receipt", "examples/receipt-demo/receipt_changed.json", "--out", str(out2))
        meta1 = json.loads((out1 / "crystal.metadata.json").read_text(encoding="utf-8"))
        meta2 = json.loads((out2 / "crystal.metadata.json").read_text(encoding="utf-8"))
        map1 = meta1["action_growth_map"]
        map2 = meta2["action_growth_map"]

        changed_keys = [
            "session_id",
            "agent_id",
            "receiptHash",
            "eventRoot",
            "diffHash",
            "changed_files",
            "scope",
            "authority",
            "verifier_result",
            "signature_trust_block",
            "timestamp",
        ]
        for key in changed_keys:
            self.assertNotEqual(map1[key]["source"], map2[key]["source"], key)

    def test_receipt_svg_contains_bismuth_style_rectangular_structure(self):
        out = self.tmp / "receipt"
        self.run_generate("--receipt", "examples/receipt-demo/receipt.json", "--out", str(out))
        svg = (out / "crystal.svg").read_text(encoding="utf-8")
        self.assertGreaterEqual(svg.count("<rect "), 8)
        self.assertIn("fill=\"url(#oxide)\"", svg)
        self.assertIn("/", svg)


if __name__ == "__main__":
    unittest.main()
