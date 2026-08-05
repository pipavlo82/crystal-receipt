"""ReceiptOS (Node 3, recompute/receiptos) independent implementation of
crc.claim.v0's claim_id derivation, written from CLAIM.md and CELL-v1.md's
pre-hash gate section. Standard library only.
"""

import datetime
import hashlib
import json

CLAIM_SCHEMA = "crc.claim.v0"

REQUIRED_FIELDS = frozenset({
    "schema",
    "profile_id",
    "policy_version",
    "artifact_hash",
    "artifact_type",
    "claim_body",
    "source_class",
    "verifier_profile",
    "as_of",
    "claimant",
})

_HEX64 = frozenset("0123456789abcdef")
_AS_OF_LEN = len("YYYY-MM-DDTHH:MM:SSZ")
_UINT256_BOUND = 2 ** 256


class ClaimGateError(ValueError):
    """Raised when an input is rejected by the pre-hash conformance gate."""


def _reject_duplicate_pairs(pairs):
    seen = set()
    for key, _ in pairs:
        if key in seen:
            raise ClaimGateError(f"duplicate member: {key!r}")
        seen.add(key)
    return dict(pairs)


def _reject_non_json_constant(value):
    raise ClaimGateError(f"invalid JSON constant: {value}")


def strict_parse(raw_text):
    """Parse JSON text, rejecting duplicate object members at every depth.

    object_pairs_hook fires for every JSON object the scanner encounters
    (top-level and nested), and it sees the raw sequence of key/value pairs
    before they collapse into a dict, so a duplicate is caught before the
    evidence disappears.
    """
    parsed = json.loads(
        raw_text,
        object_pairs_hook=_reject_duplicate_pairs,
        parse_constant=_reject_non_json_constant,
    )
    if not isinstance(parsed, dict):
        raise ClaimGateError("ClaimPreimage must be a top-level JSON object")
    return parsed


def _is_non_empty_str(value):
    return isinstance(value, str) and len(value) > 0


def _validate_as_of(value):
    if not isinstance(value, str) or len(value) != _AS_OF_LEN:
        raise ClaimGateError("as_of: must be RFC3339 UTC, second precision, e.g. YYYY-MM-DDTHH:MM:SSZ")
    if value[4] != "-" or value[7] != "-" or value[10] != "T" or value[13] != ":" or value[16] != ":" or value[19] != "Z":
        raise ClaimGateError("as_of: malformed RFC3339 UTC layout")
    digits = value[0:4] + value[5:7] + value[8:10] + value[11:13] + value[14:16] + value[17:19]
    if not digits.isdigit():
        raise ClaimGateError("as_of: non-digit in date/time components")
    try:
        parsed = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ClaimGateError(f"as_of: not a real UTC instant: {exc}") from exc
    if parsed.strftime("%Y-%m-%dT%H:%M:%SZ") != value:
        raise ClaimGateError("as_of: does not round-trip byte-identically")


def validate_claim_preimage(obj):
    """The universal pre-hash gate (CELL-v1.md section 3). Raises ClaimGateError."""
    if not isinstance(obj, dict):
        raise ClaimGateError("ClaimPreimage must be a JSON object")

    keys = set(obj.keys())
    missing = REQUIRED_FIELDS - keys
    unknown = keys - REQUIRED_FIELDS
    if missing:
        raise ClaimGateError(f"missing field(s): {sorted(missing)}")
    if unknown:
        raise ClaimGateError(f"unknown field(s): {sorted(unknown)}")

    if obj["schema"] != CLAIM_SCHEMA:
        raise ClaimGateError(f"schema must be exactly {CLAIM_SCHEMA!r}")

    for field in ("profile_id", "policy_version", "artifact_type", "source_class", "verifier_profile"):
        if not _is_non_empty_str(obj[field]):
            raise ClaimGateError(f"{field}: must be a non-empty string")

    claim_body = obj["claim_body"]
    if claim_body is not None and not isinstance(claim_body, str):
        raise ClaimGateError("claim_body: must be a string or null")

    artifact_hash = obj["artifact_hash"]
    if not isinstance(artifact_hash, str) or len(artifact_hash) != 64 or any(c not in _HEX64 for c in artifact_hash):
        raise ClaimGateError("artifact_hash: must match ^[0-9a-f]{64}$ (bare hex, no sha256:/0x prefix)")

    claimant = obj["claimant"]
    if type(claimant) is not int:
        raise ClaimGateError("claimant: must be int (bool is not int)")
    if not (0 <= claimant < _UINT256_BOUND):
        raise ClaimGateError("claimant: out of uint256 range")

    _validate_as_of(obj["as_of"])


def _jcs_escape_string(s):
    out = ['"']
    for ch in s:
        cp = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == '\\':
            out.append('\\\\')
        elif ch == '\b':
            out.append('\\b')
        elif ch == '\f':
            out.append('\\f')
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\t':
            out.append('\\t')
        elif cp < 0x20:
            out.append('\\u%04x' % cp)
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _jcs_value(value):
    if value is None:
        return "null"
    if isinstance(value, str):
        return _jcs_escape_string(value)
    if type(value) is int:
        return str(value)
    raise ClaimGateError(f"unsupported value type for JCS in this restricted domain: {type(value)!r}")


def canonicalize_claim_preimage(obj):
    """RFC 8785 JCS over the flat, gate-validated ClaimPreimage object.

    Restricted to this domain (10 fixed fields, values are str/null/int),
    so only the JCS rules that this domain actually exercises are needed:
    lexicographic key order (equivalent to UTF-16 code unit order for these
    ASCII field names) and standard JSON string/number encoding.
    """
    validate_claim_preimage(obj)
    ordered_keys = sorted(obj.keys())
    members = ",".join(f"{_jcs_escape_string(k)}:{_jcs_value(obj[k])}" for k in ordered_keys)
    return ("{" + members + "}").encode("utf-8")


def claim_id(obj):
    """Gate, canonicalize, hash. Returns 'sha256:' + lowercase hex digest."""
    canonical = canonicalize_claim_preimage(obj)
    digest = hashlib.sha256(canonical).hexdigest()
    return f"sha256:{digest}", canonical


if __name__ == "__main__":
    import sys
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        raw = f.read()
    preimage = strict_parse(raw)
    cid, _canonical = claim_id(preimage)
    print(cid)
