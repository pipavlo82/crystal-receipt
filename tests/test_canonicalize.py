import copy
import unittest
from pathlib import Path

from crystal_receipt.canonicalize import (
    canonical_receipt_hash,
    canonicalize_receipt,
    load_receipt,
)


class CanonicalizeReceiptTests(unittest.TestCase):
    def test_same_receipt_different_key_order_same_hash(self):
        a = {
            "session_id": "sess_1",
            "receiptHash": "r1",
            "changed_files": ["a.txt", "b.txt"],
            "scope": {"permission": "workspace-write", "network": "disabled"},
        }
        b = {
            "scope": {"network": "disabled", "permission": "workspace-write"},
            "changed_files": ["a.txt", "b.txt"],
            "receiptHash": "r1",
            "session_id": "sess_1",
        }
        self.assertEqual(canonical_receipt_hash(a), canonical_receipt_hash(b))

    def test_changing_receipt_hash_changes_canonical_hash(self):
        a = {
            "session_id": "sess_1",
            "receiptHash": "r1",
            "eventRoot": "e1",
        }
        b = {
            "session_id": "sess_1",
            "receiptHash": "r2",
            "eventRoot": "e1",
        }
        self.assertNotEqual(canonical_receipt_hash(a), canonical_receipt_hash(b))

    def test_canonicalize_receipt_does_not_mutate_input(self):
        receipt = {
            "session_id": "sess_1",
            "receiptHash": "r1",
            "scope": {"permission": "workspace-write"},
            "changed_files": ["a.txt", "b.txt"],
        }
        original = copy.deepcopy(receipt)
        _ = canonicalize_receipt(receipt)
        self.assertEqual(receipt, original)

    def test_example_receipt_can_be_loaded_and_hashed(self):
        path = Path("examples/receipt-demo/receipt.json")
        receipt = load_receipt(str(path))
        digest = canonical_receipt_hash(receipt)
        self.assertIsInstance(receipt, dict)
        self.assertEqual(len(digest), 64)
        self.assertTrue(all(ch in "0123456789abcdef" for ch in digest))


if __name__ == "__main__":
    unittest.main()
