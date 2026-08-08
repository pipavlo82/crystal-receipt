#!/usr/bin/env python3
"""Independent verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0 auditor.

Reads only frozen package files. Imports no ReceiptOS production code.
Independence scope: package identity + challenge semantic rules.
Does not execute evaluateChronicleCheckpointContinuityV0.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0"
VECTORS = PACKAGE / "vectors"


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


def find_fixture_vector(fixture: dict, name: str) -> dict:
    for vector in fixture["vectors"]:
        if vector["name"] == name:
            return vector
    raise ValueError(f"fixture vector not found: {name}")


def evaluate_vector_semantics(vector: dict) -> None:
    expected = vector["expected"]
    baseline_continuity = expected["baseline_continuity"]
    challenged_continuity = expected["challenged_continuity"]

    assert expected["baseline_evaluation_state"] == "evaluated"
    assert expected["baseline_verdict"] == "valid"
    assert expected["baseline_relation"] == "successor"
    assert expected["baseline_reason_code"] == "direct_successor"
    assert expected["challenged_evaluation_state"] == "unverifiable"
    assert expected["challenged_verdict"] is None
    assert expected["challenged_relation"] is None
    assert expected["challenged_reason_code"] == "predecessor_unknown"
    assert expected["current_checkpoint_unchanged"] is True
    assert expected["current_checkpoint_locally_valid"] is True
    assert expected["current_is_non_genesis"] is True
    assert expected["predecessor_argument_removed_only"] is True
    assert expected["missing_predecessor_blocks_evaluation"] is True
    assert expected["missing_predecessor_does_not_imply_invalid"] is True
    assert expected["predecessor_ref_gate_not_reached"] is True
    assert expected["sequence_gate_not_reached"] is True
    assert expected["non_throwing"] is True

    assert baseline_continuity == {
        "evaluation_state": "evaluated",
        "verdict": "valid",
        "relation": "successor",
        "reason_code": "direct_successor",
    }
    assert challenged_continuity == {
        "evaluation_state": "unverifiable",
        "verdict": None,
        "relation": None,
        "reason_code": "predecessor_unknown",
    }

    profile = vector["continuity_profile"]
    assert profile["challenged_first_failure_gate"] == "predecessor_unknown"

    classification = vector["field_classification"]
    assert classification["predecessor_argument_removed_only"] is True
    assert classification["current_checkpoint_unchanged"] is True


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

    vector = json.loads((VECTORS / "V-CHRONICLE-PREDECESSOR-UNKNOWN.json").read_text(encoding="utf-8"))
    assert vector["vector_id"] == "V-CHRONICLE-PREDECESSOR-UNKNOWN"
    assert vector["execution_class"] == "production-continuity-binding"
    evaluate_vector_semantics(vector)

    expected_row = (
        f"V-CHRONICLE-PREDECESSOR-UNKNOWN\t"
        f"{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n"
    )
    result_hash = sha256_hex(expected_row.encode("utf-8"))
    assert result_hash == contract["expected_result_set_sha256"]

    source_fixture = vector["source_fixture"]
    assert git_index_blob_oid(str(source_fixture["repository_path"])) == source_fixture["git_blob_oid"]
    assert (
        git_index_blob_oid(str(vector["subject_continuity_evaluator"]["module_path"]))
        == vector["subject_continuity_evaluator"]["git_blob_oid"]
    )
    assert (
        git_index_blob_oid(str(vector["local_checkpoint_verifier"]["module_path"]))
        == vector["local_checkpoint_verifier"]["git_blob_oid"]
    )
    profile = vector["continuity_profile"]
    assert git_index_blob_oid(str(profile["normative_spec_path"])) == profile["normative_spec_git_blob_oid"]

    fixture = json.loads((ROOT / source_fixture["repository_path"]).read_bytes().decode("utf-8"))
    baseline_vector = find_fixture_vector(fixture, source_fixture["baseline_vector_name"])

    assert vector["baseline_pair"]["current"] == baseline_vector["current"]
    assert vector["baseline_pair"]["predecessor"] == baseline_vector["predecessor"]
    assert vector["challenged_pair"]["current"] == baseline_vector["current"]
    assert vector["challenged_pair"]["predecessor"] is None

    assert vector["baseline_pair"]["current"] == vector["challenged_pair"]["current"]
    assert vector["baseline_pair"]["predecessor"] is not None
    assert vector["challenged_pair"]["predecessor"] is None
    assert vector["substitution"]["operation"] == "remove_predecessor_argument"
    assert vector["substitution"]["to"] is None

    current = vector["baseline_pair"]["current"]
    assert current["sequence"] > 0

    controls = vector["local_verification_controls"]
    for key in ("current", "baseline_predecessor"):
        control = controls[key]
        assert control["ok"] is True
        assert control["checkpoint_root"] == control["recomputed_checkpoint_root"]

    return {
        "auditor": "python-independent-verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
        "vector_count": 1,
        "package_inventory_count": manifest["file_count"],
        "fixture_set_sha256": fixture_hash,
        "expected_result_set_sha256": result_hash,
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
