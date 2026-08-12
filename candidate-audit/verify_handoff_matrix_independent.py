#!/usr/bin/env python3
"""Independent audit for the Handoff Transformation Stability candidate matrix.

No production TypeScript imports. Recomputes the relevant canonicalization/root
relations directly from the committed HandoffEvidence fixture Git blob at the
pinned baseline commit. Working-tree EOL representation is intentionally ignored.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

BASELINE_COMMIT = "3ec3ca1e94b0d9bde71af99c6f7c36ca69c4fa80"
FIXTURE_REL = "src/receiptos/fixtures/session-evidence.sample.json"
EXPECTED_FIXTURE_BLOB_SHA1 = "a5dbda7662aa95a92a3befa3df28a666319e6740"
EXPECTED_SAMPLE_ROOT = "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"
EXPECTED_NORMATIVE_MUTATION_ROOT = "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e"
EXPECTED_VECTOR_IDS = [
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
        raise AssertionError(
            f"failed to read committed git blob {commit}:{rel_path}",
        ) from error


def committed_git_blob_sha1(repo: Path, commit: str, rel_path: str) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", f"{commit}:{rel_path}"],
            cwd=repo,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as error:
        raise AssertionError(
            f"failed to resolve committed git blob identity {commit}:{rel_path}",
        ) from error


def load_authenticated_fixture(repo: Path, commit: str) -> tuple[bytes, dict]:
    fixture_bytes = read_committed_git_blob_bytes(repo, commit, FIXTURE_REL)
    blob_sha1 = git_blob_sha1(fixture_bytes)
    git_oid = committed_git_blob_sha1(repo, commit, FIXTURE_REL)
    require(blob_sha1 == git_oid, "committed blob sha1/oid mismatch")
    require(blob_sha1 == EXPECTED_FIXTURE_BLOB_SHA1, "fixture blob drift")
    require(b"\r" not in fixture_bytes, "committed fixture blob contains CR")
    fixture = json.loads(fixture_bytes.decode("utf-8"))
    return fixture_bytes, fixture


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository-root", required=True)
    parser.add_argument("--candidate-json", required=True)
    parser.add_argument("--baseline-commit", default=BASELINE_COMMIT)
    args = parser.parse_args()

    repo = Path(args.repository_root).resolve()
    candidate_path = Path(args.candidate_json).resolve()
    baseline_commit = args.baseline_commit

    _fixture_bytes, fixture = load_authenticated_fixture(repo, baseline_commit)

    sample_root = compute_receipt_root(fixture)
    require(sample_root == EXPECTED_SAMPLE_ROOT, "sample root mismatch")
    require(fixture["anchor"]["receipt_root"] == sample_root, "embedded root mismatch")

    normative = json.loads(json.dumps(fixture))
    normative["session_id"] = "session-demo-001-mutated"
    normative_root = compute_receipt_root(normative)
    require(
        normative_root == EXPECTED_NORMATIVE_MUTATION_ROOT,
        "normative mutation root mismatch",
    )
    require(normative_root != sample_root, "normative mutation failed to move N")

    anchor = json.loads(json.dumps(fixture))
    anchor["anchor"]["contract"] = "0xdeadbeef"
    anchor_root = compute_receipt_root(anchor)
    require(anchor_root == sample_root, "anchor mutation unexpectedly moved receipt root")

    candidate_bytes = candidate_path.read_bytes()
    require(b"\r" not in candidate_bytes, "candidate JSON contains CR")
    candidate = json.loads(candidate_bytes.decode("utf-8"))
    require(candidate["baseline_commit"] == baseline_commit, "baseline commit")
    require(candidate["fixture_path"] == FIXTURE_REL, "fixture path")
    require(candidate["fixture_blob_sha1"] == EXPECTED_FIXTURE_BLOB_SHA1, "fixture blob identity")
    require(candidate["sample_receipt_root"] == sample_root, "candidate sample root")
    require(
        candidate["normative_session_id_mutation_root"] == normative_root,
        "candidate normative root",
    )
    require(
        candidate["anchor_contract_mutation_root"] == anchor_root,
        "candidate anchor root",
    )
    require(candidate["expected_aggregate"] == EXPECTED_AGGREGATE, "aggregate")
    require(
        [entry["vector_id"] for entry in candidate["vectors"]] == EXPECTED_VECTOR_IDS,
        "vector inventory/order",
    )

    print(
        json.dumps(
            {
                "ok": True,
                "baseline_commit": baseline_commit,
                "fixture_path": FIXTURE_REL,
                "fixture_blob_sha1": EXPECTED_FIXTURE_BLOB_SHA1,
                "fixture_source": "git_blob",
                "sample_receipt_root": sample_root,
                "normative_mutation_root": normative_root,
                "anchor_mutation_root": anchor_root,
                "vector_count": len(EXPECTED_VECTOR_IDS),
                "expected_aggregate": EXPECTED_AGGREGATE,
                "production_imports": 0,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from exc
