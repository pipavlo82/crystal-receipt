import hashlib
from typing import Dict

PREFIX = "crystal-receipt:v0.2"
SEED_KEYS = [
    "shape_seed",
    "palette_seed",
    "symmetry_seed",
    "layer_seed",
    "oxide_seed",
    "trait_seed",
]


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _is_hex_64(value: str) -> bool:
    if len(value) != 64:
        return False
    return all(ch in "0123456789abcdefABCDEF" for ch in value)


def derive_seed_material(canonical_hash: str) -> Dict[str, str]:
    normalized = canonical_hash.lower()
    if not _is_hex_64(normalized):
        raise ValueError("canonical_hash must be a 64-character SHA-256 hex digest")

    master_seed = _sha256_hex(f"{PREFIX}:master:{normalized}")
    result = {
        "canonical_hash": normalized,
        "master_seed": master_seed,
    }
    for key in SEED_KEYS:
        result[key] = _sha256_hex(f"{PREFIX}:{key}:{master_seed}")
    return result
