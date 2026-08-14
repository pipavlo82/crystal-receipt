#!/usr/bin/env python3
"""Independent verifier for external Chronicle producer output, v0.

This is a SEPARATE implementation from producer_reference.py -- it imports
nothing from that file and nothing from ReceiptOS production code. It
re-derives every algorithm from scratch from this package's own contract
(canonicalize, SHA-256 roots, Collection-ref derivation, duplicate-preserving
multiset comparison, applicability rules) and treats every producer-authored
claim -- including `claims.producer_believes_locally_valid`,
`claims.producer_believes_cross_link_valid`, and file digests -- as
untrusted. Digests prove transport integrity only, never semantic validity.

Usage:
  python verify_output.py --package /some/dir
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

MAX_FILE_BYTES = 65536
MAX_COLLECTIONS_COUNT = 16
MAX_ARRAY_LENGTH = 64
MAX_STRING_LENGTH = 256
MAX_JSON_DEPTH = 8

IDENTIFIER_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$")

CHRONICLE_COLLECTION_VERSION_V0 = "chronicle.collection.v0"
CHRONICLE_PORTFOLIO_VERSION_V0 = "chronicle_portfolio.v0"
CHRONICLE_CHECKPOINT_VERSION_V0 = "chronicle_checkpoint.v0"

REQUIRED_FILES = ["producer-manifest.json", "collections.json", "portfolio.json", "checkpoint.json"]


class RejectedError(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class UnresolvedError(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# ---------------------------------------------------------------------------
# Strict JSON reading -- independently written (not shared with
# producer_reference.py). Same rules: no duplicate keys, no non-integer
# numbers, no NaN/Infinity, bounded depth and size.
# ---------------------------------------------------------------------------


def _no_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    seen: dict[str, object] = {}
    for key, value in pairs:
        if key in seen:
            raise RejectedError(f"duplicate_object_key:{key}")
        seen[key] = value
    return seen


def _reject_float(_text: str) -> float:
    raise RejectedError("non_integer_json_number")


def _reject_constant(name: str) -> float:
    raise RejectedError(f"invalid_json_constant:{name}")


def _max_depth(value: object, depth: int = 0) -> int:
    if depth > MAX_JSON_DEPTH:
        raise RejectedError("json_nesting_depth_exceeded")
    if isinstance(value, dict):
        return max((_max_depth(v, depth + 1) for v in value.values()), default=depth)
    if isinstance(value, list):
        return max((_max_depth(v, depth + 1) for v in value), default=depth)
    return depth


def strict_json_loads(raw: bytes, *, label: str) -> object:
    if len(raw) > MAX_FILE_BYTES:
        raise RejectedError(f"file_too_large:{label}")
    text = raw.decode("utf-8")
    value = json.loads(
        text,
        object_pairs_hook=_no_duplicate_keys,
        parse_float=_reject_float,
        parse_constant=_reject_constant,
    )
    _max_depth(value)
    return value


# ---------------------------------------------------------------------------
# Canonical JSON / root formulas / ref derivation -- independently written.
# ---------------------------------------------------------------------------


def canonicalize(value: object) -> str:
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
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            json.dumps(key, ensure_ascii=False) + ":" + canonicalize(value[key]) for key in sorted(value)
        ) + "}"
    raise RejectedError("unsupported_canonical_value")


def sha256_canonical(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


_JS_URI_COMPONENT_UNRESERVED = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    "-_.!~*'()"
)


def encode_uri_component(value: str) -> str:
    out: list[str] = []
    for byte in value.encode("utf-8"):
        char = chr(byte)
        if byte < 128 and char in _JS_URI_COMPONENT_UNRESERVED:
            out.append(char)
        else:
            out.append("%%%02X" % byte)
    return "".join(out)


def derive_collection_ref(collection_id: str) -> str:
    return "/collection/" + encode_uri_component(collection_id)


def sort_refs(refs: list[str]) -> list[str]:
    return sorted(refs)


def compute_collection_root(collection_version: str, collection_id: str, artifact_refs: list[str]) -> str:
    return sha256_canonical(
        {"collection_version": collection_version, "collection_id": collection_id, "artifact_refs": sort_refs(artifact_refs)}
    )


def compute_portfolio_root(portfolio_version: str, portfolio_id: str, collection_refs: list[str]) -> str:
    return sha256_canonical(
        {"portfolio_version": portfolio_version, "portfolio_id": portfolio_id, "collection_refs": sort_refs(collection_refs)}
    )


def compute_checkpoint_root(
    schema: str, checkpoint_id: str, collection_ref: str, entry_refs: list[str], prev_checkpoint, sequence: int
) -> str:
    return sha256_canonical(
        {
            "schema": schema,
            "checkpoint_id": checkpoint_id,
            "collection_ref": collection_ref,
            "entry_refs": list(entry_refs),
            "prev_checkpoint": prev_checkpoint,
            "sequence": sequence,
        }
    )


# ---------------------------------------------------------------------------
# Package-boundary parsing: fixed, non-producer-chosen filenames only.
# Rejects extra files, missing files, path traversal, and case collisions.
# ---------------------------------------------------------------------------


def read_package(package_dir: Path) -> dict[str, bytes]:
    on_disk = sorted(p.name for p in package_dir.iterdir() if p.is_file())
    lower_seen: dict[str, str] = {}
    for name in on_disk:
        lower = name.lower()
        if lower in lower_seen:
            raise RejectedError(f"case_colliding_filename:{lower_seen[lower]}:{name}")
        lower_seen[lower] = name

    missing = [f for f in REQUIRED_FILES if f not in on_disk]
    extra = [f for f in on_disk if f not in REQUIRED_FILES]
    if missing:
        raise RejectedError(f"missing_files:{','.join(missing)}")
    if extra:
        raise RejectedError(f"extra_files:{','.join(extra)}")

    raw: dict[str, bytes] = {}
    for name in REQUIRED_FILES:
        path = package_dir / name
        if path.resolve().parent != package_dir.resolve():
            raise RejectedError(f"path_traversal:{name}")
        data = path.read_bytes()
        if b"\r" in data:
            raise RejectedError(f"crlf_or_cr_byte_drift:{name}")
        raw[name] = data
    return raw


def verify_manifest_digests(manifest: dict, raw: dict[str, bytes]) -> None:
    files = manifest.get("files")
    if not isinstance(files, list):
        raise RejectedError("manifest_files_missing")
    declared_paths = set()
    for entry in files:
        path = entry.get("path")
        if path not in ("collections.json", "portfolio.json", "checkpoint.json"):
            raise RejectedError(f"manifest_path_not_allowed:{path}")
        declared_paths.add(path)
        actual = hashlib.sha256(raw[path]).hexdigest()
        if actual != entry.get("sha256"):
            # Transport-corruption signal only -- never semantic validity.
            raise RejectedError(f"manifest_digest_mismatch:{path}")
    if declared_paths != {"collections.json", "portfolio.json", "checkpoint.json"}:
        raise RejectedError("manifest_files_incomplete")


# ---------------------------------------------------------------------------
# Local + pairwise verification.
# ---------------------------------------------------------------------------


def verify_collection(collection: dict) -> dict:
    try:
        artifact_refs = collection["artifact_refs"]
        if not isinstance(artifact_refs, list):
            raise UnresolvedError("chronicle_external_producer_recompute_failed")
        if len(artifact_refs) > MAX_ARRAY_LENGTH:
            raise RejectedError("array_too_long:artifact_refs")
        recomputed = compute_collection_root(collection["collection_version"], collection["collection_id"], artifact_refs)
        return {
            "collection_id": collection["collection_id"],
            "claimed_root": collection["collection_root"],
            "recomputed_root": recomputed,
            "ok": recomputed == collection["collection_root"],
        }
    except (KeyError, TypeError):
        raise UnresolvedError("chronicle_external_producer_recompute_failed")


def verify_portfolio(portfolio: dict) -> dict:
    try:
        collection_refs = portfolio["collection_refs"]
        if not isinstance(collection_refs, list):
            raise UnresolvedError("chronicle_external_producer_recompute_failed")
        if len(collection_refs) > MAX_ARRAY_LENGTH:
            raise RejectedError("array_too_long:collection_refs")
        recomputed = compute_portfolio_root(portfolio["portfolio_version"], portfolio["portfolio_id"], collection_refs)
        return {
            "claimed_root": portfolio["portfolio_root"],
            "recomputed_root": recomputed,
            "ok": recomputed == portfolio["portfolio_root"],
        }
    except (KeyError, TypeError):
        raise UnresolvedError("chronicle_external_producer_recompute_failed")


def verify_checkpoint(checkpoint: dict) -> dict:
    try:
        sequence = checkpoint["sequence"]
        prev_checkpoint = checkpoint["prev_checkpoint"]
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            raise RejectedError("chronicle_checkpoint_shape_invalid")
        if sequence == 0 and prev_checkpoint is not None:
            raise RejectedError("chronicle_checkpoint_shape_invalid")
        if sequence > 0 and prev_checkpoint is None:
            raise RejectedError("chronicle_checkpoint_shape_invalid")

        entry_refs = checkpoint["entry_refs"]
        if not isinstance(entry_refs, list):
            raise UnresolvedError("chronicle_external_producer_recompute_failed")
        if len(entry_refs) > MAX_ARRAY_LENGTH:
            raise RejectedError("array_too_long:entry_refs")

        recomputed = compute_checkpoint_root(
            checkpoint["schema"], checkpoint["checkpoint_id"], checkpoint["collection_ref"], entry_refs, prev_checkpoint, sequence
        )
        return {
            "claimed_root": checkpoint["checkpoint_root"],
            "recomputed_root": recomputed,
            "ok": recomputed == checkpoint["checkpoint_root"],
        }
    except (KeyError, TypeError):
        raise UnresolvedError("chronicle_external_producer_recompute_failed")


def verify_package(package_dir: Path) -> dict:
    raw = read_package(package_dir)

    manifest = strict_json_loads(raw["producer-manifest.json"], label="producer-manifest.json")
    verify_manifest_digests(manifest, raw)

    collections = strict_json_loads(raw["collections.json"], label="collections.json")
    portfolio = strict_json_loads(raw["portfolio.json"], label="portfolio.json")
    checkpoint = strict_json_loads(raw["checkpoint.json"], label="checkpoint.json")

    if not isinstance(collections, list):
        raise UnresolvedError("chronicle_external_producer_recompute_failed")

    # Applicability: bundle cardinality, checked before any recompute.
    if len(collections) == 0:
        return {
            "classification": "out_of_domain",
            "reason": "chronicle_collections_portfolio_empty",
            "manifest": manifest,
        }
    if len(collections) > MAX_COLLECTIONS_COUNT:
        raise RejectedError("too_many_collections")

    # Applicability: Checkpoint sequence/prev_checkpoint shape.
    try:
        sequence = checkpoint["sequence"]
        prev_checkpoint = checkpoint["prev_checkpoint"]
        shape_invalid = (
            not isinstance(sequence, int)
            or isinstance(sequence, bool)
            or sequence < 0
            or (sequence == 0 and prev_checkpoint is not None)
            or (sequence > 0 and prev_checkpoint is None)
        )
    except (KeyError, TypeError):
        raise UnresolvedError("chronicle_external_producer_recompute_failed")
    if shape_invalid:
        return {
            "classification": "out_of_domain",
            "reason": "chronicle_checkpoint_shape_invalid",
            "manifest": manifest,
        }

    collection_results = [verify_collection(c) for c in collections]
    portfolio_result = verify_portfolio(portfolio)
    checkpoint_result = verify_checkpoint(checkpoint)

    derived_refs = sort_refs([derive_collection_ref(c["collection_id"]) for c in collections])
    stored_refs = sort_refs(portfolio["collection_refs"])
    portfolio_link_valid = derived_refs == stored_refs

    checkpoint_membership_valid = checkpoint["collection_ref"] in derived_refs

    all_local_valid = (
        all(r["ok"] for r in collection_results) and portfolio_result["ok"] and checkpoint_result["ok"]
    )
    accepted = all_local_valid and portfolio_link_valid and checkpoint_membership_valid

    return {
        "classification": "stable" if accepted else "violation",
        "reason": None if accepted else "normative_projection_mismatch",
        "collections": collection_results,
        "portfolio": portfolio_result,
        "checkpoint": checkpoint_result,
        "derived_collection_refs": derived_refs,
        "stored_collection_refs": stored_refs,
        "portfolio_link_valid": portfolio_link_valid,
        "checkpoint_membership_valid": checkpoint_membership_valid,
        "manifest": manifest,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", required=True)
    args = parser.parse_args(argv)

    package_dir = Path(args.package)
    try:
        result = verify_package(package_dir)
        print(json.dumps({"ok": True, **result}, indent=2, default=str))
        return 0
    except UnresolvedError as error:
        print(json.dumps({"ok": True, "classification": "unresolved", "reason": error.reason}, indent=2))
        return 0
    except RejectedError as error:
        print(json.dumps({"ok": False, "classification": "rejected", "reason": error.reason}, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
