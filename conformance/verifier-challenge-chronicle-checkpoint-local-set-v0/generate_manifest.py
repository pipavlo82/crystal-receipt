#!/usr/bin/env python3
"""Generate contract.json and manifest.json for verifier-challenge-chronicle-checkpoint-local-set-v0."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0"

CHILDREN = [
    {
        "ordinal": 1,
        "challenge_id": "checkpoint_root_mismatch_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
        "trust_boundary": "stored-root-integrity",
        "vector_count": 1,
        "execution_class": "production-checkpoint-local-binding",
        "fixture_set_sha256": "aa29ca815795af11fb2a0f17f4591ba882bb4513882ad1d0142d192e3b95b1c2",
        "expected_result_set_sha256": "4fe0a2cac4d3c23f233274e5b23a15eb7b9689e3b0e75719588fc41873d8de7d",
    },
    {
        "ordinal": 2,
        "challenge_id": "checkpoint_entry_refs_noncanonical_rejected",
        "package_path": "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
        "trust_boundary": "canonical-entry-ref-order",
        "vector_count": 1,
        "execution_class": "production-checkpoint-local-binding",
        "fixture_set_sha256": "69c3f877c6f7be51d49751141f688af7ab5bf57023da046576402dcbaac7afda",
        "expected_result_set_sha256": "b1d56d206b71790b0f0d53f9c3d38844855125638ec932a30706c67ba40c3964",
    },
]

SUBJECT_LOCAL_CHECKPOINT_VERIFIER = {
    "entrypoint": "verifyChronicleCheckpointV0",
    "module_path": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    "git_blob_oid": "0e790911092546c62344f980e6b611542bcd00fe",
}

NORMATIVE_SPEC_IDENTITY = {
    "repository_path": "docs/CHRONICLE.md",
    "git_blob_oid": "327898f793116681646e424f6a7cfc9f9887f2fb",
}

TRUST_BOUNDARY_MAPPING = {
    "stored-root-integrity": "checkpoint_root_mismatch_rejected",
    "canonical-entry-ref-order": "checkpoint_entry_refs_noncanonical_rejected",
}

EXPECTED_CHILD_IDENTITY_SET_SHA256 = "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28"


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
    raise SystemExit(f"CHRONICLE_CHECKPOINT_LOCAL_CHILD_IDENTITY_MISMATCH: {identity_hash}")

contract = {
    "schema": "verifier_challenge_chronicle_checkpoint_local_set_contract.v0",
    "set_id": "verifier-challenge-chronicle-checkpoint-local-set-v0",
    "version": "v0",
    "subject_local_checkpoint_verifier": SUBJECT_LOCAL_CHECKPOINT_VERIFIER,
    "normative_spec_identity": NORMATIVE_SPEC_IDENTITY,
    "trust_boundary_mapping": TRUST_BOUNDARY_MAPPING,
    "children": CHILDREN,
    "aggregate": {
        "child_count": len(CHILDREN),
        "vector_count": 0,
        "child_vector_count": sum(child["vector_count"] for child in CHILDREN),
        "execution_class_counts": {"production-checkpoint-local-binding": len(CHILDREN)},
        "child_identity_set_recipe": "Ordered children from contract.children encoded as canonical JSON array containing only ordinal, challenge_id, package_path, vector_count, execution_class, fixture_set_sha256, expected_result_set_sha256 (sort_keys=true, compact separators), UTF-8, SHA-256 lowercase hex.",
        "child_identity_set_sha256": identity_hash,
    },
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "independence_scope": {
        "package_identity": "Python and TypeScript auditors recompute aggregate fixture and child-reference digests without production imports.",
        "challenge_semantics": "Child packages remain authoritative for vector semantics; aggregate verifies inventory, order, and declared child digests only.",
        "production_result": "Child production-binding tests remain separate; aggregate binding verifies index references and pinned two-property verifier surface only.",
    },
    "forbidden_semantics": [
        "third_checkpoint_local_challenge",
        "aggregate_vectors",
        "aggregate_expected_result_set",
        "shape_validation",
        "duplicate_entry_ref_prohibition",
        "field_specific_root_mismatch_challenges",
        "collection_verification",
        "portfolio_verification",
        "pairwise_checkpoint_continuity",
        "global_chronicle_chain_continuity",
        "predecessor_discovery",
        "canonical_head_selection",
        "stale_head_semantics",
        "duplicate_replay_detection",
        "equivocation_detection",
        "append_ingest",
        "legal_admissibility",
        "settlement_correctness",
    ],
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

members = [
    "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0/SPEC.md",
]
files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    files.append({"path": path, "sha256": sha256_hex(data)})

contract_hash = sha256_hex((PKG / "contract.json").read_bytes())
files.append({"path": "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = sha256_hex("".join(file_rows).encode("utf-8"))

manifest = {
    "schema": "verifier_challenge_chronicle_checkpoint_local_set_fixture_manifest.v0",
    "set_id": "verifier-challenge-chronicle-checkpoint-local-set-v0",
    "version": "v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
    "child_identity_set_sha256": identity_hash,
    "subject_local_checkpoint_verifier_git_blob_oid": SUBJECT_LOCAL_CHECKPOINT_VERIFIER["git_blob_oid"],
    "normative_spec_git_blob_oid": NORMATIVE_SPEC_IDENTITY["git_blob_oid"],
    "aggregate_vector_count": 0,
    "child_vector_count": 2,
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
