#!/usr/bin/env python3
"""Reference external Chronicle producer, v0.

Independent implementation. Imports zero ReceiptOS production code, invokes
no Node/Bun, invokes no Git, uses no network. Reads only the portable seed
(fixtures/input-seed.json) and this file's own algorithms, and writes a
deterministic four-file portable package:

  producer-manifest.json
  collections.json
  portfolio.json
  checkpoint.json

Every Chronicle root, every Collection ref, and every array normalization is
computed from scratch here -- never copied from committed expected/ fixtures
and never read back from them. Running this script twice with the same
--seed/--scenario must produce byte-identical output; the committed
expected/positive/ files are exactly one frozen run of --scenario main.

Usage:
  python producer_reference.py --seed fixtures/input-seed.json --scenario main --out /some/dir
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Portable v0 bounds (package-local only; not a claim about ReceiptOS domain
# semantics -- see contract.json -> bounds).
# ---------------------------------------------------------------------------

MAX_FILE_BYTES = 65536
MAX_COLLECTIONS_COUNT = 16
MAX_ARRAY_LENGTH = 64
MAX_STRING_LENGTH = 256
MAX_JSON_DEPTH = 8
MAX_INT = (1 << 53) - 1  # JS Number.MAX_SAFE_INTEGER

IDENTIFIER_RE_SOURCE = r"^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$"
import re

IDENTIFIER_RE = re.compile(IDENTIFIER_RE_SOURCE)

CHRONICLE_COLLECTION_VERSION_V0 = "chronicle.collection.v0"
CHRONICLE_PORTFOLIO_VERSION_V0 = "chronicle_portfolio.v0"
CHRONICLE_CHECKPOINT_VERSION_V0 = "chronicle_checkpoint.v0"


class PortableInputError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Strict JSON reading: rejects duplicate object keys and any JSON number that
# is not a plain non-negative integer literal (no fractional/exponential
# form, no NaN/Infinity -- Python's json module is more permissive than the
# JSON spec here by default and must be locked down explicitly).
# ---------------------------------------------------------------------------


def _no_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    seen: dict[str, object] = {}
    for key, value in pairs:
        if key in seen:
            raise PortableInputError(f"duplicate object key: {key!r}")
        seen[key] = value
    return seen


def _reject_float(_text: str) -> float:
    raise PortableInputError("non-integer JSON number is not permitted in this schema")


def _reject_constant(name: str) -> float:
    raise PortableInputError(f"JSON constant {name!r} is not permitted (not valid JSON)")


def _max_depth(value: object, depth: int = 0) -> int:
    if depth > MAX_JSON_DEPTH:
        raise PortableInputError(f"JSON nesting exceeds max depth {MAX_JSON_DEPTH}")
    if isinstance(value, dict):
        return max((_max_depth(v, depth + 1) for v in value.values()), default=depth)
    if isinstance(value, list):
        return max((_max_depth(v, depth + 1) for v in value), default=depth)
    return depth


def strict_json_loads(raw: bytes, *, source_label: str) -> object:
    if len(raw) > MAX_FILE_BYTES:
        raise PortableInputError(f"{source_label}: exceeds max file bytes ({MAX_FILE_BYTES})")
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
# Canonical JSON -- mirrors src/receiptos/canon/canonicalize.ts exactly:
# object keys sorted, array order preserved (including duplicates), no
# Unicode normalization performed anywhere.
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
            json.dumps(key, ensure_ascii=False) + ":" + canonicalize(value[key])
            for key in sorted(value)
        ) + "}"
    raise PortableInputError(f"unsupported canonical value: {type(value)!r}")


def sha256_canonical(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Collection-ref derivation: the exact byte-level equivalent of the frozen
# TS `"/collection/" + encodeURIComponent(collection_id)`. encodeURIComponent
# leaves `A-Za-z0-9 - _ . ! ~ * ' ( )` unescaped and percent-encodes every
# other byte of the UTF-8 encoding, uppercase hex. This is NOT the same as
# Python's urllib.parse.quote with any built-in `safe` set -- quote's default
# always-safe set is only letters/digits/`_.-~`, so it percent-encodes
# `! * ' ( )`, which encodeURIComponent does not. Confirmed empirically
# against a real JS engine during design (see SPEC.md).
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Duplicate-preserving multiset ordering.
#
# Two textually distinct comparators exist in the frozen implementation and
# must not be conflated:
#   - Collection.artifact_refs / Portfolio.collection_refs: sorted via
#     `String.prototype.localeCompare` (locale/ICU-dependent).
#   - Checkpoint.entry_refs: sorted via plain `<`/`>` (codepoint order) when
#     computing the canonical entry-ref order, but the checkpoint_root
#     preimage itself uses STORED order, never re-sorted.
# Because general non-ASCII localeCompare is not language-portable, this v0
# package restricts every normative identifier to IDENTIFIER_RE (lowercase
# ASCII alnum + internal hyphen) -- a grammar within which Python's plain
# codepoint sort and the real localeCompare-based sort are proven to agree
# for every string actually used in this package's matrix (see the
# comparator-agreement test in the focused ReceiptOS suite, which sorts the
# same strings both ways using the real, unmodified TS sort functions).
# This package does NOT claim general Unicode interoperability.
# ---------------------------------------------------------------------------


def sort_refs(refs: list[str]) -> list[str]:
    return sorted(refs)


# ---------------------------------------------------------------------------
# Root formulas -- exact frozen preimages.
# ---------------------------------------------------------------------------


def compute_collection_root(collection_version: str, collection_id: str, artifact_refs: list[str]) -> str:
    return sha256_canonical(
        {
            "collection_version": collection_version,
            "collection_id": collection_id,
            "artifact_refs": sort_refs(artifact_refs),
        }
    )


def compute_portfolio_root(portfolio_version: str, portfolio_id: str, collection_refs: list[str]) -> str:
    return sha256_canonical(
        {
            "portfolio_version": portfolio_version,
            "portfolio_id": portfolio_id,
            "collection_refs": sort_refs(collection_refs),
        }
    )


def compute_checkpoint_root(
    schema: str,
    checkpoint_id: str,
    collection_ref: str,
    entry_refs: list[str],
    prev_checkpoint: str | None,
    sequence: int,
) -> str:
    return sha256_canonical(
        {
            "schema": schema,
            "checkpoint_id": checkpoint_id,
            "collection_ref": collection_ref,
            # Stored order, never re-sorted -- matches the frozen
            # checkpoint_root preimage exactly.
            "entry_refs": list(entry_refs),
            "prev_checkpoint": prev_checkpoint,
            "sequence": sequence,
        }
    )


# ---------------------------------------------------------------------------
# Applicability rules (documented, not invented -- see SPEC.md item 3).
# ---------------------------------------------------------------------------


def check_collections_applicability(collections: list[dict]) -> None:
    if len(collections) == 0:
        raise PortableInputError("chronicle_collections_portfolio_empty")


def check_checkpoint_applicability(sequence: int, prev_checkpoint: str | None) -> None:
    if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
        raise PortableInputError("chronicle_checkpoint_shape_invalid")
    if sequence == 0 and prev_checkpoint is not None:
        raise PortableInputError("chronicle_checkpoint_shape_invalid")
    if sequence > 0 and prev_checkpoint is None:
        raise PortableInputError("chronicle_checkpoint_shape_invalid")


def validate_identifier(value: str, *, label: str, allow_escaping_exception: bool = False) -> None:
    if len(value) > MAX_STRING_LENGTH:
        raise PortableInputError(f"{label}: exceeds max string length ({MAX_STRING_LENGTH})")
    if allow_escaping_exception:
        return
    if not IDENTIFIER_RE.match(value):
        raise PortableInputError(f"{label}: does not match the normative bounded identifier grammar")


# ---------------------------------------------------------------------------
# Object builders.
# ---------------------------------------------------------------------------


def build_collection(collection_id: str, artifact_refs: list[str], *, bad_root: bool = False) -> dict:
    root = compute_collection_root(CHRONICLE_COLLECTION_VERSION_V0, collection_id, artifact_refs)
    if bad_root:
        root = "sha256:" + ("0" * 64)
    return {
        "schema": CHRONICLE_COLLECTION_VERSION_V0,
        "collection_version": CHRONICLE_COLLECTION_VERSION_V0,
        "collection_id": collection_id,
        "artifact_refs": list(artifact_refs),
        "collection_root": root,
    }


def build_portfolio(portfolio_id: str, collection_refs: list[str], *, bad_root: bool = False) -> dict:
    root = compute_portfolio_root(CHRONICLE_PORTFOLIO_VERSION_V0, portfolio_id, collection_refs)
    if bad_root:
        root = "sha256:" + ("1" * 64)
    return {
        "schema": CHRONICLE_PORTFOLIO_VERSION_V0,
        "portfolio_version": CHRONICLE_PORTFOLIO_VERSION_V0,
        "portfolio_id": portfolio_id,
        "collection_refs": list(collection_refs),
        "portfolio_root": root,
    }


def build_checkpoint(
    checkpoint_id: str,
    collection_ref: str,
    entry_refs: list[str],
    prev_checkpoint: str | None,
    sequence: int,
    *,
    bad_root: bool = False,
    skip_applicability_check: bool = False,
) -> dict:
    if not skip_applicability_check:
        check_checkpoint_applicability(sequence, prev_checkpoint)
    root = compute_checkpoint_root(
        CHRONICLE_CHECKPOINT_VERSION_V0, checkpoint_id, collection_ref, entry_refs, prev_checkpoint, sequence
    )
    if bad_root:
        root = "sha256:" + ("2" * 64)
    return {
        "schema": CHRONICLE_CHECKPOINT_VERSION_V0,
        "checkpoint_id": checkpoint_id,
        "collection_ref": collection_ref,
        "entry_refs": list(entry_refs),
        "prev_checkpoint": prev_checkpoint,
        "sequence": sequence,
        "checkpoint_root": root,
    }


# ---------------------------------------------------------------------------
# Scenarios. Every scenario is producer-side construction/mutation logic --
# no ReceiptOS production helper is invoked anywhere in this file.
# ---------------------------------------------------------------------------

SCENARIO_NAMES = [
    # Positive
    "main",
    "reorder",
    "duplicate",
    # Negative
    "wrong_collection_root",
    "wrong_portfolio_root",
    "wrong_checkpoint_root",
    "stale_checkpoint_ref",
    "missing_portfolio_ref",
    "extra_portfolio_ref",
    "duplicate_multiplicity_mismatch",
    "invalid_checkpoint_sequence",
    "empty_collections",
    "malformed_array",
    "producer_false_valid_claim",
]


def load_seed(seed_path: Path) -> dict:
    return strict_json_loads(seed_path.read_bytes(), source_label=str(seed_path))


def build_scenario(scenario: str, seed: dict) -> tuple[list[dict], dict, dict, dict]:
    """Returns (collections, portfolio, checkpoint, claims)."""
    collections_seed = seed["collections"]
    for entry in collections_seed:
        validate_identifier(entry["collection_id"], label="collection_id")
        for ref in entry["artifact_refs"]:
            validate_identifier(ref, label="artifact_ref")
    portfolio_id = seed["portfolio"]["portfolio_id"]
    checkpoint_seed = seed["checkpoint"]
    checkpoint_id = checkpoint_seed["checkpoint_id"]
    entry_refs = list(checkpoint_seed["entry_refs"])
    references_collection_id = checkpoint_seed["references_collection_id"]

    def alpha() -> dict:
        return collections_seed[0]

    def beta() -> dict:
        return collections_seed[1]

    honest_claims = {"producer_believes_locally_valid": True, "producer_believes_cross_link_valid": True}

    if scenario == "main":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, honest_claims

    if scenario == "reorder":
        collections_raw = [build_collection(c["collection_id"], list(reversed(c["artifact_refs"]))) for c in collections_seed]
        collections = list(reversed(collections_raw))
        refs = list(reversed([derive_collection_ref(c["collection_id"]) for c in collections_seed]))
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, honest_claims

    if scenario == "duplicate":
        base = alpha()
        dup_a = build_collection(base["collection_id"], base["artifact_refs"])
        dup_b = build_collection(base["collection_id"], base["artifact_refs"])
        ref = derive_collection_ref(base["collection_id"])
        portfolio = build_portfolio(portfolio_id, [ref, ref])
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return [dup_a, dup_b], portfolio, checkpoint, honest_claims

    dishonest_claims = {"producer_believes_locally_valid": False, "producer_believes_cross_link_valid": False}

    if scenario == "wrong_collection_root":
        collections = [build_collection(alpha()["collection_id"], alpha()["artifact_refs"], bad_root=True)] + [
            build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed[1:]
        ]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "wrong_portfolio_root":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs, bad_root=True)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "wrong_checkpoint_root":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0, bad_root=True)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "stale_checkpoint_ref":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        stale_ref = derive_collection_ref(references_collection_id) + "-stale"
        # Checkpoint stays LOCALLY valid: its own root is recomputed to
        # match the (fabricated) stale ref, so only the cross-link fails.
        checkpoint = build_checkpoint(checkpoint_id, stale_ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "missing_portfolio_ref":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(beta()["collection_id"])]  # drop alpha's ref
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "extra_portfolio_ref":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed] + ["/collection/collection-ext-not-in-corpus"]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "duplicate_multiplicity_mismatch":
        base = alpha()
        dup_a = build_collection(base["collection_id"], base["artifact_refs"])
        dup_b = build_collection(base["collection_id"], base["artifact_refs"])
        ref = derive_collection_ref(base["collection_id"])
        portfolio = build_portfolio(portfolio_id, [ref])  # stored once, derived multiset has 2
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return [dup_a, dup_b], portfolio, checkpoint, dishonest_claims

    if scenario == "invalid_checkpoint_sequence":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        # sequence 0 with a non-null prev_checkpoint violates the shape rule.
        checkpoint = build_checkpoint(
            checkpoint_id, ref, entry_refs, "checkpoint-ext-0-prior", 0, skip_applicability_check=True
        )
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "empty_collections":
        ref = derive_collection_ref(references_collection_id)
        portfolio = build_portfolio(portfolio_id, [])
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return [], portfolio, checkpoint, dishonest_claims

    if scenario == "malformed_array":
        collections = [build_collection(c["collection_id"], c["artifact_refs"]) for c in collections_seed]
        collections[0] = dict(collections[0])
        collections[0]["artifact_refs"] = None  # malformed: not an array
        refs = [derive_collection_ref(c["collection_id"]) for c in collections_seed]
        portfolio = build_portfolio(portfolio_id, refs)
        ref = derive_collection_ref(references_collection_id)
        checkpoint = build_checkpoint(checkpoint_id, ref, entry_refs, None, 0)
        return collections, portfolio, checkpoint, dishonest_claims

    if scenario == "producer_false_valid_claim":
        collections, portfolio, checkpoint, _ = build_scenario("wrong_collection_root", seed)
        # The lie: this producer claims validity even though the collection
        # root above is deliberately wrong.
        return collections, portfolio, checkpoint, {
            "producer_believes_locally_valid": True,
            "producer_believes_cross_link_valid": True,
        }

    raise PortableInputError(f"unknown scenario: {scenario!r}")


def write_package(out_dir: Path, scenario: str, collections: list[dict], portfolio: dict, checkpoint: dict, claims: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    def dump(doc: object) -> bytes:
        return (json.dumps(doc, indent=2, ensure_ascii=False) + "\n").encode("utf-8")

    collections_bytes = dump(collections)
    portfolio_bytes = dump(portfolio)
    checkpoint_bytes = dump(checkpoint)

    (out_dir / "collections.json").write_bytes(collections_bytes)
    (out_dir / "portfolio.json").write_bytes(portfolio_bytes)
    (out_dir / "checkpoint.json").write_bytes(checkpoint_bytes)

    manifest = {
        "schema": "chronicle_external_producer_manifest.v0",
        "scenario": scenario,
        "producer_id": "chronicle-external-producer-reference-v0",
        "producer_version": "0.1.0",
        "files": [
            {"path": "collections.json", "sha256": hashlib.sha256(collections_bytes).hexdigest()},
            {"path": "portfolio.json", "sha256": hashlib.sha256(portfolio_bytes).hexdigest()},
            {"path": "checkpoint.json", "sha256": hashlib.sha256(checkpoint_bytes).hexdigest()},
        ],
        "claims": claims,
    }
    (out_dir / "producer-manifest.json").write_bytes(dump(manifest))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", required=True)
    parser.add_argument("--scenario", required=True, choices=SCENARIO_NAMES)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)

    seed = load_seed(Path(args.seed))
    collections, portfolio, checkpoint, claims = build_scenario(args.scenario, seed)
    write_package(Path(args.out), args.scenario, collections, portfolio, checkpoint, claims)
    print(json.dumps({"ok": True, "scenario": args.scenario, "out": str(Path(args.out).resolve())}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except PortableInputError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)
