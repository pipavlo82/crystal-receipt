import unittest
from pathlib import Path


import json


class ArtifactViewerDemoTests(unittest.TestCase):
    def test_static_viewer_exists_and_targets_capsule_summary(self):
        viewer = Path("examples/artifact-viewer/index.html")
        self.assertTrue(viewer.exists(), "artifact viewer demo should exist")
        text = viewer.read_text(encoding="utf-8")
        self.assertIn("Attested agent work, not claimed work.", text)
        self.assertIn("../receiptos-capsule-demo/capsule-summary.json", text)
        self.assertIn("../receiptos-capsule-demo/evidence-capsule.v0.json", text)
        self.assertIn("../receipt-examples/index.json", text)
        self.assertIn("Visual surface is deterministic from receipt data and demo context; it is not the verifier.", text)
        self.assertIn("Evidence Capsule", text)
        self.assertIn("Replay Manifest", text)
        self.assertIn("Optional Crystal Surface", text)

    def test_example_manifest_exists(self):
        manifest = Path("examples/receipt-examples/index.json")
        self.assertTrue(manifest.exists(), "example manifest should exist")
        data = json.loads(manifest.read_text(encoding="utf-8"))
        ids = [item["id"] for item in data["examples"]]
        self.assertEqual(ids, [
            "clean-local-proof",
            "tampered-mismatch",
            "anchored-proof",
            "stealth-handoff",
            "github-actions-run",
            "claude-code-session",
            "cursor-session",
            "codex-session",
            "generic-producer",
            "external-coding-run",
        ])
        self.assertGreaterEqual(len(data.get("notes", [])), 1)

        for item in data["examples"]:
            self.assertIn("summaryPath", item)
            self.assertIn("substratePath", item)

        visual_paths = [item["visualPath"] for item in data["examples"] if "visualPath" in item]
        self.assertEqual(len(set(visual_paths)), 3)
        for visual_path in visual_paths:
            self.assertTrue(visual_path.endswith("crystal.svg"))

    def test_example_bundle_files_exist(self):
        for folder in [
            "clean-local-proof",
            "tampered-mismatch",
            "anchored-proof",
            "stealth-handoff",
            "github-actions-run",
            "claude-code-session",
            "cursor-session",
            "codex-session",
            "generic-producer",
            "external-coding-run",
        ]:
            base = Path("examples/receipt-examples") / folder
            self.assertTrue((base / "capsule-summary.json").exists(), f"missing summary for {folder}")
            self.assertTrue((base / "evidence-capsule.v0.json").exists(), f"missing substrate for {folder}")

        for folder in [
            "stealth-handoff",
            "github-actions-run",
            "claude-code-session",
            "cursor-session",
            "codex-session",
            "generic-producer",
            "external-coding-run",
        ]:
            base = Path("examples/receipt-examples") / folder
            self.assertTrue((base / "normalized-evidence.json").exists(), f"missing normalized evidence for {folder}")
            self.assertTrue((base / "provenance-summary.v0.json").exists(), f"missing provenance summary for {folder}")
            self.assertTrue((base / "render-plan.v0.json").exists(), f"missing render plan for {folder}")

    def test_example_visual_files_exist(self):
        for path in [
            Path("examples/receipt-examples/clean-local-proof/crystal.svg"),
            Path("examples/receipt-examples/tampered-mismatch/crystal.svg"),
            Path("examples/receipt-examples/anchored-proof/crystal.svg"),
        ]:
            self.assertTrue(path.exists(), f"missing visual file: {path}")


if __name__ == "__main__":
    unittest.main()
