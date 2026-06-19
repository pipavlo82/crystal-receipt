import unittest
from pathlib import Path


class ArtifactViewerDemoTests(unittest.TestCase):
    def test_static_viewer_exists_and_targets_capsule_summary(self):
        viewer = Path("examples/artifact-viewer/index.html")
        self.assertTrue(viewer.exists(), "artifact viewer demo should exist")
        text = viewer.read_text(encoding="utf-8")
        self.assertIn("Attested agent work, not claimed work.", text)
        self.assertIn("../receiptos-capsule-demo/capsule-summary.json", text)
        self.assertIn("Evidence Capsule", text)
        self.assertIn("Replay Manifest", text)
        self.assertIn("Optional Crystal Surface", text)


if __name__ == "__main__":
    unittest.main()
