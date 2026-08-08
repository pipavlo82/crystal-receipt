#!/usr/bin/env python3
"""Generate contract.json and manifest.json for verifier-challenge-chronicle-continuity-set-v0."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-chronicle-continuity-set-v0"

CHILDREN = [
    {
        "ordinal": 1,
        "challenge_id": "predecessor_unknown_unverifiable",
        "package_path": "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
        "trust_boundary": "predecessor-availability / epistemic-unverifiability",
        "gate": 4,
        "vector_count": 1,
        "execution_class": "production-continuity-binding",
        "fixture_set_sha256": "e7a45ad8aa0d81fd0146212f545a7ae15e0645f40345cd2e1ca9f67e4b2b0128",
        "expected_result_set_sha256": "772efdfc67d8d018c5d0b3ab8b7ec45f44266b9c44e55b77a4215a4230779e93",
    },
    {
        "ordinal": 2,
        "challenge_id": "predecessor_ref_mismatch_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
        "trust_boundary": "predecessor-reference-binding",
        "gate": 7,
        "vector_count": 1,
        "execution_class": "production-continuity-binding",
        "fixture_set_sha256": "88a372217a30759262127f21b45a6470837d5c3275baa0718cd2fc99fd85cc5c",
        "expected_result_set_sha256": "a7108e666496a9d32bc0b2e490bddf5a1df51ffd5d04263321ee907c880298b9",
    },
    {
        "ordinal": 3,
        "challenge_id": "sequence_gap_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0",
        "trust_boundary": "sequence-adjacency",
        "gate": 8,
        "vector_count": 1,
        "execution_class": "production-continuity-binding",
        "fixture_set_sha256": "3fa071610dea0e06ece35349aa6b6df3da7955b6e8eea9eeb78a2a3be007ea0c",
        "expected_result_set_sha256": "0484c8dde064a5002d07243bb7fdc964e8c680756db14ac65a794eeab8788bce",
    },
]

SUBJECT_CONTINUITY_EVALUATOR = {
    "entrypoint": "evaluateChronicleCheckpointContinuityV0",
    "module_path": "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
    "git_blob_oid": "428923f10aac54bfaaebedfad494118cbb17d744",
}

TRUST_BOUNDARY_MAPPING = {
    "predecessor-availability / epistemic-unverifiability": "predecessor_unknown_unverifiable",
    "predecessor-reference-binding": "predecessor_ref_mismatch_rejected",
    "sequence-adjacency": "sequence_gap_rejected",
}

EXPECTED_CHILD_IDENTITY_SET_SHA256 = "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def child_identity_records(children: list[dict]) -> list[dict]:
    return [
        {
            "ordinal": child["ordinal"],
            "challenge_id": child["challenge_id"],
            "package_path": child["package_path"],
            "vector_count": child["vector_count"],
            "execution_class": child["execution_class"],
            "fixture_set_sha256": child["fixture_set_sha256"],
            "expected_result_set_sha256": child["expected_result_set_sha256"],
        }
        for child in children
    ]


def child_identity_set_sha256(children: list[dict]) -> str:
    canonical = json.dumps(child_identity_records(children), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return sha256_hex(canonical.encode("utf-8"))


def verify_live_child_digests(children: list[dict]) -> None:
    for child in children:
        manifest = json.loads((ROOT / child["package_path"] / "manifest.json").read_text(encoding="utf-8"))
        contract = json.loads((ROOT / child["package_path"] / "contract.json").read_text(encoding="utf-8"))
        assert manifest["fixture_set_sha256"] == child["fixture_set_sha256"], child["challenge_id"]
        assert contract["expected_result_set_sha256"] == child["expected_result_set_sha256"], child["challenge_id"]


verify_live_child_digests(CHILDREN)
identity_hash = child_identity_set_sha256(CHILDREN)
if identity_hash != EXPECTED_CHILD_IDENTITY_SET_SHA256:
    raise SystemExit(f"CHRONICLE_CONTINUITY_CHILD_IDENTITY_MISMATCH: {identity_hash}")

contract = {
    "schema": "verifier_challenge_chronicle_continuity_set_contract.v0",
    "set_id": "verifier-challenge-chronicle-continuity-set-v0",
    "version": "v0",
    "subject_continuity_evaluator": SUBJECT_CONTINUITY_EVALUATOR,
    "trust_boundary_mapping": TRUST_BOUNDARY_MAPPING,
    "children": CHILDREN,
    "aggregate": {
        "child_count": len(CHILDREN),
        "vector_count": 0,
        "child_vector_count": sum(child["vector_count"] for child in CHILDREN),
        "execution_class_counts": {"production-continuity-binding": len(CHILDREN)},
        "child_identity_set_recipe": "Ordered children from contract.children encoded as canonical JSON array containing only ordinal, challenge_id, package_path, vector_count, execution_class, fixture_set_sha256, expected_result_set_sha256 (sort_keys=true, compact separators), UTF-8, SHA-256 lowercase hex.",
        "child_identity_set_sha256": identity_hash,
    },
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "independence_scope": {
        "package_identity": "Python and TypeScript auditors recompute aggregate fixture and child-reference digests without production imports.",
        "challenge_semantics": "Child packages remain authoritative for vector semantics; aggregate verifies inventory, order, and declared child digests only.",
        "production_result": "Child production-binding tests remain separate; aggregate binding verifies index references only.",
    },
    "forbidden_semantics": [
        "fourth_continuity_challenge",
        "aggregate_vectors",
        "aggregate_expected_result_set",
        "global_chronicle_chain_continuity",
        "full_history_validation",
        "predecessor_discovery",
        "append_ingest_correctness",
        "stale_head_semantics",
        "freshness_semantics",
        "duplicate_replay_detection",
        "equivocation_detection",
        "malformed_state_closure",
        "not_evaluated_state_closure",
        "all_reason_codes_individually_frozen",
        "chronicle_admission",
        "receipt_root_verification",
        "rsf_semantics",
        "counterfactual_semantics",
        "legal_admissibility",
        "settlement_correctness",
    ],
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

members = [
    "conformance/verifier-challenge-chronicle-continuity-set-v0/SPEC.md",
]
files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    files.append({"path": path, "sha256": sha256_hex(data)})

contract_hash = sha256_hex((PKG / "contract.json").read_bytes())
files.append({"path": "conformance/verifier-challenge-chronicle-continuity-set-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = sha256_hex("".join(file_rows).encode("utf-8"))

manifest = {
    "schema": "verifier_challenge_chronicle_continuity_set_fixture_manifest.v0",
    "set_id": "verifier-challenge-chronicle-continuity-set-v0",
    "version": "v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
    "child_identity_set_sha256": identity_hash,
    "subject_continuity_evaluator_git_blob_oid": SUBJECT_CONTINUITY_EVALUATOR["git_blob_oid"],
    "aggregate_vector_count": 0,
    "child_vector_count": 3,
}
(PKG / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(
    json.dumps(
        {
            "fixture_set_sha256": fixture_hash,
            "child_identity_set_sha256": identity_hash,
            "file_count": len(files),
        },
        indent=2,
    )
)
