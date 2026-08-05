import copy
import unittest

from receiptos_crc_claim_id import (
    ClaimGateError,
    canonicalize_claim_preimage,
    claim_id,
    strict_parse,
    validate_claim_preimage,
)

VALID = {
    "schema": "crc.claim.v0",
    "profile_id": "synthetic.profile.alpha",
    "policy_version": "synthetic.policy.2026-01",
    "artifact_hash": "0123456789abcdef" * 4,
    "artifact_type": "synthetic_assertion",
    "claim_body": "synthetic-result",
    "source_class": "recomputable",
    "verifier_profile": "recompute/synthetic",
    "as_of": "2030-01-02T03:04:05Z",
    "claimant": 42,
}


def mutate(**changes):
    obj = copy.deepcopy(VALID)
    obj.update(changes)
    return obj


class ExactValidClaimTest(unittest.TestCase):
    def test_valid_claim_passes_gate(self):
        validate_claim_preimage(VALID)

    def test_deterministic_repeated_result(self):
        first, _ = claim_id(VALID)
        second, _ = claim_id(copy.deepcopy(VALID))
        self.assertEqual(first, second)


class MissingUnknownFieldTest(unittest.TestCase):
    def test_missing_field_rejected(self):
        obj = copy.deepcopy(VALID)
        del obj["as_of"]
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_unknown_field_rejected(self):
        obj = mutate(extra_field="surprise")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)


class SchemaAndRequiredStringTest(unittest.TestCase):
    def test_wrong_schema_rejected(self):
        obj = mutate(schema="crc.claim.v1")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_every_required_non_claim_body_string_rejects_empty(self):
        fields = (
            "schema",
            "profile_id",
            "policy_version",
            "artifact_hash",
            "artifact_type",
            "source_class",
            "verifier_profile",
            "as_of",
        )
        for field in fields:
            with self.subTest(field=field):
                with self.assertRaises(ClaimGateError):
                    validate_claim_preimage(mutate(**{field: ""}))


class DuplicateMemberTest(unittest.TestCase):
    def test_duplicate_top_level_member_rejected(self):
        raw = '{"a":1,"a":2}'
        with self.assertRaises(ClaimGateError):
            strict_parse(raw)

    def test_duplicate_nested_member_rejected(self):
        raw = '{"outer":{"x":1,"x":2}}'
        with self.assertRaises(ClaimGateError):
            strict_parse(raw)

    def test_no_false_positive_on_distinct_keys(self):
        raw = '{"a":1,"b":{"a":2,"c":3}}'
        parsed = strict_parse(raw)
        self.assertEqual(parsed, {"a": 1, "b": {"a": 2, "c": 3}})


class StrictJsonParsingTest(unittest.TestCase):
    def test_nan_rejected_lexically(self):
        with self.assertRaises(ClaimGateError):
            strict_parse('{"claimant":NaN}')

    def test_positive_infinity_rejected_lexically(self):
        with self.assertRaises(ClaimGateError):
            strict_parse('{"claimant":Infinity}')

    def test_negative_infinity_rejected_lexically(self):
        with self.assertRaises(ClaimGateError):
            strict_parse('{"claimant":-Infinity}')

    def test_non_object_top_level_rejected(self):
        for raw in ("[]", "null", '"text"', "42"):
            with self.subTest(raw=raw):
                with self.assertRaises(ClaimGateError):
                    strict_parse(raw)


class ClaimantTypeAndRangeTest(unittest.TestCase):
    def test_bool_claimant_rejected(self):
        obj = mutate(claimant=True)
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_negative_claimant_rejected(self):
        obj = mutate(claimant=-1)
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_claimant_equal_to_2_pow_256_rejected(self):
        obj = mutate(claimant=2 ** 256)
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_claimant_max_valid_accepted(self):
        obj = mutate(claimant=2 ** 256 - 1)
        validate_claim_preimage(obj)

    def test_float_claimant_rejected(self):
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(mutate(claimant=42.0))

    def test_string_claimant_rejected(self):
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(mutate(claimant="42"))


class ArtifactHashGrammarTest(unittest.TestCase):
    def test_uppercase_artifact_hash_rejected(self):
        obj = mutate(artifact_hash=VALID["artifact_hash"].upper())
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_sha256_prefixed_artifact_hash_rejected(self):
        obj = mutate(artifact_hash="sha256:" + VALID["artifact_hash"])
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_short_artifact_hash_rejected(self):
        obj = mutate(artifact_hash=VALID["artifact_hash"][:-1])
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)


class AsOfStrictnessTest(unittest.TestCase):
    def test_invalid_calendar_date_rejected(self):
        obj = mutate(as_of="2026-02-30T00:00:00Z")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_month_13_rejected(self):
        obj = mutate(as_of="2026-13-01T00:00:00Z")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_timezone_offset_instead_of_z_rejected(self):
        obj = mutate(as_of="2026-08-04T00:11:24+00:00")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_fractional_seconds_rejected(self):
        obj = mutate(as_of="2026-08-04T00:11:24.000Z")
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)


class ClaimBodyTypeTest(unittest.TestCase):
    def test_null_claim_body_accepted(self):
        obj = mutate(claim_body=None)
        validate_claim_preimage(obj)

    def test_wrong_claim_body_type_rejected(self):
        obj = mutate(claim_body=123)
        with self.assertRaises(ClaimGateError):
            validate_claim_preimage(obj)

    def test_empty_string_claim_body_accepted(self):
        validate_claim_preimage(mutate(claim_body=""))


class CanonicalizationGateTest(unittest.TestCase):
    def test_direct_canonicalizer_invocation_rejects_invalid_input(self):
        with self.assertRaises(ClaimGateError):
            canonicalize_claim_preimage(mutate(extra_field="surprise"))


class CanonicalByteOracleTest(unittest.TestCase):
    def test_synthetic_ascii_oracle(self):
        expected = (
            '{"artifact_hash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",'
            '"artifact_type":"synthetic_assertion","as_of":"2030-01-02T03:04:05Z",'
            '"claim_body":"synthetic-result","claimant":42,'
            '"policy_version":"synthetic.policy.2026-01",'
            '"profile_id":"synthetic.profile.alpha","schema":"crc.claim.v0",'
            '"source_class":"recomputable","verifier_profile":"recompute/synthetic"}'
        ).encode("utf-8")
        actual = canonicalize_claim_preimage(VALID)
        self.assertEqual(actual, expected)
        self.assertEqual(
            claim_id(VALID)[0],
            "sha256:a54e4839100f3786d5ad914f10a1d6387895139d0bdeec597924431d20db4eae",
        )

    def test_unicode_and_escaped_control_character_oracle(self):
        obj = mutate(
            profile_id="synthetic/Δ😀",
            policy_version="policy/β",
            claim_body="line\n\t\bslash\\tail",
            claimant=99,
        )
        expected = (
            '{"artifact_hash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",'
            '"artifact_type":"synthetic_assertion","as_of":"2030-01-02T03:04:05Z",'
            '"claim_body":"line\\n\\t\\bslash\\\\tail","claimant":99,'
            '"policy_version":"policy/β","profile_id":"synthetic/Δ😀",'
            '"schema":"crc.claim.v0","source_class":"recomputable",'
            '"verifier_profile":"recompute/synthetic"}'
        ).encode("utf-8")
        actual = canonicalize_claim_preimage(obj)
        self.assertEqual(actual, expected)
        self.assertEqual(
            claim_id(obj)[0],
            "sha256:090ad7001d32c77a6c07390f125aeea6c43281ce7d2bb88636c92613b0eda3ce",
        )


if __name__ == "__main__":
    unittest.main()
