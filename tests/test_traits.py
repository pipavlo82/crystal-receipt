import unittest

from crystal_receipt.canonicalize import canonical_receipt_hash, load_receipt
from crystal_receipt.seeds import derive_seed_material
from crystal_receipt.traits import derive_visual_traits


class TraitDerivationTests(unittest.TestCase):
    def test_same_seed_material_same_traits(self):
        seeds = derive_seed_material("a" * 64)
        a = derive_visual_traits(seeds)
        b = derive_visual_traits(seeds)
        self.assertEqual(a, b)

    def test_different_seed_material_different_traits(self):
        a = derive_visual_traits(derive_seed_material("a" * 64))
        b = derive_visual_traits(derive_seed_material("b" * 64))
        self.assertNotEqual(a, b)

    def test_invalid_missing_seeds_raise_value_error(self):
        with self.assertRaises(ValueError):
            derive_visual_traits({})
        with self.assertRaises(ValueError):
            derive_visual_traits(
                {
                    "master_seed": "a" * 64,
                    "shape_seed": "a" * 64,
                    "palette_seed": "a" * 64,
                    "symmetry_seed": "a" * 64,
                    "layer_seed": "a" * 64,
                    "oxide_seed": "a" * 64,
                }
            )
        with self.assertRaises(ValueError):
            derive_visual_traits(
                {
                    "master_seed": "z" * 64,
                    "shape_seed": "a" * 64,
                    "palette_seed": "a" * 64,
                    "symmetry_seed": "a" * 64,
                    "layer_seed": "a" * 64,
                    "oxide_seed": "a" * 64,
                    "trait_seed": "a" * 64,
                }
            )

    def test_trait_values_within_expected_ranges(self):
        traits = derive_visual_traits(derive_seed_material("0123456789abcdef" * 4))
        self.assertIn(traits["geometry_style"], ["hopper", "radial", "stepped", "fractured"])
        self.assertIn(traits["palette_name"], ["oxide_rainbow", "blue_gold", "violet_green", "silver_rose"])
        self.assertIn(traits["symmetry"], ["low", "medium", "high"])
        self.assertIn(traits["rarity"], ["common", "uncommon", "rare", "mythic"])
        self.assertGreaterEqual(traits["layer_count"], 4)
        self.assertLessEqual(traits["layer_count"], 16)
        self.assertGreaterEqual(traits["shard_count"], 8)
        self.assertLessEqual(traits["shard_count"], 64)
        self.assertGreaterEqual(traits["oxide_intensity"], 0.0)
        self.assertLessEqual(traits["oxide_intensity"], 1.0)
        self.assertGreaterEqual(traits["edge_bias"], 0.0)
        self.assertLessEqual(traits["edge_bias"], 1.0)
        self.assertEqual(round(traits["oxide_intensity"], 4), traits["oxide_intensity"])
        self.assertEqual(round(traits["edge_bias"], 4), traits["edge_bias"])

    def test_integration_path_receipt_to_traits(self):
        receipt = load_receipt("examples/receipt-demo/receipt.json")
        canonical_hash = canonical_receipt_hash(receipt)
        seeds = derive_seed_material(canonical_hash)
        traits = derive_visual_traits(seeds)
        self.assertIsInstance(traits, dict)
        self.assertIn("geometry_style", traits)
        self.assertIn("palette_name", traits)
        self.assertIn("rarity", traits)


if __name__ == "__main__":
    unittest.main()
