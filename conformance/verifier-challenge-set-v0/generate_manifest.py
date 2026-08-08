#!/usr/bin/env python3
"""Generate contract.json and manifest.json for verifier-challenge-set-v0."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-set-v0"

CHILDREN = [
    {
        "ordinal": 1,
        "challenge_id": "observed_not_validated",
        "package_path": "conformance/verifier-challenge-observed-not-validated-v0",
        "vector_count": 1,
        "execution_class": "production-verifier-binding",
        "fixture_set_sha256": "efeb64c3cc3809d604145ad7436a481baffd7aa9bdd798a1ddf2c1e5e38ae33f",
        "expected_result_set_sha256": "0979570c534e3808ac3d5a951902564e33b1a58f3263f1da45ceb344d0e85514",
    },
    {
        "ordinal": 2,
        "challenge_id": "missing_required_input_unverifiable",
        "package_path": "conformance/verifier-challenge-missing-required-input-unverifiable-v0",
        "vector_count": 1,
        "execution_class": "production-verifier-binding",
        "fixture_set_sha256": "525bed2d6b2dcd735be96b3faba11c045a24a24189787ce8d5d398b3def23e04",
        "expected_result_set_sha256": "7e32bc856b317574d38c8d036c5a352bb83b4f2a04c00ed4e52de53b378a2184",
    },
    {
        "ordinal": 3,
        "challenge_id": "integrity_mismatch_rejected",
        "package_path": "conformance/verifier-challenge-integrity-mismatch-rejected-v0",
        "vector_count": 1,
        "execution_class": "production-verifier-binding",
        "fixture_set_sha256": "6844b0554d71bee8c650fcc949e23f730980d75d22a8483f1c4f50e722de941d",
        "expected_result_set_sha256": "b755108edac9dc607b7b6b7f30d845f381cac13100194741a451b1c7cb7162a5",
    },
]

SUBJECT_VERIFIER = {
    "entrypoint": "verifyHandoffReceiptRoot",
    "module_path": "src/receiptos/verify/verify-receipt.ts",
    "git_blob_oid": "2e2e45bf30529de93eac58a04465f17ef81edeaa",
}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def child_identity_set_sha256(children: list[dict]) -> str:
    canonical = json.dumps(children, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
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
    "schema": "verifier_challenge_set_contract.v0",
    "set_id": "verifier-challenge-set-v0",
    "version": "v0",
    "subject_verifier": SUBJECT_VERIFIER,
    "children": CHILDREN,
    "aggregate": {
        "child_count": len(CHILDREN),
        "vector_count": sum(child["vector_count"] for child in CHILDREN),
        "execution_class_counts": {"production-verifier-binding": len(CHILDREN)},
        "child_identity_set_recipe": "Ordered children from contract.children encoded as canonical JSON array (sort_keys=true, compact separators), UTF-8, SHA-256 lowercase hex.",
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
        "new_verifier_challenge_semantics",
        "fourth_challenge",
        "verifier_challenge_set_completeness",
        "timing_semantics",
        "chronicle_admission",
        "tee_verifier_surfaces",
        "host_error_conformance",
        "semantic_neighbors",
        "dcn",
        "verifier_of_verifier",
        "general_schema_validation",
        "full_tamper_proofing",
    ],
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

members = [
    "conformance/verifier-challenge-set-v0/SPEC.md",
]
files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    files.append({"path": path, "sha256": sha256_hex(data)})

contract_hash = sha256_hex((PKG / "contract.json").read_bytes())
files.append({"path": "conformance/verifier-challenge-set-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = sha256_hex("".join(file_rows).encode("utf-8"))

manifest = {
    "schema": "verifier_challenge_set_fixture_manifest.v0",
    "set_id": "verifier-challenge-set-v0",
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
