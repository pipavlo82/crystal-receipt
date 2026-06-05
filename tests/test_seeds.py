import unittest

from crystal_receipt.seeds import derive_seed_material


class SeedDerivationTests(unittest.TestCase):
    def test_same_canonical_hash_same_seed_material(self):
        digest = "a" * 64
        a = derive_seed_material(digest)
        b = derive_seed_material(digest)
        self.assertEqual(a, b)

    def test_uppercase_input_normalizes_to_lowercase(self):
        digest = "ABCDEF12" * 8
        result = derive_seed_material(digest)
        self.assertEqual(result["canonical_hash"], digest.lower())

    def test_different_canonical_hash_different_seed_material(self):
        a = derive_seed_material("a" * 64)
        b = derive_seed_material("b" * 64)
        self.assertNotEqual(a, b)
        self.assertNotEqual(a["master_seed"], b["master_seed"])

    def test_invalid_canonical_hash_raises_value_error(self):
        with self.assertRaises(ValueError):
            derive_seed_material("not-a-sha256")
        with self.assertRaises(ValueError):
            derive_seed_material("g" * 64)
        with self.assertRaises(ValueError):
            derive_seed_material("a" * 63)

    def test_all_seed_values_are_lowercase_hex_sha256(self):
        result = derive_seed_material("0123456789abcdef" * 4)
        keys = [
            "canonical_hash",
            "master_seed",
            "shape_seed",
            "palette_seed",
            "symmetry_seed",
            "layer_seed",
            "oxide_seed",
            "trait_seed",
        ]
        for key in keys:
            value = result[key]
            self.assertEqual(len(value), 64)
            self.assertTrue(all(ch in "0123456789abcdef" for ch in value))


if __name__ == "__main__":
    unittest.main()
