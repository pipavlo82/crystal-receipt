#!/usr/bin/env python3
"""Independent Counterfactual Traversal Stability v1 package auditor.

Verifies schedule package structure, inventory, per-schedule digests, schedule-set
digest, first-position coverage, DCN binding, and v0 preservation without importing
ReceiptOS production TypeScript. Does not execute production subjects.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/counterfactual-traversal-stability-v1"
PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
PRESERVED_V0_SCHEDULE_SET = "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d"
PRESERVED_V0_FIXTURE = "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201"
EXPECTED_SCHEDULE_IDS = [
    "pi_canonical",
    "pi_reverse",
    "pi_composite_first",
    "pi_boundary_first",
    "pi_nonlocal_v0",
    "cold_start_missing-required-input",
    "cold_start_integrity-mismatch",
    "cold_start_chronicle-proof-root-mismatch",
    "cold_start_chronicle-predecessor-unknown",
    "cold_start_chronicle-sequence-gap",
    "cold_start_chronicle-checkpoint-root-mismatch",
    "cold_start_chronicle-checkpoint-entry-refs-noncanonical",
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
PRESERVED_V0_DIGESTS = {
    "pi_canonical": "10fe5ab9156154a5a03b369a75cd8d6782da68149be97acb3ad645c9d86c95c7",
    "pi_reverse": "5bf691951414804217d0830215d699a5eaf61167fb782cf5388350afe6635f84",
    "pi_composite_first": "7545c4b2309b2e996b6139b75eb663932b0b906d25bccc4713974e7723ce5038",
    "pi_boundary_first": "4d4d5c88a7295de490fcd2d186e28e03503d3ef5f0bfdd0ecb92637a6eb49480",
    "pi_nonlocal_v0": "62d965b95f8004f4229f25b8b50c399ea10f5b0840efdba97b351fb7ee33db65",
}
COLD_START_FIRST = {
    "cold_start_missing-required-input": "V-MISSING-REQUIRED-INPUT",
    "cold_start_integrity-mismatch": "V-INTEGRITY-MISMATCH",
    "cold_start_chronicle-proof-root-mismatch": "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    "cold_start_chronicle-predecessor-unknown": "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    "cold_start_chronicle-sequence-gap": "V-CHRONICLE-SEQUENCE-GAP",
    "cold_start_chronicle-checkpoint-root-mismatch": "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    "cold_start_chronicle-checkpoint-entry-refs-noncanonical":
        "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
}
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

    assert contract["schema"] == "counterfactual_traversal_stability_package_contract.v1"
    assert contract["package_id"] == "counterfactual-traversal-stability-v1"
    assert contract["reset_model"] == RESET_MODEL
    assert contract["dcn_sha256"] == PINNED_DCN_SHA256
    runner = contract["runner"]
    assert runner["process_launch_count"] == 12
    assert (
        runner["process_isolation"]
        == "exactly_one_fresh_spawn_per_authenticated_schedule_sequential_no_cross_schedule_reuse"
    )
    assert runner["pid_telemetry"] == "non_normative_may_repeat_never_enters_result_identity"
    forbidden = contract["forbidden_semantics"]
    assert "numeric_pid_uniqueness_as_process_identity" in forbidden
    assert "caller_claimed_process_launch_count" in forbidden
    assert schedule_set["schema"] == "receiptos.counterfactual_traversal_schedule_set.v1"
    assert schedule_set["reset_model"] == RESET_MODEL
    assert schedule_set["dcn_sha256"] == PINNED_DCN_SHA256
    assert schedule_set["schedule_count"] == 12

    schedules = schedule_set["schedules"]
    assert len(schedules) == 12
    assert [entry["schedule_id"] for entry in schedules] == EXPECTED_SCHEDULE_IDS

    slots = 0
    first_positions: dict[str, list[str]] = {vector_id: [] for vector_id in CANONICAL_VECTOR_IDS}
    for schedule in schedules:
        ordered = schedule["ordered_vector_ids"]
        assert_exact_ten(ordered, schedule["schedule_id"])
        digest = sha256_hex(canonical_json(ordered).encode("utf-8"))
        assert digest == schedule["ordered_vector_ids_sha256"], schedule["schedule_id"]
        slots += len(ordered)
        first = ordered[0]
        first_positions[first].append(schedule["schedule_id"])
        if schedule["schedule_id"] in PRESERVED_V0_DIGESTS:
            assert digest == PRESERVED_V0_DIGESTS[schedule["schedule_id"]]
        if schedule["schedule_id"] in COLD_START_FIRST:
            expected_first = COLD_START_FIRST[schedule["schedule_id"]]
            assert first == expected_first
            remainder = [vector_id for vector_id in CANONICAL_VECTOR_IDS if vector_id != expected_first]
            assert ordered[1:] == remainder
    assert slots == 120
    missing = [vector_id for vector_id, ids in first_positions.items() if len(ids) == 0]
    assert missing == [], f"first-position missing: {missing}"

    coverage = contract["first_position_coverage"]
    assert coverage["schedule_count"] == 12
    assert coverage["member_count"] == 10
    assert coverage["scheduled_member_evaluations"] == 120
    assert coverage["first_position_member_count"] == 10
    assert coverage["first_position_covered"] == 10
    assert coverage["first_position_missing"] == []

    set_preimage = {
        "schema": "receiptos.counterfactual_traversal_schedule_set.v1",
        "schedule_set_id": "counterfactual-traversal-schedule-set-v1",
        "profile_id": "counterfactual-traversal-stability-v1",
        "profile_version": "v1",
        "dcn_sha256": PINNED_DCN_SHA256,
        "member_count": 10,
        "schedule_count": 12,
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

    preserved_v0 = contract["preserved_v0_profile"]
    assert preserved_v0["schedule_set_sha256"] == PRESERVED_V0_SCHEDULE_SET
    assert preserved_v0["fixture_set_sha256"] == PRESERVED_V0_FIXTURE
    v0_manifest = json.loads(
        (ROOT / "conformance/counterfactual-traversal-stability-v0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert v0_manifest["schedule_set_sha256"] == PRESERVED_V0_SCHEDULE_SET
    assert v0_manifest["fixture_set_sha256"] == PRESERVED_V0_FIXTURE

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
                "package_id": "counterfactual-traversal-stability-v1",
                "schedule_set_sha256": set_digest,
                "fixture_set_sha256": fixture,
                "dcn_sha256": PINNED_DCN_SHA256,
                "first_position_covered": 10,
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
