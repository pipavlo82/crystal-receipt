#!/usr/bin/env python3
"""Independent verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0 auditor.

Reads only frozen package files. Imports no ReceiptOS production code.
Independence scope: package identity + challenge semantic rules.
Does not execute tryCreateChronicleEntryV0.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0"
VECTORS = PACKAGE / "vectors"

VERIFIED_ROOT = "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"


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


def apply_mutation(baseline: dict, mutation: dict) -> dict:
    challenged = json.loads(json.dumps(baseline))
    if mutation["operation"] != "set":
        raise ValueError(f"unsupported mutation operation: {mutation['operation']}")
    path = mutation["path"]
    if path != ["proof_object", "evidence_capsule", "receipt_root", "match"]:
        raise ValueError("mutation path must be proof_object.evidence_capsule.receipt_root.match only")
    proof_object = challenged.get("proof_object")
    if not isinstance(proof_object, dict):
        raise ValueError("baseline missing proof_object object")
    capsule = proof_object.get("evidence_capsule")
    if not isinstance(capsule, dict):
        raise ValueError("baseline missing evidence_capsule object")
    receipt_root = capsule.get("receipt_root")
    if not isinstance(receipt_root, dict):
        raise ValueError("baseline missing receipt_root object")
    if receipt_root.get("match") != mutation["from"]:
        raise ValueError("baseline receipt_root.match does not match mutation.from")
    receipt_root["match"] = mutation["to"]
    return challenged


def evaluate_vector_semantics(vector: dict) -> None:
    expected = vector["expected"]
    baseline_admission = expected["baseline_admission"]
    challenged_admission = expected["challenged_admission"]
    receipt_root_control = expected["receipt_root_control"]

    assert expected["baseline_admitted"] is True
    assert expected["challenged_admitted"] is False
    assert expected["evidence_receipt_verification_unchanged"] is True
    assert expected["evidence_receipt_verification_ok"] is True
    assert expected["proof_object_receipt_root_unchanged"] is True
    assert expected["capsule_stored_root_unchanged"] is True
    assert expected["capsule_computed_root_unchanged"] is True
    assert expected["capsule_match_changed_only"] is True
    assert expected["capsule_status_unchanged"] is True
    assert expected["verifier_result_unchanged"] is True
    assert expected["proof_object_id_unchanged"] is True
    assert expected["proof_ref_unchanged"] is True
    assert expected["cross_object_gates_pass"] is True
    assert expected["reported_state_blocks_admission"] is True
    assert expected["failure_class_exact"] == "reported_state_inconsistency"
    assert expected["reason_code_exact"] == "capsule_label_inconsistent"
    assert expected["non_throwing"] is True

    assert baseline_admission["success"] is True
    assert baseline_admission["value"]["schema"] == "chronicle_entry.v0"
    assert challenged_admission["success"] is False
    assert challenged_admission["failure"]["failure_class"] == "reported_state_inconsistency"
    assert challenged_admission["failure"]["reason_code"] == "capsule_label_inconsistent"

    assert receipt_root_control["ok"] is True
    assert receipt_root_control["receipt_root"] == receipt_root_control["recomputed_root"]
    assert receipt_root_control["receipt_root"] == VERIFIED_ROOT

    mutation = vector["mutation"]
    assert mutation["from"] is True
    assert mutation["to"] is False

    profile = vector["admission_profile"]
    assert profile["challenged_first_failure_gate"] == "capsule_label_inconsistent"

    classification = vector["field_classification"]
    assert classification["unchanged_handoff_evidence"] is True
    assert classification["reported_state_admission_binding"] == [
        "proof_object.evidence_capsule.receipt_root.match"
    ]


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

    vector = json.loads((VECTORS / "V-CHRONICLE-CAPSULE-LABEL-INCONSISTENT.json").read_text(encoding="utf-8"))
    assert vector["vector_id"] == "V-CHRONICLE-CAPSULE-LABEL-INCONSISTENT"
    assert vector["execution_class"] == "production-admission-binding"
    evaluate_vector_semantics(vector)

    expected_row = (
        f"V-CHRONICLE-CAPSULE-LABEL-INCONSISTENT\t"
        f"{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n"
    )
    result_hash = sha256_hex(expected_row.encode("utf-8"))
    assert result_hash == contract["expected_result_set_sha256"]

    assert (
        git_index_blob_oid(str(vector["source_fixture"]["repository_path"]))
        == vector["source_fixture"]["git_blob_oid"]
    )
    assert (
        git_index_blob_oid(str(vector["subject_admission_verifier"]["module_path"]))
        == vector["subject_admission_verifier"]["git_blob_oid"]
    )
    assert (
        git_index_blob_oid(str(vector["identity_control_authority"]["module_path"]))
        == vector["identity_control_authority"]["git_blob_oid"]
    )
    profile = vector["admission_profile"]
    assert (
        git_index_blob_oid(str(profile["receipt_root_recomputation_module_path"]))
        == profile["receipt_root_recomputation_module_git_blob_oid"]
    )

    source_fixture = json.loads((ROOT / vector["source_fixture"]["repository_path"]).read_bytes().decode("utf-8"))
    baseline_input = source_fixture["input"]
    challenged_input = apply_mutation(baseline_input, vector["mutation"])

    assert baseline_input["evidence"] == challenged_input["evidence"]
    assert baseline_input["options"] == challenged_input["options"]
    assert baseline_input["proof_object"]["receipt_root"] == challenged_input["proof_object"]["receipt_root"]
    assert baseline_input["proof_object"]["proof_object_id"] == challenged_input["proof_object"]["proof_object_id"]
    assert baseline_input["proof_object"]["proof_ref"] == challenged_input["proof_object"]["proof_ref"]
    assert (
        baseline_input["proof_object"]["evidence_capsule"]["verifier_result"]
        == challenged_input["proof_object"]["evidence_capsule"]["verifier_result"]
    )

    baseline_capsule_root = baseline_input["proof_object"]["evidence_capsule"]["receipt_root"]
    challenged_capsule_root = challenged_input["proof_object"]["evidence_capsule"]["receipt_root"]
    assert baseline_capsule_root["stored"] == challenged_capsule_root["stored"] == VERIFIED_ROOT
    assert baseline_capsule_root["computed"] == challenged_capsule_root["computed"] == VERIFIED_ROOT
    assert baseline_capsule_root["status"] == challenged_capsule_root["status"] == "verified"
    assert baseline_capsule_root["match"] is True
    assert challenged_capsule_root["match"] is False

    baseline_without_match = json.loads(json.dumps(baseline_input))
    challenged_without_match = json.loads(json.dumps(challenged_input))
    baseline_without_match["proof_object"]["evidence_capsule"]["receipt_root"] = {
        k: v
        for k, v in baseline_without_match["proof_object"]["evidence_capsule"]["receipt_root"].items()
        if k != "match"
    }
    challenged_without_match["proof_object"]["evidence_capsule"]["receipt_root"] = {
        k: v
        for k, v in challenged_without_match["proof_object"]["evidence_capsule"]["receipt_root"].items()
        if k != "match"
    }
    assert baseline_without_match == challenged_without_match

    return {
        "auditor": "python-independent-verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0",
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
