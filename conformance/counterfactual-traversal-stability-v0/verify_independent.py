#!/usr/bin/env python3
"""Independent Counterfactual Traversal Stability v0 package auditor.

Verifies schedule package structure, inventory, per-schedule digests, schedule-set
digest, and DCN binding without importing ReceiptOS production TypeScript.
Does not execute production subjects.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/counterfactual-traversal-stability-v0"
PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
EXPECTED_SCHEDULE_IDS = [
    "pi_canonical",
    "pi_reverse",
    "pi_composite_first",
    "pi_boundary_first",
    "pi_nonlocal_v0",
]
CANONICAL_VECTOR_IDS = [
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
PI_NONLOCAL = [
    "V-OBSERVED-NOT-VALIDATED",
    "V-MISSING-REQUIRED-INPUT",
    "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    "V-INTEGRITY-MISMATCH",
    "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
    "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    "V-CHRONICLE-SEQUENCE-GAP",
    "V-AT-NEST-OBJ",
    "V-MAN-HASH-DIFF",
]
CLOSED_INVENTORY = {
    "SPEC.md",
    "contract.json",
    "manifest.json",
    "schedules/schedule-set.json",
    "generate_package.ts",
    "verify_independent.py",
    "audit_package.ts",
    "run_schedule_worker.ts",
}
RESET_MODEL = "fresh_process_per_schedule_shared_process_within_schedule"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value) -> str:
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
    raise ValueError(f"non-canonical json value: {type(value)}")


def list_files(package: Path) -> list[str]:
    out: list[str] = []
    for path in sorted(package.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(package).as_posix()
        if "__pycache__" in rel.split("/"):
            continue
        out.append(rel)
    return out


def assert_exact_ten(ordered, label: str) -> None:
    assert len(ordered) == 10, f"{label} count"
    seen = set()
    for vector_id in ordered:
        assert vector_id in CANONICAL_VECTOR_IDS, f"{label} unknown"
        assert vector_id not in seen, f"{label} duplicate"
        seen.add(vector_id)
    for vector_id in CANONICAL_VECTOR_IDS:
        assert vector_id in seen, f"{label} missing {vector_id}"


def main() -> int:
    assert PACKAGE.is_dir(), "package missing"
    on_disk = set(list_files(PACKAGE))
    assert on_disk == CLOSED_INVENTORY, f"closed inventory mismatch: {sorted(on_disk ^ CLOSED_INVENTORY)}"

    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    schedule_set = json.loads((PACKAGE / "schedules/schedule-set.json").read_text(encoding="utf-8"))

    assert contract["schema"] == "counterfactual_traversal_stability_package_contract.v0"
    assert contract["package_id"] == "counterfactual-traversal-stability-v0"
    assert contract["reset_model"] == RESET_MODEL
    assert contract["dcn_sha256"] == PINNED_DCN_SHA256
    assert schedule_set["schema"] == "receiptos.counterfactual_traversal_schedule_set.v0"
    assert schedule_set["reset_model"] == RESET_MODEL
    assert schedule_set["dcn_sha256"] == PINNED_DCN_SHA256

    schedules = schedule_set["schedules"]
    assert len(schedules) == 5
    assert [entry["schedule_id"] for entry in schedules] == EXPECTED_SCHEDULE_IDS

    slots = 0
    for schedule in schedules:
        ordered = schedule["ordered_vector_ids"]
        assert_exact_ten(ordered, schedule["schedule_id"])
        digest = sha256_hex(canonical_json(ordered).encode("utf-8"))
        assert digest == schedule["ordered_vector_ids_sha256"], schedule["schedule_id"]
        slots += len(ordered)
    assert slots == 50

    assert schedules[0]["ordered_vector_ids"] == CANONICAL_VECTOR_IDS
    assert schedules[1]["ordered_vector_ids"] == list(reversed(CANONICAL_VECTOR_IDS))
    assert schedules[2]["ordered_vector_ids"][0] == "V-MAN-HASH-DIFF"
    assert schedules[3]["ordered_vector_ids"][0] == "V-AT-NEST-OBJ"
    assert schedules[4]["ordered_vector_ids"] == PI_NONLOCAL

    set_preimage = {
        "schema": "receiptos.counterfactual_traversal_schedule_set.v0",
        "schedule_set_id": "counterfactual-traversal-schedule-set-v0",
        "profile_id": "counterfactual-traversal-stability-v0",
        "profile_version": "v0",
        "dcn_sha256": PINNED_DCN_SHA256,
        "member_count": 10,
        "schedule_count": 5,
        "reset_model": RESET_MODEL,
        "canonical_vector_ids": CANONICAL_VECTOR_IDS,
        "schedules": [
            {
                "schedule_id": schedule["schedule_id"],
                "ordered_vector_ids": schedule["ordered_vector_ids"],
                "ordered_vector_ids_sha256": schedule["ordered_vector_ids_sha256"],
            }
            for schedule in schedules
        ],
    }
    set_digest = sha256_hex(canonical_json(set_preimage).encode("utf-8"))
    assert set_digest == schedule_set["schedule_set_sha256"]
    assert contract["schedule_set_sha256"] == set_digest
    assert manifest["schedule_set_sha256"] == set_digest

    rows: list[str] = []
    paths: list[str] = []
    for file in manifest["files"]:
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        assert actual == file["sha256"], file["path"]
        paths.append(file["path"])
        rows.append(f'{file["path"]}\t{actual}\n')
    assert paths == sorted(paths)
    fixture = sha256_hex("".join(rows).encode("utf-8"))
    assert manifest["fixture_set_sha256"] == fixture

    print(
        json.dumps(
            {
                "ok": True,
                "package_id": "counterfactual-traversal-stability-v0",
                "schedule_set_sha256": set_digest,
                "fixture_set_sha256": fixture,
                "dcn_sha256": PINNED_DCN_SHA256,
                "production_imports": 0,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 — bounded auditor surface
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from exc
