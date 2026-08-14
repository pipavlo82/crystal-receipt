#!/usr/bin/env python3
"""Independent Cross-Object Transformation Stability v0 package auditor.

Verifies package structure, inventory, per-file digests, and both frozen
profiles' vector/cycle authority without importing ReceiptOS production
TypeScript. Independently recomputes the three Chronicle root algorithms
(collection_root, portfolio_root, checkpoint_root) from the fixture JSON
frozen in contract.json, independently re-executes the duplicate-preserving
multiset comparison and the closure implication, and independently
re-derives every flat vector's and cycle's classification from the frozen
per-vector/per-edge match booleans and the pinned expectation tables --
never by trusting the frozen `classification` field alone.

Source blobs are authenticated two ways, deliberately kept separate:
 1. the current tree still binds each canonical module path to its pinned
    blob OID (`git rev-parse HEAD:<path>`), catching path-to-object
    substitution at HEAD;
 2. this auditor works entirely from bytes already present in the package
    (contract.json, the frozen vector/cycle sets) rather than re-reading
    src/** bytes at all, so it is correct even under a depth-1 checkout
    where only the module blobs (not necessarily older ancestor commits)
    are guaranteed to be locally resolvable.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/cross-object-transformation-stability-v0"

EXPECTED_BASE_MERGE_COMMIT = "3fa8e96a9b3236c128ad0f20602ed84d2c615ea8"
EXPECTED_CHRONICLE_DOMAIN_PATH = "src/receiptos/capsule/chronicle-portfolio-v0.ts"
EXPECTED_CHRONICLE_DOMAIN_BLOB = "0e790911092546c62344f980e6b611542bcd00fe"
EXPECTED_COLLECTION_CHECKPOINT_PATH = "src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint.ts"
EXPECTED_COLLECTION_CHECKPOINT_BLOB = "da1a0bca7e9ae36f2805a837cd9adaaec4d3ad7a"
EXPECTED_COLLECTIONS_PORTFOLIO_PATH = "src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio.ts"
EXPECTED_COLLECTIONS_PORTFOLIO_BLOB = "890ddb8d5a7e8ac8bd7dfc6c0682589d796393d9"

CLOSED_INVENTORY = {
    "SPEC.md",
    "contract.json",
    "manifest.json",
    "generate_package.ts",
    "audit_package.ts",
    "verify_independent.py",
    "vectors/collection-checkpoint-matrix-set.json",
    "vectors/collection-portfolio-matrix-set.json",
    "cycles/collection-checkpoint-cycle-set.json",
    "cycles/collection-portfolio-cycle-set.json",
}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonicalize(value) -> str:
    """Mirrors src/receiptos/canon/canonicalize.ts exactly: sorts object
    keys, preserves array order (including duplicates), drops
    undefined-valued keys (not applicable in JSON -- absent keys are simply
    absent), never collapses/dedupes arrays."""
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
        if not (value == value and value not in (float("inf"), float("-inf"))):
            raise ValueError("non-finite number")
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            json.dumps(key, ensure_ascii=False) + ":" + canonicalize(value[key])
            for key in sorted(value)
        ) + "}"
    raise ValueError(f"unsupported canonical value: {type(value)!r}")


def sha256_canonical(value) -> str:
    return "sha256:" + hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


def sort_refs(refs: list[str]) -> list[str]:
    """Mirrors sortArtifactRefs / sortCollectionRefs: plain lexicographic
    sort, never deduped -- duplicates are preserved and counted."""
    return sorted(refs)


def sort_entry_refs(refs: list[str]) -> list[str]:
    return sorted(refs)


def compute_collection_root(collection: dict) -> str:
    return sha256_canonical(
        {
            "collection_version": collection["collection_version"],
            "collection_id": collection["collection_id"],
            "artifact_refs": sort_refs(collection["artifact_refs"]),
        }
    )


def compute_portfolio_root(portfolio: dict) -> str:
    return sha256_canonical(
        {
            "portfolio_version": portfolio["portfolio_version"],
            "portfolio_id": portfolio["portfolio_id"],
            "collection_refs": sort_refs(portfolio["collection_refs"]),
        }
    )


def compute_checkpoint_root(checkpoint: dict) -> str:
    return sha256_canonical(
        {
            "schema": checkpoint["schema"],
            "checkpoint_id": checkpoint["checkpoint_id"],
            "collection_ref": checkpoint["collection_ref"],
            "entry_refs": sort_entry_refs(checkpoint["entry_refs"]),
            "prev_checkpoint": checkpoint["prev_checkpoint"],
            "sequence": checkpoint["sequence"],
        }
    )


def derive_collection_ref(collection: dict) -> str:
    from urllib.parse import quote

    return "/collection/" + quote(collection["collection_id"], safe="")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def resolve_path_oid(repo: Path, revision: str, rel_path: str) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", f"{revision}:{rel_path}"],
            cwd=repo,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as error:
        raise AssertionError(f"failed to resolve {revision}:{rel_path}") from error


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
# Independent flat-vector classification re-derivation.
#
# Re-derives classification purely from the frozen per-vector match booleans
# already present in `observed` (normative_match, stability_match,
# forbidden_variant_match), mirroring the classification rules documented in
# SPEC.md / contract.json and already implemented in the merged
# transformation-stability.ts evaluator -- written from scratch here so this
# auditor never imports production code. It does not trust `classification`
# directly.
# ---------------------------------------------------------------------------


def classify_flat(observed: dict) -> str:
    if observed["evaluation_state"] == "not_applicable":
        return "out_of_domain"
    if observed["evaluation_state"] == "execution_unresolved":
        return "unresolved"
    if observed["normative_match"] is False or observed["forbidden_variant_match"] is False:
        return "violation"
    if observed["stability_match"] is False:
        return "history_sensitive"
    return "stable"


# ---------------------------------------------------------------------------
# Independent cycle classification re-derivation, from the frozen per-edge
# booleans and endpoint booleans -- never from the frozen top-level
# `classification`/`failed_edge_id`/`failure_reason` fields.
# ---------------------------------------------------------------------------


def classify_cycle(observed: dict) -> tuple[str, str | None, str | None]:
    edges = observed["edges"]
    for edge in edges:
        if edge["evaluation_state"] == "not_applicable":
            return "out_of_domain", edge["edge_id"], edge["reason"]
        if edge["evaluation_state"] == "execution_unresolved":
            return "unresolved", edge["edge_id"], edge["reason"]
        if edge["normative_match"] is False or edge["forbidden_variant_match"] is False:
            reason = "normative_projection_mismatch" if edge["normative_match"] is False else "forbidden_variant_mismatch"
            return "violation", edge["edge_id"], reason
    # No edge violated -- endpoint closure, only reachable if every declared
    # edge actually completed (edges list length must equal ordered_edge_ids
    # length; if the cycle terminated early, it already returned above).
    if len(edges) < len(observed["ordered_edge_ids"]):
        raise AssertionError("cycle edges list shorter than declared inventory with no recorded failure")
    endpoint = observed["endpoint"]
    if endpoint["normative_match"] is False or endpoint["forbidden_variant_match"] is False:
        reason = (
            "endpoint_normative_projection_mismatch"
            if endpoint["normative_match"] is False
            else "endpoint_forbidden_variant_mismatch"
        )
        return "violation", None, reason
    return "stable", None, None


def main() -> int:
    require(PACKAGE.is_dir(), "package missing")
    on_disk = set(list_files(PACKAGE))
    require(on_disk == CLOSED_INVENTORY, f"closed inventory mismatch: {sorted(on_disk ^ CLOSED_INVENTORY)}")

    contract = json.loads((PACKAGE / "contract.json").read_text(encoding="utf-8"))
    manifest = json.loads((PACKAGE / "manifest.json").read_text(encoding="utf-8"))
    checkpoint_matrix_set = json.loads((PACKAGE / "vectors/collection-checkpoint-matrix-set.json").read_text(encoding="utf-8"))
    portfolio_matrix_set = json.loads((PACKAGE / "vectors/collection-portfolio-matrix-set.json").read_text(encoding="utf-8"))
    checkpoint_cycle_set = json.loads((PACKAGE / "cycles/collection-checkpoint-cycle-set.json").read_text(encoding="utf-8"))
    portfolio_cycle_set = json.loads((PACKAGE / "cycles/collection-portfolio-cycle-set.json").read_text(encoding="utf-8"))

    require(contract["schema"] == "cross_object_transformation_stability_package_contract.v0", "contract schema")
    require(contract["package_id"] == "cross-object-transformation-stability-v0", "package_id")
    require(contract["claim"] == "pairwise_cross_object_consistency", "claim")
    require(contract["closure_claim"] == "pairwise_closure_sufficient_for_current_chronicle_composition", "closure_claim")

    # --- Source blob authentication: pinned blob OID, then HEAD path binding ---
    source = contract["source"]
    require(source["base_merge_commit"] == EXPECTED_BASE_MERGE_COMMIT, "source base_merge_commit")
    require(source["chronicle_domain_blob_sha1"] == EXPECTED_CHRONICLE_DOMAIN_BLOB, "chronicle_domain_blob_sha1")
    require(
        source["collection_checkpoint_module_blob_sha1"] == EXPECTED_COLLECTION_CHECKPOINT_BLOB,
        "collection_checkpoint_module_blob_sha1",
    )
    require(
        source["collections_portfolio_module_blob_sha1"] == EXPECTED_COLLECTIONS_PORTFOLIO_BLOB,
        "collections_portfolio_module_blob_sha1",
    )
    for path, expected_blob in (
        (EXPECTED_CHRONICLE_DOMAIN_PATH, EXPECTED_CHRONICLE_DOMAIN_BLOB),
        (EXPECTED_COLLECTION_CHECKPOINT_PATH, EXPECTED_COLLECTION_CHECKPOINT_BLOB),
        (EXPECTED_COLLECTIONS_PORTFOLIO_PATH, EXPECTED_COLLECTIONS_PORTFOLIO_BLOB),
    ):
        head_oid = resolve_path_oid(ROOT, "HEAD", path)
        require(head_oid == expected_blob, f"HEAD:{path} does not resolve to the pinned blob OID")

    # --- manifest / digest closure ---
    rows: list[str] = []
    paths: list[str] = []
    for file in manifest["files"]:
        require(not file["path"].endswith("manifest.json"), "manifest must not hash itself")
        data = (ROOT / file["path"]).read_bytes()
        actual = sha256_hex(data)
        require(actual == file["sha256"], f"file digest {file['path']}")
        require(b"\r" not in data, f"CR found in {file['path']}")
        paths.append(file["path"])
        rows.append(f'{file["path"]}\t{actual}\n')
    require(len(manifest["files"]) == 9, "manifest file count")
    require(paths == sorted(paths), "manifest path order")
    fixture_set_sha256 = sha256_hex("".join(rows).encode("utf-8"))
    require(manifest["fixture_set_sha256"] == fixture_set_sha256, "fixture_set_sha256")

    digest_keys = [
        "collection_checkpoint_matrix_set_sha256",
        "collections_portfolio_matrix_set_sha256",
        "collection_checkpoint_cycle_set_sha256",
        "collections_portfolio_cycle_set_sha256",
    ]
    set_bytes = {
        "collection_checkpoint_matrix_set_sha256": (PACKAGE / "vectors/collection-checkpoint-matrix-set.json").read_bytes(),
        "collections_portfolio_matrix_set_sha256": (PACKAGE / "vectors/collection-portfolio-matrix-set.json").read_bytes(),
        "collection_checkpoint_cycle_set_sha256": (PACKAGE / "cycles/collection-checkpoint-cycle-set.json").read_bytes(),
        "collections_portfolio_cycle_set_sha256": (PACKAGE / "cycles/collection-portfolio-cycle-set.json").read_bytes(),
    }
    for key in digest_keys:
        digest = sha256_hex(set_bytes[key])
        require(manifest[key] == digest, f"manifest {key}")
        require(contract["generated_digests"][key] == digest, f"contract generated_digests {key}")

    # --- Fixture roots: independently recomputed from frozen JSON, no TS import ---
    fixtures = contract["fixtures"]
    checkpoint_fixture = fixtures["collection_checkpoint"]
    portfolio_fixture = fixtures["collections_portfolio"]

    collection = checkpoint_fixture["collection"]
    checkpoint = checkpoint_fixture["checkpoint"]
    require(compute_collection_root(collection) == collection["collection_root"], "collection_checkpoint: collection_root")
    require(compute_checkpoint_root(checkpoint) == checkpoint["checkpoint_root"], "collection_checkpoint: checkpoint_root")
    require(
        derive_collection_ref(collection) == checkpoint["collection_ref"],
        "collection_checkpoint: fixture cross-link consistent at genesis",
    )

    collections = portfolio_fixture["collections"]
    portfolio = portfolio_fixture["portfolio"]
    require(len(collections) == 2, "collections_portfolio: fixture has two genuinely distinct Collections")
    require(collections[0]["collection_id"] != collections[1]["collection_id"], "collections_portfolio: distinct collection_id")
    for c in collections:
        require(compute_collection_root(c) == c["collection_root"], f"collections_portfolio: collection_root {c['collection_id']}")
    require(compute_portfolio_root(portfolio) == portfolio["portfolio_root"], "collections_portfolio: portfolio_root")
    derived = sort_refs([derive_collection_ref(c) for c in collections])
    stored = sort_refs(portfolio["collection_refs"])
    require(derived == stored, "collections_portfolio: fixture cross-link consistent at genesis")

    # --- Closure implication: independently re-derived from frozen evidence ---
    closure = contract["closure"]
    evidence = closure["evidence"]
    ev_derived = sort_refs(evidence["derived_collection_refs"])
    ev_stored = sort_refs(evidence["stored_portfolio_refs"])
    require(ev_derived == evidence["derived_collection_refs"], "closure evidence derived refs already normalized")
    require(ev_stored == evidence["stored_portfolio_refs"], "closure evidence stored refs already normalized")
    d_equals_p = ev_derived == ev_stored
    require(d_equals_p == evidence["d_equals_p"], "closure independent re-check: D === P")
    c_ref = evidence["checkpoint_collection_ref"]
    c_in_d = c_ref in ev_derived
    c_in_p = c_ref in ev_stored
    require(c_in_d == evidence["c_in_d"], "closure independent re-check: C in D")
    require(c_in_p == evidence["c_in_p"], "closure independent re-check: C in P")
    require(evidence["checkpoint_verifies"] is True, "closure evidence: standalone Checkpoint locally valid")
    # The implication proper: D === P and C in D together force C in P.
    if d_equals_p and c_in_d:
        require(c_in_p, "closure implication violated: D===P and C in D but C not in P")

    # --- Locally-valid/globally-invalid evidence ---
    lvgi = contract["locally_valid_globally_invalid_evidence"]
    checkpoint_evidence = lvgi["collection_checkpoint"]
    require(checkpoint_evidence["collection_verifies"] is True, "LVGI checkpoint: collection verifies")
    require(checkpoint_evidence["checkpoint_verifies"] is True, "LVGI checkpoint: checkpoint verifies")
    require(checkpoint_evidence["cross_link_match"] is False, "LVGI checkpoint: cross-link false")

    portfolio_evidence = lvgi["collections_portfolio"]
    require(portfolio_evidence["all_collections_verify"] is True, "LVGI portfolio: all collections verify")
    require(portfolio_evidence["portfolio_verifies"] is True, "LVGI portfolio: portfolio verifies")
    require(portfolio_evidence["cross_link_match"] is False, "LVGI portfolio: cross-link false")
    dup_derived = portfolio_evidence["derived_collection_refs"]
    dup_stored = portfolio_evidence["stored_collection_refs"]
    require(len(dup_derived) == 2 and len(dup_stored) == 1, "LVGI portfolio: duplicate-preserving multiset cardinality")
    require(dup_derived[0] == dup_derived[1], "LVGI portfolio: duplicate ref appears twice in derived multiset")
    require(dup_derived[0] == dup_stored[0], "LVGI portfolio: duplicate ref is the ref stored once")
    require(set(dup_derived) == set(dup_stored), "LVGI portfolio: mismatch is purely cardinality, not membership")

    # --- Independent flat-vector re-classification (both profiles) ---
    def audit_flat(profile_key: str, matrix_set: dict, expected_count: int) -> dict[str, int]:
        profile = contract[profile_key]
        vector_inventory = profile["vector_inventory"]
        expected_classification = profile["expected_classification"]
        require(len(vector_inventory) == expected_count, f"{profile_key} vector_inventory length")
        require(matrix_set["vector_count"] == expected_count, f"{profile_key} matrixSet vector_count")
        require(matrix_set["pass"] is True, f"{profile_key} matrixSet pass")
        members = matrix_set["members"]
        require([m["vector_id"] for m in members] == vector_inventory, f"{profile_key} vector order")

        tally = {"stable": 0, "history_sensitive": 0, "unresolved": 0, "out_of_domain": 0, "violation": 0}
        for member in members:
            vector_id = member["vector_id"]
            observed = member["observed"]
            recomputed = classify_flat(observed)
            require(recomputed == expected_classification[vector_id], f"{profile_key} independent classification {vector_id}")
            require(observed["classification"] == recomputed, f"{profile_key} frozen classification agrees {vector_id}")
            tally[recomputed] += 1
        require(tally == profile["expected_aggregate"], f"{profile_key} independently re-tallied aggregate")
        require(tally == matrix_set["aggregate"], f"{profile_key} re-tally matches frozen aggregate")
        return tally

    checkpoint_tally = audit_flat("collection_checkpoint", checkpoint_matrix_set, 11)
    portfolio_tally = audit_flat("collections_portfolio", portfolio_matrix_set, 18)

    combined_flat = {
        "vector_count": 29,
        "stable": checkpoint_tally["stable"] + portfolio_tally["stable"],
        "history_sensitive": checkpoint_tally["history_sensitive"] + portfolio_tally["history_sensitive"],
        "unresolved": checkpoint_tally["unresolved"] + portfolio_tally["unresolved"],
        "out_of_domain": checkpoint_tally["out_of_domain"] + portfolio_tally["out_of_domain"],
        "violation": checkpoint_tally["violation"] + portfolio_tally["violation"],
    }
    require(combined_flat == contract["combined_flat_aggregate"], "combined_flat_aggregate")

    # --- Independent cycle re-classification (both profiles) ---
    def audit_cycles(profile_key: str, cycle_set: dict, expected_count: int) -> dict[str, int]:
        profile = contract[profile_key]
        cycle_vector_inventory = profile["cycle_vector_inventory"]
        cycle_expected = profile["cycle_expected"]
        require(cycle_set["cycle_count"] == expected_count, f"{profile_key} cycleSet cycle_count")
        cycles = cycle_set["cycles"]
        require([c["cycle_id"] for c in cycles] == cycle_vector_inventory, f"{profile_key} cycle vector order")

        tally = {"stable": 0, "history_sensitive": 0, "unresolved": 0, "out_of_domain": 0, "violation": 0}
        for entry in cycles:
            cycle_id = entry["cycle_id"]
            observed = entry["observed"]
            exp = cycle_expected[cycle_id]
            require(observed["ordered_edge_ids"] == exp["ordered_edge_ids"], f"{profile_key} cycle edge order {cycle_id}")

            classification, failed_edge_id, failure_reason = classify_cycle(observed)
            require(classification == exp["classification"], f"{profile_key} independent cycle classification {cycle_id}")
            require(failed_edge_id == exp["failed_edge_id"], f"{profile_key} independent cycle failed_edge_id {cycle_id}")
            require(failure_reason == exp["failure_reason"], f"{profile_key} independent cycle failure_reason {cycle_id}")
            require(observed["classification"] == classification, f"{profile_key} frozen cycle classification agrees {cycle_id}")
            require(observed["aggregate"]["completed_edges"] == exp["completed_edges"], f"{profile_key} completed_edges {cycle_id}")
            tally[classification] += 1

            # Endpoint-equality-cannot-erase-intermediate-violation check:
            # any cycle that fails at a non-final edge must declare more
            # edges in its inventory than it actually executed.
            if failed_edge_id is not None and exp["completed_edges"] == 0:
                require(
                    len(observed["edges"]) < len(exp["ordered_edge_ids"]) or len(exp["ordered_edge_ids"]) == 1,
                    f"{profile_key} cycle {cycle_id} must terminate before its declared inventory when it fails",
                )
        return tally

    checkpoint_cycle_tally = audit_cycles("collection_checkpoint", checkpoint_cycle_set, 4)
    portfolio_cycle_tally = audit_cycles("collections_portfolio", portfolio_cycle_set, 5)

    combined_cycle = {
        "cycle_count": 9,
        "stable": checkpoint_cycle_tally["stable"] + portfolio_cycle_tally["stable"],
        "history_sensitive": checkpoint_cycle_tally["history_sensitive"] + portfolio_cycle_tally["history_sensitive"],
        "unresolved": checkpoint_cycle_tally["unresolved"] + portfolio_cycle_tally["unresolved"],
        "out_of_domain": checkpoint_cycle_tally["out_of_domain"] + portfolio_cycle_tally["out_of_domain"],
        "violation": checkpoint_cycle_tally["violation"] + portfolio_cycle_tally["violation"],
    }
    require(combined_cycle == contract["combined_cycle_aggregate"], "combined_cycle_aggregate")

    print(
        json.dumps(
            {
                "ok": True,
                "package_id": "cross-object-transformation-stability-v0",
                "fixture_set_sha256": fixture_set_sha256,
                "combined_flat_aggregate": combined_flat,
                "combined_cycle_aggregate": combined_cycle,
                "production_imports": 0,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 -- bounded auditor surface
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from exc
