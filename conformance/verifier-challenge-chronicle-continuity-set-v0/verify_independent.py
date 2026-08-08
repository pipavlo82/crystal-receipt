#!/usr/bin/env python3
"""Independent verifier-challenge-chronicle-continuity-set-v0 aggregate index auditor.

Reads only frozen aggregate and referenced child package files.
Imports no ReceiptOS production code.
Does not execute evaluateChronicleCheckpointContinuityV0 or re-derive child vector semantics.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-chronicle-continuity-set-v0"

EXPECTED_CHILD_ORDER = [
    "predecessor_unknown_unverifiable",
    "predecessor_ref_mismatch_rejected",
    "sequence_gap_rejected",
]

EXPECTED_TRUST_BOUNDARIES = [
    "predecessor-availability / epistemic-unverifiability",
    "predecessor-reference-binding",
    "sequence-adjacency",
]

EXPECTED_GATES = [4, 7, 8]

EXPECTED_TRUST_BOUNDARY_MAPPING = {
    "predecessor-availability / epistemic-unverifiability": "predecessor_unknown_unverifiable",
    "predecessor-reference-binding": "predecessor_ref_mismatch_rejected",
    "sequence-adjacency": "sequence_gap_rejected",
}

EXPECTED_CHILD_IDENTITY_SET_SHA256 = "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_index_blob_oid(repository_path: str) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", f":{repository_path}"],
            cwd=ROOT,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as error:
        raise ValueError(f"untracked or unresolved git blob identity: {repository_path}") from error


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


def verify_child_package(child: dict) -> None:
    package_path = child["package_path"]
    child_root = ROOT / package_path
    assert child_root.is_dir(), f"missing child package {package_path}"
    manifest = json.loads((child_root / "manifest.json").read_text(encoding="utf-8"))
    contract = json.loads((child_root / "contract.json").read_text(encoding="utf-8"))
    assert manifest["fixture_set_sha256"] == child["fixture_set_sha256"], package_path
    assert contract["expected_result_set_sha256"] == child["expected_result_set_sha256"], package_path
    assert child["vector_count"] == 1, package_path
    assert child["execution_class"] == "production-continuity-binding", package_path


def audit_package() -> dict:
    assert not (PACKAGE / "vectors").exists(), "aggregate must not define vectors/"
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    assert manifest["file_count"] == len(manifest["files"]) == 2, "frozen member inventory"
    rows: list[str] = []
    for file in manifest["files"]:
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        assert actual == file["sha256"], file["path"]
        rows.append(f'{file["path"]}\t{actual}\n')
    fixture_hash = sha256_hex("".join(rows).encode("utf-8"))
    assert fixture_hash == manifest["fixture_set_sha256"]

    assert contract["set_id"] == "verifier-challenge-chronicle-continuity-set-v0"
    assert contract["version"] == "v0"
    assert "expected_result_set_sha256" not in contract, "aggregate must not define expected_result_set_sha256"

    subject = contract["subject_continuity_evaluator"]
    assert subject["entrypoint"] == "evaluateChronicleCheckpointContinuityV0"
    assert git_index_blob_oid(subject["module_path"]) == subject["git_blob_oid"]
    assert manifest["subject_continuity_evaluator_git_blob_oid"] == subject["git_blob_oid"]

    assert contract["trust_boundary_mapping"] == EXPECTED_TRUST_BOUNDARY_MAPPING

    children = contract["children"]
    assert len(children) == 3
    for index, child in enumerate(children):
        assert child["ordinal"] == index + 1
        assert child["challenge_id"] == EXPECTED_CHILD_ORDER[index]
        assert child["trust_boundary"] == EXPECTED_TRUST_BOUNDARIES[index]
        assert child["gate"] == EXPECTED_GATES[index]
        verify_child_package(child)

    aggregate = contract["aggregate"]
    assert aggregate["child_count"] == 3
    assert aggregate["vector_count"] == 0
    assert aggregate["child_vector_count"] == 3
    assert aggregate["execution_class_counts"] == {"production-continuity-binding": 3}
    assert manifest["aggregate_vector_count"] == 0
    assert manifest["child_vector_count"] == 3

    identity_hash = child_identity_set_sha256(children)
    assert identity_hash == EXPECTED_CHILD_IDENTITY_SET_SHA256, "child identity set digest"
    assert identity_hash == aggregate["child_identity_set_sha256"]
    assert identity_hash == manifest["child_identity_set_sha256"]

    return {
        "auditor": "python-independent-verifier-challenge-chronicle-continuity-set-v0",
        "set_id": contract["set_id"],
        "child_count": len(children),
        "vector_count": aggregate["vector_count"],
        "child_vector_count": aggregate["child_vector_count"],
        "package_inventory_count": manifest["file_count"],
        "fixture_set_sha256": fixture_hash,
        "child_identity_set_sha256": identity_hash,
        "execution_class_counts": aggregate["execution_class_counts"],
        "independence_scope": contract["independence_scope"],
        "production_imports": 0,
    }


def main() -> int:
    try:
        report = audit_package()
        print(json.dumps(report, indent=2))
        return 0
    except Exception as error:
        print(f"verification failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
