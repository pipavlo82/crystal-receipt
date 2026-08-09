#!/usr/bin/env python3
"""Independent recomputation of frozen counterfactual neighborhood identity v0.

No TypeScript / production ReceiptOS imports.
Consumes tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json
and recomputes SHA-256 over the neighborhood object using the Lane B recipe:

- sort object keys ascending
- preserve array order
- compact separators (',', ':')
- keep null
- UTF-8
- SHA-256 lowercase hex

Excludes expected/native/actual outcomes by construction: the fixture already
stores only identity projections.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "neighborhood.json"

NEIGHBORHOOD_SCHEMA = "receiptos.counterfactual_neighborhood.v0"
CHALLENGE_IDENTITY_SCHEMA = "receiptos.counterfactual_challenge_identity.v0"


def canonical_identity_json(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # JSON numbers; reject non-finite
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            raise ValueError("non-finite number")
        # Match JS String(number) / JSON number encoding for integers and floats
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonical_identity_json(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        parts = []
        for key in keys:
            if value[key] is None and key not in value:
                raise ValueError(f"missing key {key}")
            parts.append(f"{json.dumps(key, ensure_ascii=False)}:{canonical_identity_json(value[key])}")
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"unsupported type {type(value)!r}")


def sha256_utf8_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    neighborhood = fixture["neighborhood"]
    expected = fixture["expected_neighborhood_sha256"]

    assert neighborhood["schema"] == NEIGHBORHOOD_SCHEMA
    assert neighborhood["version"] == "v0"
    assert neighborhood["neighborhood_id"] == fixture["neighborhood_id"]
    for member in neighborhood["members"]:
        assert member["schema"] == CHALLENGE_IDENTITY_SCHEMA
        # Explicit null retention for CAB-capable fields
        assert "challenge_id" in member
        assert "subject" in member
        assert "source" in member
        assert "expected" not in member
        assert "native" not in member
        assert "field_classification" not in member

    # Identity digest is over the neighborhood object alone (not the fixture wrapper).
    actual = sha256_utf8_hex(canonical_identity_json(neighborhood))
    if actual != expected:
        print(f"MISMATCH expected={expected} actual={actual}", file=sys.stderr)
        return 1
    print(actual)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
