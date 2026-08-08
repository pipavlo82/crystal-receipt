#!/usr/bin/env python3
"""Independent verifier-challenge-set-v0 aggregate index auditor.

Reads only frozen aggregate and referenced child package files.
Imports no ReceiptOS production code.
Does not execute verifyHandoffReceiptRoot or re-derive child vector semantics.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/verifier-challenge-set-v0"

EXPECTED_CHILD_ORDER = [
    "observed_not_validated",
    "missing_required_input_unverifiable",
    "integrity_mismatch_rejected",
]


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


def child_identity_set_sha256(children: list[dict]) -> str:
    canonical = json.dumps(children, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
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
    assert child["execution_class"] == "production-verifier-binding", package_path


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

    assert contract["set_id"] == "verifier-challenge-set-v0"
    assert contract["version"] == "v0"

    subject = contract["subject_verifier"]
    assert subject["entrypoint"] == "verifyHandoffReceiptRoot"
    assert git_index_blob_oid(subject["module_path"]) == subject["git_blob_oid"]

    children = contract["children"]
    assert len(children) == 3
    for index, child in enumerate(children):
        assert child["ordinal"] == index + 1
        assert child["challenge_id"] == EXPECTED_CHILD_ORDER[index]
        verify_child_package(child)

    aggregate = contract["aggregate"]
    assert aggregate["child_count"] == 3
    assert aggregate["vector_count"] == 3
    assert aggregate["execution_class_counts"] == {"production-verifier-binding": 3}

    identity_hash = child_identity_set_sha256(children)
    assert identity_hash == aggregate["child_identity_set_sha256"]

    return {
        "auditor": "python-independent-verifier-challenge-set-v0",
        "set_id": contract["set_id"],
        "child_count": len(children),
        "vector_count": aggregate["vector_count"],
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
