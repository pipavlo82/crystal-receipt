#!/usr/bin/env python3
"""Independent verifier-challenge-missing-required-input-unverifiable-v0 auditor.

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
PACKAGE = ROOT / "conformance/verifier-challenge-missing-required-input-unverifiable-v0"
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
    if path != ["anchor", "receipt_root"]:
        raise ValueError("mutation path must be anchor.receipt_root only")
    anchor = challenged.get("anchor")
    if not isinstance(anchor, dict):
        raise ValueError("baseline missing anchor object")
    if anchor.get("receipt_root") != mutation["from"]:
        raise ValueError("baseline anchor.receipt_root does not match mutation.from")
    anchor["receipt_root"] = mutation["to"]
    return challenged


def evaluate_vector_semantics(vector: dict) -> None:
    expected = vector["expected"]
    baseline_result = expected["baseline_verification"]
    challenged_result = expected["challenged_verification"]
    assert expected["challenged_must_equal_baseline"] is False
    assert baseline_result != challenged_result, "challenged verification must differ from baseline"
    assert expected["missing_input_cannot_establish_validity"] is True
    assert baseline_result["ok"] is True
    assert baseline_result["receipt_root"] == baseline_result["recomputed_root"]
    assert challenged_result["ok"] is False
    assert challenged_result["receipt_root"] is None
    assert challenged_result["recomputed_root"] is None

    mutation = vector["mutation"]
    assert mutation["to"] is None
    assert mutation["from"] == "0xfe6ee94aed3ee6158c296e2d2d41ab7b31028259a99105c872adb4fdc30196d0"

    classification = vector["field_classification"]
    assert classification["required_decisive_operand"] == ["anchor.receipt_root"]
    assert classification["absent_operand_prevents_comparison"] is True

    profile = vector["receipt_root_profile"]
    assert profile["strip_anchor_rule"] == "entire_top_level_anchor_removed_before_canonicalization"
    assert profile["missing_operand_behavior"] == "return_ok_false_null_roots_without_throw"


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

    vector = json.loads((VECTORS / "V-MISSING-REQUIRED-INPUT.json").read_text(encoding="utf-8"))
    assert vector["vector_id"] == "V-MISSING-REQUIRED-INPUT"
    evaluate_vector_semantics(vector)

    expected_row = f"V-MISSING-REQUIRED-INPUT\t{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n"
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
    assert baseline["anchor"]["receipt_root"] == vector["mutation"]["from"]
    assert challenged["anchor"]["receipt_root"] is None

    baseline_without_anchor = {k: v for k, v in baseline.items() if k != "anchor"}
    challenged_without_anchor = {k: v for k, v in challenged.items() if k != "anchor"}
    assert baseline_without_anchor == challenged_without_anchor

    baseline_anchor = {k: v for k, v in baseline["anchor"].items() if k != "receipt_root"}
    challenged_anchor = {k: v for k, v in challenged["anchor"].items() if k != "receipt_root"}
    assert baseline_anchor == challenged_anchor

    return {
        "auditor": "python-independent-verifier-challenge-missing-required-input-unverifiable-v0",
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
