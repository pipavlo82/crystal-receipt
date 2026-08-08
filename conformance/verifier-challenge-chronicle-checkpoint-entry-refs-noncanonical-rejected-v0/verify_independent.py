#!/usr/bin/env python3
"""Independent verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0 auditor.

Reads only frozen package files. Imports no ReceiptOS production code.
Independence scope: package identity + challenge semantic rules.
Does not execute verifyChronicleCheckpointV0.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0"
VECTORS = PACKAGE / "vectors"
VECTOR_ID = "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL"


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


def canonical_expected(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def sort_entry_refs(entry_refs: list[str]) -> list[str]:
    return sorted(entry_refs)


def evaluate_vector_semantics(vector: dict) -> None:
    expected = vector["expected"]
    baseline_verification = expected["baseline_verification"]
    challenged_verification = expected["challenged_verification"]

    assert expected["baseline_local_verification_ok"] is True
    assert expected["challenged_local_verification_ok"] is False
    assert expected["baseline_entry_refs_canonical"] is True
    assert expected["challenged_entry_refs_canonical"] is False
    assert expected["entry_ref_values_unchanged"] is True
    assert expected["entry_ref_multiset_unchanged"] is True
    assert expected["entry_refs_order_changed_only"] is True
    assert expected["checkpoint_root_field_unchanged"] is True
    assert expected["challenged_recomputed_root_differs_from_stored"] is True
    assert expected["non_throwing"] is True

    assert baseline_verification == {
        "ok": True,
        "checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87",
        "recomputed_checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87",
    }
    assert challenged_verification == {
        "ok": False,
        "checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87",
        "recomputed_checkpoint_root": "sha256:96cb15f8241b1e89bef34c088560d55cb75e600b53adaf6a35215225621db866",
    }

    baseline = vector["baseline_checkpoint"]
    challenged = vector["challenged_checkpoint"]
    substitution = vector["substitution"]

    assert baseline["entry_refs"] == substitution["baseline_entry_refs"]
    assert challenged["entry_refs"] == substitution["challenged_entry_refs"]
    assert sorted(baseline["entry_refs"]) == sorted(challenged["entry_refs"])
    assert baseline["entry_refs"] != challenged["entry_refs"]
    assert baseline["checkpoint_root"] == challenged["checkpoint_root"]

    canonical_baseline = sort_entry_refs(baseline["entry_refs"])
    canonical_challenged = sort_entry_refs(challenged["entry_refs"])
    assert baseline["entry_refs"] == canonical_baseline
    assert challenged["entry_refs"] != canonical_challenged
    assert canonical_challenged == canonical_baseline

    for field in substitution["unchanged_fields"]:
        assert baseline[field] == challenged[field], field

    profile = vector["local_verification_profile"]
    assert profile["ok_requires_both"] is True
    assert "explicit canonical stored-order check" in profile["verification_mechanism"][0]


def audit_package() -> dict:
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    assert manifest["file_count"] == len(manifest["files"])
    rows: list[str] = []
    for file in manifest["files"]:
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        assert actual == file["sha256"], file["path"]
        rows.append(f'{file["path"]}\t{actual}\n')
    fixture_hash = sha256_hex("".join(rows).encode("utf-8"))
    assert fixture_hash == manifest["fixture_set_sha256"]

    vector = json.loads((VECTORS / f"{VECTOR_ID}.json").read_text(encoding="utf-8"))
    assert vector["vector_id"] == VECTOR_ID
    assert vector["execution_class"] == "production-checkpoint-local-binding"
    evaluate_vector_semantics(vector)

    expected_row = (
        f"{VECTOR_ID}\t"
        f"{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n"
    )
    result_hash = sha256_hex(expected_row.encode("utf-8"))
    assert result_hash == contract["expected_result_set_sha256"]

    subject = vector["subject_local_checkpoint_verifier"]
    assert git_index_blob_oid(str(subject["module_path"])) == subject["git_blob_oid"]
    construction = vector["checkpoint_construction_authority"]
    assert git_index_blob_oid(str(construction["module_path"])) == construction["git_blob_oid"]

    profile = vector["local_verification_profile"]
    assert git_index_blob_oid(str(profile["normative_spec_path"])) == profile["normative_spec_git_blob_oid"]
    assert git_index_blob_oid(str(contract["local_checkpoint_verifier"]["module_path"])) == contract["local_checkpoint_verifier"]["git_blob_oid"]
    assert git_index_blob_oid(str(contract["normative_spec_identity"]["repository_path"])) == contract["normative_spec_identity"]["git_blob_oid"]

    return {
        "auditor": "python-independent-verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
        "vector_count": 1,
        "package_inventory_count": manifest["file_count"],
        "fixture_set_sha256": fixture_hash,
        "expected_result_set_sha256": result_hash,
        "execution_class_counts": {"production-checkpoint-local-binding": 1},
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
