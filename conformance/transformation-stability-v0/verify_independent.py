#!/usr/bin/env python3
"""Independent Transformation Stability v0 package auditor.

Verifies package structure, inventory, per-file digests, Handoff matrix
roots/aggregate, and closed-cycle results without importing ReceiptOS
production TypeScript. Recomputes the Handoff receipt-root relations
directly from the committed fixture Git blob (working-tree EOL
representation is intentionally ignored) and independently re-executes the
closed-cycle state machine from the frozen input specification in
cycles/cycle-set.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/transformation-stability-v0"
DEFAULT_BASELINE_COMMIT = "8e31310a8686ee78c32103d0fb40047770de4c7d"
FIXTURE_REL = "src/receiptos/fixtures/session-evidence.sample.json"
EXPECTED_FIXTURE_BLOB_SHA1 = "a5dbda7662aa95a92a3befa3df28a666319e6740"
EXPECTED_SAMPLE_ROOT = "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"
EXPECTED_NORMATIVE_MUTATION_ROOT = "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e"
HANDOFF_VECTOR_IDS = [
    "H-ROUNDTRIP-STABLE",
    "H-KEY-ORDER-REVERSE",
    "H-NORMATIVE-SESSION-ID-MUTATION",
    "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION",
    "H-SOURCE-SCHEMA-MISMATCH",
    "H-TARGET-RECOMPUTE-UNRESOLVED",
]
EXPECTED_AGGREGATE = {
    "stable": 2,
    "history_sensitive": 0,
    "unresolved": 1,
    "out_of_domain": 1,
    "violation": 2,
}
EXPECTED_CLASSIFICATION = {
    "H-ROUNDTRIP-STABLE": "stable",
    "H-KEY-ORDER-REVERSE": "stable",
    "H-NORMATIVE-SESSION-ID-MUTATION": "violation",
    "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION": "violation",
    "H-SOURCE-SCHEMA-MISMATCH": "out_of_domain",
    "H-TARGET-RECOMPUTE-UNRESOLVED": "unresolved",
}
CYCLE_VECTOR_IDS = [
    "stable_closed_cycle",
    "intermediate_violation_restored_endpoint",
    "failed_applicability_out_of_domain",
    "recompute_unresolved_worker_timeout",
]
CLOSED_INVENTORY = {
    "SPEC.md",
    "contract.json",
    "manifest.json",
    "generate_package.ts",
    "verify_independent.py",
    "audit_package.ts",
    "vectors/handoff-matrix-set.json",
    "cycles/cycle-set.json",
}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonicalize(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        if not (value == value and value not in (float("inf"), float("-inf"))):
            raise ValueError("non-finite number")
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            json.dumps(key, ensure_ascii=False) + ":" + canonicalize(value[key])
            for key in sorted(value)
        ) + "}"
    raise ValueError(f"unsupported canonical value: {type(value)!r}")


def compute_receipt_root(evidence: dict) -> str:
    preimage = dict(evidence)
    preimage.pop("anchor", None)
    digest = hashlib.sha256(canonicalize(preimage).encode("utf-8")).hexdigest()
    return "0x" + digest


def git_blob_sha1(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read_committed_git_blob_bytes(repo: Path, commit: str, rel_path: str) -> bytes:
    try:
        return subprocess.check_output(
            ["git", "cat-file", "blob", f"{commit}:{rel_path}"],
            cwd=repo,
        )
    except subprocess.CalledProcessError as error:
        raise AssertionError(f"failed to read committed git blob {commit}:{rel_path}") from error


def committed_git_blob_sha1(repo: Path, commit: str, rel_path: str) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", f"{commit}:{rel_path}"],
            cwd=repo,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as error:
        raise AssertionError(f"failed to resolve committed git blob identity {commit}:{rel_path}") from error


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


# ---------------------------------------------------------------------------
# Independent closed-cycle state machine re-execution.
#
# This mirrors the classification rules documented in SPEC.md / contract.json
# and already implemented in the merged
# src/receiptos/challenge/transformation-stability-cycle.ts evaluator, but is
# written from scratch here so this auditor never imports production code.
# ---------------------------------------------------------------------------


def apply_ops(node: dict, ops: list[dict]) -> dict:
    next_node = dict(node)
    for entry in ops:
        require(entry["op"] == "set_field", "unsupported cycle op")
        next_node[entry["field"]] = entry["value"]
    return next_node


def cycle_recompute(node: dict) -> tuple[str, dict | None, str | None]:
    if node.get("unresolved"):
        return "unresolved", None, "worker_timeout"
    return (
        "evaluated",
        {
            "verdict": "accept" if node["value"] >= 0 else "reject",
            "observation": node["observation"],
            "telemetry": node["telemetry"],
            "forbidden": node["forbidden"],
        },
        None,
    )


def cycle_projections(result: dict) -> tuple[dict, dict, dict]:
    return (
        {"verdict": result["verdict"]},
        {"observation": result["observation"]},
        {"forbidden": result["forbidden"]},
    )


def evaluate_cycle_independent(input_spec: dict) -> dict:
    start_node = input_spec["start_node"]
    edges = input_spec["edges"]

    start_state, start_value, start_reason = cycle_recompute(start_node)
    if start_state == "unresolved":
        return {"classification": "unresolved", "failed_edge_id": None, "failure_reason": start_reason}

    current_node = start_node
    previous_result = start_value

    for edge in edges:
        edge_id = edge["edge_id"]
        if not current_node.get("inDomain"):
            return {
                "classification": "out_of_domain",
                "failed_edge_id": edge_id,
                "failure_reason": f"{edge_id}_out_of_domain",
            }

        next_node = apply_ops(current_node, edge["ops"])
        next_state, next_value, next_reason = cycle_recompute(next_node)
        if next_state == "unresolved":
            return {"classification": "unresolved", "failed_edge_id": edge_id, "failure_reason": next_reason}

        prev_n, prev_s, prev_f = cycle_projections(previous_result)
        next_n, next_s, next_f = cycle_projections(next_value)

        if canonicalize(prev_n) != canonicalize(next_n) or canonicalize(prev_f) != canonicalize(next_f):
            reason = (
                "normative_projection_mismatch"
                if canonicalize(prev_n) != canonicalize(next_n)
                else "forbidden_variant_mismatch"
            )
            return {"classification": "violation", "failed_edge_id": edge_id, "failure_reason": reason}

        current_node = next_node
        previous_result = next_value

    # Endpoint closure — only reachable if no edge violated.
    start_n, start_s, start_f = cycle_projections(start_value)
    end_n, end_s, end_f = cycle_projections(previous_result)
    if canonicalize(start_n) != canonicalize(end_n) or canonicalize(start_f) != canonicalize(end_f):
        reason = (
            "endpoint_normative_projection_mismatch"
            if canonicalize(start_n) != canonicalize(end_n)
            else "endpoint_forbidden_variant_mismatch"
        )
        return {"classification": "violation", "failed_edge_id": None, "failure_reason": reason}

    return {"classification": "stable", "failed_edge_id": None, "failure_reason": None}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-commit", default=DEFAULT_BASELINE_COMMIT)
    args = parser.parse_args()
    baseline_commit = args.baseline_commit

    require(PACKAGE.is_dir(), "package missing")
    on_disk = set(list_files(PACKAGE))
    require(on_disk == CLOSED_INVENTORY, f"closed inventory mismatch: {sorted(on_disk ^ CLOSED_INVENTORY)}")

    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    matrix_set = json.loads((PACKAGE / "vectors/handoff-matrix-set.json").read_text(encoding="utf-8"))
    cycle_set = json.loads((PACKAGE / "cycles/cycle-set.json").read_text(encoding="utf-8"))

    require(contract["schema"] == "transformation_stability_package_contract.v0", "contract schema")
    require(contract["package_id"] == "transformation-stability-v0", "package_id")
    require(contract["claim"] == "normative_preservation", "claim")

    # --- manifest / digest closure (package-local files; conformance/** is LF-protected) ---
    rows: list[str] = []
    paths: list[str] = []
    for file in manifest["files"]:
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        require(actual == file["sha256"], f"file digest {file['path']}")
        paths.append(file["path"])
        rows.append(f'{file["path"]}\t{actual}\n')
    require(paths == sorted(paths), "manifest path order")
    fixture_set_sha256 = sha256_hex("".join(rows).encode("utf-8"))
    require(manifest["fixture_set_sha256"] == fixture_set_sha256, "fixture_set_sha256")

    matrix_bytes = (PACKAGE / "vectors/handoff-matrix-set.json").read_bytes()
    cycle_bytes = (PACKAGE / "cycles/cycle-set.json").read_bytes()
    handoff_matrix_set_sha256 = sha256_hex(matrix_bytes)
    cycle_set_sha256 = sha256_hex(cycle_bytes)
    require(manifest["handoff_matrix_set_sha256"] == handoff_matrix_set_sha256, "manifest handoff_matrix_set_sha256")
    require(manifest["cycle_set_sha256"] == cycle_set_sha256, "manifest cycle_set_sha256")
    require(
        contract["generated_digests"]["handoff_matrix_set_sha256"] == handoff_matrix_set_sha256,
        "contract handoff_matrix_set_sha256",
    )
    require(contract["generated_digests"]["cycle_set_sha256"] == cycle_set_sha256, "contract cycle_set_sha256")

    # --- Handoff matrix: committed Git blob, not working-tree bytes ---
    fixture_bytes = read_committed_git_blob_bytes(ROOT, baseline_commit, FIXTURE_REL)
    blob_sha1 = git_blob_sha1(fixture_bytes)
    git_oid = committed_git_blob_sha1(ROOT, baseline_commit, FIXTURE_REL)
    require(blob_sha1 == git_oid, "committed blob sha1/oid mismatch")
    require(blob_sha1 == EXPECTED_FIXTURE_BLOB_SHA1, "fixture blob drift")
    require(b"\r" not in fixture_bytes, "committed fixture blob contains CR")
    fixture = json.loads(fixture_bytes.decode("utf-8"))

    sample_root = compute_receipt_root(fixture)
    require(sample_root == EXPECTED_SAMPLE_ROOT, "sample root mismatch")

    normative = json.loads(json.dumps(fixture))
    normative["session_id"] = "session-demo-001-mutated"
    normative_root = compute_receipt_root(normative)
    require(normative_root == EXPECTED_NORMATIVE_MUTATION_ROOT, "normative mutation root mismatch")
    require(normative_root != sample_root, "normative mutation failed to move N")

    anchor = json.loads(json.dumps(fixture))
    anchor["anchor"]["contract"] = "0xdeadbeef"
    anchor_root = compute_receipt_root(anchor)
    require(anchor_root == sample_root, "anchor mutation unexpectedly moved receipt root")
    require(anchor["anchor"] != fixture["anchor"], "anchor mutation did not change forbidden projection")

    handoff_matrix = contract["handoff_matrix"]
    require(handoff_matrix["sample_receipt_root"] == sample_root, "contract sample_receipt_root")
    require(handoff_matrix["normative_session_id_mutation_root"] == normative_root, "contract normative root")
    require(handoff_matrix["anchor_contract_mutation_root"] == anchor_root, "contract anchor root")
    require(handoff_matrix["vector_inventory"] == HANDOFF_VECTOR_IDS, "vector inventory/order")
    require(handoff_matrix["expected_aggregate"] == EXPECTED_AGGREGATE, "expected_aggregate")

    require(matrix_set["vector_count"] == 6, "matrixSet vector_count")
    require(matrix_set["pass"] is True, "matrixSet pass")
    require(matrix_set["aggregate"] == EXPECTED_AGGREGATE, "matrixSet aggregate")
    members = matrix_set["members"]
    require([m["vector_id"] for m in members] == HANDOFF_VECTOR_IDS, "matrixSet vector order")
    for member in members:
        vector_id = member["vector_id"]
        require(
            member["observed"]["classification"] == EXPECTED_CLASSIFICATION[vector_id],
            f"matrixSet classification {vector_id}",
        )
    anchor_member = next(m for m in members if m["vector_id"] == "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION")
    require(anchor_member["observed"]["normative_match"] is True, "anchor mutation preserves N")
    require(anchor_member["observed"]["forbidden_variant_match"] is False, "anchor mutation violates F")

    # --- Closed cycle: independent re-execution from frozen input spec ---
    cycle = contract["cycle"]
    require(cycle["cycle_vector_inventory"] == CYCLE_VECTOR_IDS, "cycle vector inventory/order")
    require(cycle_set["cycle_count"] == 4, "cycleSet cycle_count")
    cycles = cycle_set["cycles"]
    require([c["cycle_id"] for c in cycles] == CYCLE_VECTOR_IDS, "cycleSet vector order")

    expected = cycle["expected"]
    for entry in cycles:
        cycle_id = entry["cycle_id"]
        exp = expected[cycle_id]

        # Recompute independently from the frozen input, ignoring "observed".
        recomputed = evaluate_cycle_independent(entry["input"])
        require(recomputed["classification"] == exp["classification"], f"independent recompute classification {cycle_id}")
        require(recomputed["failed_edge_id"] == exp["failed_edge_id"], f"independent recompute failed_edge_id {cycle_id}")
        require(recomputed["failure_reason"] == exp["failure_reason"], f"independent recompute failure_reason {cycle_id}")

        # Cross-check the frozen "observed" TS output agrees with the contract.
        observed = entry["observed"]
        require(observed["classification"] == exp["classification"], f"frozen observed classification {cycle_id}")
        require(observed["failed_edge_id"] == exp["failed_edge_id"], f"frozen observed failed_edge_id {cycle_id}")
        require(observed["failure_reason"] == exp["failure_reason"], f"frozen observed failure_reason {cycle_id}")

    intermediate = next(c for c in cycles if c["cycle_id"] == "intermediate_violation_restored_endpoint")
    require(len(intermediate["observed"]["edges"]) == 1, "intermediate cycle terminates at first violating edge")
    require(intermediate["observed"]["edges"][0]["edge_id"] == "flip", "intermediate cycle first edge is flip")
    require(len(intermediate["input"]["edges"]) == 2, "intermediate cycle input still declares both edges")

    print(
        json.dumps(
            {
                "ok": True,
                "package_id": "transformation-stability-v0",
                "fixture_set_sha256": fixture_set_sha256,
                "handoff_matrix_set_sha256": handoff_matrix_set_sha256,
                "cycle_set_sha256": cycle_set_sha256,
                "sample_receipt_root": sample_root,
                "normative_mutation_root": normative_root,
                "anchor_mutation_root": anchor_root,
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
