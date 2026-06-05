import copy
import hashlib
import json
from pathlib import Path
from typing import Any, Dict


def load_receipt(path: str) -> Dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def canonicalize_receipt(receipt: Dict[str, Any]) -> str:
    receipt_copy = copy.deepcopy(receipt)
    return json.dumps(receipt_copy, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_receipt_hash(receipt: Dict[str, Any]) -> str:
    canonical = canonicalize_receipt(receipt)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
