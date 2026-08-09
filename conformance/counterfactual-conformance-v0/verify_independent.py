#!/usr/bin/env python3
"""Independent Counterfactual Conformance v0 umbrella package auditor.

Verifies umbrella contract/manifest structure, child inventory, child-identity-set
digest, required package digests, DCN canonical preimage / Lane B SHA-256, and
closed file inventory without importing ReceiptOS production TypeScript.
Does not execute production subjects.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/counterfactual-conformance-v0"
PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
EXPECTED_CHILD_IDENTITY_SET_SHA256 = "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47"
EXPECTED_FIXTURE_SET_SHA256 = "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a"
EXPECTED_VECTOR_IDS = [
    "V-OBSERVED-NOT-VALIDATED",
    "V-MISSING-REQUIRED-INPUT",
    "V-INTEGRITY-MISMATCH",
    "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    "V-CHRONICLE-SEQUENCE-GAP",
    "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
    "V-AT-NEST-OBJ",
    "V-MAN-HASH-DIFF",
]
CHILD_IDENTITY_FIELDS = [
    "ordinal",
    "challenge_id",
    "package_path",
    "package_version",
    "vector_id",
    "surface",
    "vector_path",
    "execution_class",
    "fixture_set_sha256",
    "expected_result_set_sha256",
]
CLOSED_INVENTORY = {
    "SPEC.md",
    "contract.json",
    "manifest.json",
    "dcn/neighborhood.json",
    "generate_package.ts",
    "verify_independent.py",
    "audit_package.ts",
}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value) -> str:
    """Match TypeScript canonicalIdentityJson / aggregate auditors."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        raise ValueError("floats are rejected")
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return "{" + ",".join(
            f"{json.dumps(key, ensure_ascii=False)}:{canonical_json(value[key])}" for key in keys
        ) + "}"
    raise ValueError(f"unsupported type {type(value)}")


def child_identity_set_sha256(children: list[dict]) -> str:
    projected = [{field: child[field] for field in CHILD_IDENTITY_FIELDS} for child in children]
    return sha256_hex(canonical_json(projected).encode("utf-8"))


def verify_child_package(child: dict) -> None:
    package_path = child["package_path"]
    child_root = ROOT / package_path
    assert child_root.is_dir(), f"missing child package {package_path}"
    manifest = json.loads((child_root / "manifest.json").read_text(encoding="utf-8"))
    contract = json.loads((child_root / "contract.json").read_text(encoding="utf-8"))
    assert manifest["fixture_set_sha256"] == child["fixture_set_sha256"], package_path
    assert contract["expected_result_set_sha256"] == child["expected_result_set_sha256"], package_path
    vector_path = ROOT / child["vector_path"]
    assert vector_path.is_file(), child["vector_path"]
    vector = json.loads(vector_path.read_text(encoding="utf-8"))
    assert vector["vector_id"] == child["vector_id"]
    assert vector["package_version"] == child["package_version"]


def audit_package() -> dict:
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    assert manifest["file_count"] == len(manifest["files"])
    rows: list[str] = []
    paths: list[str] = []
    for file in manifest["files"]:
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        assert actual == file["sha256"], file["path"]
        paths.append(file["path"])
        rows.append(f'{file["path"]}\t{actual}\n')
    assert paths == sorted(paths)
    fixture_hash = sha256_hex("".join(rows).encode("utf-8"))
    assert fixture_hash == manifest["fixture_set_sha256"]
    assert fixture_hash == EXPECTED_FIXTURE_SET_SHA256
    assert manifest["dcn_sha256"] == PINNED_DCN_SHA256

    assert contract["schema"] == "counterfactual_conformance_package_contract.v0"
    assert contract["package_id"] == "counterfactual-conformance-v0"
    assert contract["version"] == "v0"
    assert contract["dcn"]["pinned_sha256"] == PINNED_DCN_SHA256
    assert contract["dcn"]["generated_sha256"] == PINNED_DCN_SHA256
    assert contract["dcn"]["member_count"] == 10

    children = contract["children"]
    assert len(children) == 10
    for index, child in enumerate(children):
        assert child["ordinal"] == index + 1
        assert child["vector_id"] == EXPECTED_VECTOR_IDS[index]
        verify_child_package(child)

    identity_hash = child_identity_set_sha256(children)
    assert identity_hash == contract["aggregate"]["child_identity_set_sha256"]
    assert identity_hash == EXPECTED_CHILD_IDENTITY_SET_SHA256

    neighborhood = json.loads((PACKAGE / "dcn/neighborhood.json").read_text(encoding="utf-8"))
    assert neighborhood["schema"] == "receiptos.counterfactual_neighborhood.v0"
    assert neighborhood["neighborhood_id"] == "receiptos-counterfactual-neighborhood-lane-b-fixture-v0"
    assert len(neighborhood["members"]) == 10
    dcn_sha = sha256_hex(canonical_json(neighborhood).encode("utf-8"))
    assert dcn_sha == PINNED_DCN_SHA256

    on_disk = {path.relative_to(PACKAGE).as_posix() for path in PACKAGE.rglob("*") if path.is_file()}
    unexpected = sorted(on_disk - CLOSED_INVENTORY)
    assert not unexpected, f"unexpected package files: {unexpected}"
    missing = sorted(CLOSED_INVENTORY - on_disk)
    assert not missing, f"missing package files: {missing}"

    return {
        "auditor": "python-independent-counterfactual-conformance-v0",
        "package_id": contract["package_id"],
        "child_count": len(children),
        "package_inventory_count": manifest["file_count"],
        "fixture_set_sha256": fixture_hash,
        "child_identity_set_sha256": identity_hash,
        "dcn_sha256": dcn_sha,
        "production_imports": 0,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(audit_package(), indent=2, ensure_ascii=False))
    except Exception as error:  # noqa: BLE001 - auditor boundary
        print(json.dumps({"ok": False, "error": type(error).__name__}, indent=2))
        sys.exit(1)
