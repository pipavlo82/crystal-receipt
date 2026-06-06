import unittest

from crystal_receipt.canonicalize import canonical_receipt_hash, load_receipt
from crystal_receipt.seeds import derive_seed_material
from crystal_receipt.traits import derive_visual_traits


class ReceiptIdentityTests(unittest.TestCase):
    def test_same_receipt_loaded_twice_same_canonical_hash(self):
        a = load_receipt("examples/receipt-demo/receipt.json")
        b = load_receipt("examples/receipt-demo/receipt.json")
        self.assertEqual(canonical_receipt_hash(a), canonical_receipt_hash(b))

    def test_same_receipt_loaded_twice_same_seed_material(self):
        a = load_receipt("examples/receipt-demo/receipt.json")
        b = load_receipt("examples/receipt-demo/receipt.json")
        self.assertEqual(
            derive_seed_material(canonical_receipt_hash(a)),
            derive_seed_material(canonical_receipt_hash(b)),
        )

    def test_changed_receipt_has_different_canonical_hash(self):
        original = load_receipt("examples/receipt-demo/receipt.json")
        changed = load_receipt("examples/receipt-demo/receipt_changed.json")
        self.assertNotEqual(canonical_receipt_hash(original), canonical_receipt_hash(changed))

    def test_changed_receipt_has_different_seed_material(self):
        original = load_receipt("examples/receipt-demo/receipt.json")
        changed = load_receipt("examples/receipt-demo/receipt_changed.json")
        original_seeds = derive_seed_material(canonical_receipt_hash(original))
        changed_seeds = derive_seed_material(canonical_receipt_hash(changed))
        self.assertNotEqual(original_seeds["master_seed"], changed_seeds["master_seed"])
        named_keys = [
            "shape_seed",
            "palette_seed",
            "symmetry_seed",
            "layer_seed",
            "oxide_seed",
            "trait_seed",
        ]
        self.assertTrue(any(original_seeds[key] != changed_seeds[key] for key in named_keys))

    def test_same_seed_material_same_visual_traits(self):
        receipt = load_receipt("examples/receipt-demo/receipt.json")
        seeds = derive_seed_material(canonical_receipt_hash(receipt))
        self.assertEqual(derive_visual_traits(seeds), derive_visual_traits(seeds))

    def test_changed_seed_material_different_visual_traits(self):
        original = load_receipt("examples/receipt-demo/receipt.json")
        changed = load_receipt("examples/receipt-demo/receipt_changed.json")
        original_traits = derive_visual_traits(derive_seed_material(canonical_receipt_hash(original)))
        changed_traits = derive_visual_traits(derive_seed_material(canonical_receipt_hash(changed)))
        self.assertNotEqual(original_traits, changed_traits)


if __name__ == "__main__":
    unittest.main()
