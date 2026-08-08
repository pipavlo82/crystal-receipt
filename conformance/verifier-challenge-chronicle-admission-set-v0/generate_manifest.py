#!/usr/bin/env python3
"""Generate contract.json and manifest.json for verifier-challenge-chronicle-admission-set-v0."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-chronicle-admission-set-v0"

CHILDREN = [
    {
        "ordinal": 1,
        "challenge_id": "proof_root_mismatch_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
        "trust_boundary": "cross-object-consistency",
        "vector_count": 1,
        "execution_class": "production-admission-binding",
        "fixture_set_sha256": "6788b09f29917254a93faf6e85c2d6922fc6fc36995577cb1fd46e6a698ce457",
        "expected_result_set_sha256": "d04a66073a965d19e380beed8426a3cfdccff11ce720244c4d0f5eb6f2a7bf08",
    },
    {
        "ordinal": 2,
        "challenge_id": "proof_object_id_invalid_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0",
        "trust_boundary": "identity-consistency",
        "vector_count": 1,
        "execution_class": "production-admission-binding",
        "fixture_set_sha256": "5a58f5b676699ea0bdb591c5bb92ec5ea2cee451521a093e020c55f9f261f85e",
        "expected_result_set_sha256": "273d04333671345e7c30ea4bd78d668157edf9605d61fe0a4d092c33f64ab1a6",
    },
    {
        "ordinal": 3,
        "challenge_id": "capsule_label_inconsistent_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0",
        "trust_boundary": "reported-state-consistency",
        "vector_count": 1,
        "execution_class": "production-admission-binding",
        "fixture_set_sha256": "7c35e0d99afe34edfe1143de03589ca07dc35aa7c6fdaa320c3d456ac4bc48cf",
        "expected_result_set_sha256": "a0560da2071f483b76bcc8aee3b5c543ae87ef57093a67ff2a18b485be512cc3",
    },
]

SUBJECT_ADMISSION_VERIFIER = {
    "entrypoint": "tryCreateChronicleEntryV0",
    "module_path": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    "git_blob_oid": "0e790911092546c62344f980e6b611542bcd00fe",
}

TRUST_BOUNDARY_MAPPING = {
    "cross-object-consistency": "proof_root_mismatch_rejected",
    "identity-consistency": "proof_object_id_invalid_rejected",
    "reported-state-consistency": "capsule_label_inconsistent_rejected",
}


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

contract = {
    "schema": "verifier_challenge_chronicle_admission_set_contract.v0",
    "set_id": "verifier-challenge-chronicle-admission-set-v0",
    "version": "v0",
    "subject_admission_verifier": SUBJECT_ADMISSION_VERIFIER,
    "trust_boundary_mapping": TRUST_BOUNDARY_MAPPING,
    "children": CHILDREN,
    "aggregate": {
        "child_count": len(CHILDREN),
        "vector_count": sum(child["vector_count"] for child in CHILDREN),
        "execution_class_counts": {"production-admission-binding": len(CHILDREN)},
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
        "new_chronicle_admission_challenge_semantics",
        "fourth_challenge",
        "chronicle_admission_set_completeness",
        "every_admission_reason_code_frozen",
        "timing_semantics",
        "tee_admission",
        "host_error_conformance",
        "semantic_neighbors",
        "dcn",
        "verifier_of_verifier",
        "legal_admissibility",
        "settlement_correctness",
        "aggregate_expected_result_set",
    ],
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

members = [
    "conformance/verifier-challenge-chronicle-admission-set-v0/SPEC.md",
]
files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    files.append({"path": path, "sha256": sha256_hex(data)})

contract_hash = sha256_hex((PKG / "contract.json").read_bytes())
files.append({"path": "conformance/verifier-challenge-chronicle-admission-set-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = sha256_hex("".join(file_rows).encode("utf-8"))

manifest = {
    "schema": "verifier_challenge_chronicle_admission_set_fixture_manifest.v0",
    "set_id": "verifier-challenge-chronicle-admission-set-v0",
    "version": "v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
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
