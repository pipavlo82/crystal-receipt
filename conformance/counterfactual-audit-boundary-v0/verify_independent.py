#!/usr/bin/env python3
"""Independent counterfactual-audit-boundary-v0 verifier.

Reads only frozen package files under conformance/counterfactual-audit-boundary-v0/.
Imports no ReceiptOS production code.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "conformance/counterfactual-audit-boundary-v0"
VECTORS = PACKAGE / "vectors"
RESERVED = "audit_timestamp"
PATH_PREFIX = "$semantic_artifact"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_expected(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


class SnapshotError(Exception):
    def __init__(self, path: str, message: str) -> None:
        super().__init__(f"{path}: {message}")
        self.path = path
        self.message = message


def snapshot_json(value: object, path: str = PATH_PREFIX) -> object:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        if not (-(2**53 - 1) <= value <= 2**53 - 1):
            raise SnapshotError(path, "numbers must be finite")
        return value
    if isinstance(value, float):
        if not (value == value and abs(value) != float("inf")):
            raise SnapshotError(path, "numbers must be finite")
        return value
    if isinstance(value, list):
        out = []
        for index, item in enumerate(value):
            out.append(snapshot_json(item, f"{path}[{index}]"))
        return out
    if isinstance(value, dict):
        out: dict[str, object] = {}
        for key in sorted(value):
            child_path = f'{path}[{json.dumps(key)}]'
            if key == RESERVED:
                raise SnapshotError(child_path, "non-semantic audit metadata is forbidden in semantic input")
            out[key] = snapshot_json(value[key], child_path)
        return out
    raise SnapshotError(path, "value is outside the JSON domain")


def manifest_hash(input_spec: dict) -> str:
    encoding = input_spec["encoding"]
    if encoding == "utf8_string":
        data = input_spec["value"].encode("utf-8")
    elif encoding == "uint8_array":
        if "bytes" in input_spec:
            data = bytes(input_spec["bytes"])
        elif "utf8_bytes_of" in input_spec:
            data = input_spec["utf8_bytes_of"].encode("utf-8")
        else:
            raise ValueError("uint8_array input requires bytes or utf8_bytes_of")
    else:
        raise ValueError(f"unknown encoding: {encoding}")
    return sha256_hex(data)


def evaluate_semantic_vector(vector: dict) -> None:
    expected = vector["expected"]
    outcome = expected["outcome"]

    if vector.get("runtime_construction", {}).get("kind") == "changing_accessor_trap":
        raise RuntimeError("runtime construction must be evaluated by the production binding runner")

    if "input_variants" in vector:
        errors = []
        for variant in vector["input_variants"]:
            try:
                snapshot_json(variant)
                errors.append(None)
            except SnapshotError as error:
                errors.append(str(error))
        assert all(item is not None for item in errors), "variants must reject"
        assert len(set(errors)) == 1, "variants must match"
        message = errors[0]
        assert expected["error_path"] in message
        assert expected["error_message_contains"] in message
        return

    if "manifest_variants" in vector:
        artifact = vector["semantic_artifact"]
        canonicals = []
        for _variant in vector["manifest_variants"]:
            snap = snapshot_json(artifact)
            canonicals.append(canonical_expected(snap))
        assert len(set(canonicals)) == 1
        assert canonicals[0] == expected["canonical_snapshot_json"]
        return

    if "baseline_semantic_artifact" in vector:
        base = canonical_expected(snapshot_json(vector["baseline_semantic_artifact"]))
        mutated = canonical_expected(snapshot_json(vector["mutated_semantic_artifact"]))
        assert base != mutated
        return

    if "input" in vector:
        try:
            snap = snapshot_json(vector["input"])
        except SnapshotError as error:
            assert outcome == "rejected"
            message = str(error)
            assert expected["error_path"] in message
            assert expected["error_message_contains"] in message
            return
        assert outcome == "accepted_snapshot"
        if "canonical_snapshot_json" in expected:
            assert canonical_expected(snap) == expected["canonical_snapshot_json"]
        return

    raise ValueError(f"unsupported semantic vector: {vector['vector_id']}")


def evaluate_manifest_vector(vector: dict) -> None:
    expected = vector["expected"]
    hashes = [manifest_hash(item) for item in vector["inputs"]]
    outcome = expected["outcome"]
    if outcome == "manifest_hash_differs":
        assert hashes[0] != hashes[1]
    elif outcome == "manifest_hash_equals":
        assert hashes[0] == hashes[1]
    elif outcome == "manifest_hash_value":
        assert hashes[0] == expected["sha256_hex"]
    else:
        raise ValueError(f"unknown manifest outcome: {outcome}")


def evaluate_vector(vector: dict) -> None:
    operation = vector["operation"]
    if operation == "semantic_snapshot":
        if vector.get("runtime_construction"):
            return
        evaluate_semantic_vector(vector)
    elif operation == "manifest_file_sha256":
        evaluate_manifest_vector(vector)
    else:
        raise ValueError(f"unknown operation: {operation}")


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

    vector_ids = sorted(p.stem for p in VECTORS.glob("V-*.json"))
    assert vector_ids == sorted(contract["vector_inventory"])
    result_rows: list[str] = []
    evaluated = 0
    runtime_only = 0
    for vector_id in vector_ids:
        vector = json.loads((VECTORS / f"{vector_id}.json").read_text(encoding="utf-8"))
        assert vector["vector_id"] == vector_id
        if vector.get("runtime_construction"):
            runtime_only += 1
        else:
            evaluate_vector(vector)
            evaluated += 1
        result_rows.append(f"{vector_id}\t{sha256_hex(canonical_expected(vector['expected']).encode('utf-8'))}\n")
    result_hash = sha256_hex("".join(result_rows).encode("utf-8"))
    assert result_hash == contract["expected_result_set_sha256"]
    return {
        "auditor": "python-independent-counterfactual-audit-boundary-v0",
        "vector_count": len(vector_ids),
        "package_inventory_count": manifest["file_count"],
        "fixture_set_sha256": fixture_hash,
        "expected_result_set_sha256": result_hash,
        "independently_evaluated_vectors": evaluated,
        "runtime_binding_vectors": runtime_only,
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
