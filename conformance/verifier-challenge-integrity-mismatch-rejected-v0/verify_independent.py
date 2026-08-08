#!/usr/bin/env python3
"""Independent verifier-challenge-integrity-mismatch-rejected-v0 auditor.

Reads only frozen package files. Imports no ReceiptOS production code.
Independence scope: package identity + challenge semantic rules.
Does not recompute verifyHandoffReceiptRoot results.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-integrity-mismatch-rejected-v0"
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


def apply_mutation(baseline: dict, mutation: dict) -> dict:
    challenged = json.loads(json.dumps(baseline))
    if mutation["operation"] != "set":
        raise ValueError(f"unsupported mutation operation: {mutation['operation']}")
    path = mutation["path"]
    if path != ["task", "title"]:
        raise ValueError("mutation path must be task.title only")
    task = challenged.get("task")
    if not isinstance(task, dict):
        raise ValueError("baseline missing task object")
    if task.get("title") != mutation["from"]:
        raise ValueError("baseline task.title does not match mutation.from")
    task["title"] = mutation["to"]
    return challenged


def evaluate_vector_semantics(vector: dict) -> None:
    expected = vector["expected"]
    baseline_result = expected["baseline_verification"]
    challenged_result = expected["challenged_verification"]
    assert expected["challenged_must_equal_baseline"] is False
    assert baseline_result != challenged_result
    assert expected["integrity_mismatch_cannot_retain_validity"] is True
    assert expected["anchor_receipt_root_unchanged"] is True
    assert expected["recomputed_root_must_differ_from_anchor_root"] is True
    assert expected["challenged_ok_must_be_false"] is True
    assert expected["non_throwing"] is True
    assert baseline_result["ok"] is True
    assert baseline_result["receipt_root"] == baseline_result["recomputed_root"]
    assert challenged_result["ok"] is False
    assert challenged_result["receipt_root"] == baseline_result["receipt_root"]
    assert challenged_result["recomputed_root"] != challenged_result["receipt_root"]
    assert challenged_result["receipt_root"] is not None
    assert challenged_result["recomputed_root"] is not None

    mutation = vector["mutation"]
    assert mutation["from"] == "CYPHES workflow proof boundary sample"
    assert mutation["to"] == "CYPHES workflow proof boundary sample (tampered)"

    classification = vector["field_classification"]
    assert classification["decisive_receipt_body_fields"] == ["task.title"]
    assert classification["required_comparison_operand"] == ["anchor.receipt_root"]
    assert classification["excluded_from_recomputation"] == ["anchor"]

    profile = vector["receipt_root_profile"]
    assert profile["strip_anchor_rule"] == "entire_top_level_anchor_removed_before_canonicalization"


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

    vector = json.loads((VECTORS / "V-INTEGRITY-MISMATCH.json").read_text(encoding="utf-8"))
    assert vector["vector_id"] == "V-INTEGRITY-MISMATCH"
    evaluate_vector_semantics(vector)

    expected_row = f"V-INTEGRITY-MISMATCH\t{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n"
    result_hash = sha256_hex(expected_row.encode("utf-8"))
    assert result_hash == contract["expected_result_set_sha256"]

    assert (
        git_index_blob_oid(str(vector["source_fixture"]["repository_path"]))
        == vector["source_fixture"]["git_blob_oid"]
    )
    assert (
        git_index_blob_oid(str(vector["subject_verifier"]["module_path"]))
        == vector["subject_verifier"]["git_blob_oid"]
    )
    profile = vector["receipt_root_profile"]
    assert (
        git_index_blob_oid(str(profile["receipt_root_module_path"]))
        == profile["receipt_root_module_git_blob_oid"]
    )
    assert (
        git_index_blob_oid(str(profile["canonicalization_module_path"]))
        == profile["canonicalization_module_git_blob_oid"]
    )

    baseline = json.loads((ROOT / vector["source_fixture"]["repository_path"]).read_bytes().decode("utf-8"))
    challenged = apply_mutation(baseline, vector["mutation"])
    assert baseline["task"]["title"] == vector["mutation"]["from"]
    assert challenged["task"]["title"] == vector["mutation"]["to"]
    assert baseline["anchor"]["receipt_root"] == challenged["anchor"]["receipt_root"]

    baseline_without_task_title = json.loads(json.dumps(baseline))
    challenged_without_task_title = json.loads(json.dumps(challenged))
    baseline_without_task_title["task"] = {
        k: v for k, v in baseline_without_task_title["task"].items() if k != "title"
    }
    challenged_without_task_title["task"] = {
        k: v for k, v in challenged_without_task_title["task"].items() if k != "title"
    }
    assert baseline_without_task_title == challenged_without_task_title

    return {
        "auditor": "python-independent-verifier-challenge-integrity-mismatch-rejected-v0",
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
