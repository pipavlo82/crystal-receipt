import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/counterfactual-audit-boundary-v0"

members = [
    "conformance/counterfactual-audit-boundary-v0/SPEC.md",
]
vector_ids = sorted(p.stem for p in (PKG / "vectors").glob("V-*.json"))
for vid in vector_ids:
    members.append(f"conformance/counterfactual-audit-boundary-v0/vectors/{vid}.json")

files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    files.append({"path": path, "sha256": digest})

result_rows = []
for vid in vector_ids:
    vec = json.loads((PKG / "vectors" / f"{vid}.json").read_text(encoding="utf-8"))
    exp = json.dumps(vec["expected"], ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    digest = hashlib.sha256(exp.encode()).hexdigest()
    result_rows.append(f"{vid}\t{digest}\n")
result_hash = hashlib.sha256("".join(result_rows).encode()).hexdigest()

execution = {}
for vid in vector_ids:
    vec = json.loads((PKG / "vectors" / f"{vid}.json").read_text(encoding="utf-8"))
    cls = "runtime-binding-required" if vec.get("runtime_construction") else vec["execution_class"]
    execution[vid] = {"execution_class": cls}

contract = {
    "schema": "counterfactual_audit_boundary_contract.v0",
    "package_version": "counterfactual-audit-boundary-v0",
    "profile_id": "counterfactual-audit-boundary-v0",
    "authority": {
        "normative_spec": "conformance/counterfactual-audit-boundary-v0/SPEC.md",
        "production_binding": "src/receiptos/challenge/counterfactual-audit-boundary.ts",
        "reference_draft_section": "docs/RECEIPTOS_VERIFIER_CHALLENGE_SET_V0_WORKING_DRAFT.md#141-normative-audit_timestamp-metadata-boundary",
    },
    "member_inventory": sorted(members) + ["conformance/counterfactual-audit-boundary-v0/contract.json", "conformance/counterfactual-audit-boundary-v0/manifest.json"],
    "vector_inventory": vector_ids,
    "byte_domain_rules": {
        "semantic_bytes": "Fresh strict-JSON snapshot from descriptor inspection; reserved audit_timestamp forbidden at all depths.",
        "manifest_file_bytes": "Exact serialized manifest bytes; string encoded UTF-8 once; Uint8Array hashed byte-exactly.",
    },
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_recipe": "Sorted vector IDs: <vector-id>\\t<sha256(canonical expected JSON)>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_sha256": result_hash,
    "vector_execution_classes": {
        "allowed": ["semantic-snapshot", "manifest-file-hash", "runtime-binding-required"],
        "definitions": {
            "semantic-snapshot": "Evaluate snapshotCounterfactualSemanticJson reserved-field rule.",
            "manifest-file-hash": "Evaluate computeCounterfactualManifestFileSha256 byte-domain rule.",
            "runtime-binding-required": "Vector requires production runtime construction; independently verified only through production binding runner.",
        },
        "vectors": execution,
    },
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
contract_hash = hashlib.sha256((PKG / "contract.json").read_bytes()).hexdigest()
files.append({"path": "conformance/counterfactual-audit-boundary-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files if not item["path"].endswith("manifest.json")]
fixture_hash = hashlib.sha256("".join(file_rows).encode()).hexdigest()

manifest = {
    "schema": "counterfactual_audit_boundary_fixture_manifest.v0",
    "package_version": "counterfactual-audit-boundary-v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
}
(PKG / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"fixture_set_sha256": fixture_hash, "expected_result_set_sha256": result_hash, "file_count": manifest["file_count"]}, indent=2))
