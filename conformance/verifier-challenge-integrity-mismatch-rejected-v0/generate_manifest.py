import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-integrity-mismatch-rejected-v0"

members = [
    "conformance/verifier-challenge-integrity-mismatch-rejected-v0/SPEC.md",
    "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
]

files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    files.append({"path": path, "sha256": digest})

vector = json.loads((PKG / "vectors/V-INTEGRITY-MISMATCH.json").read_text(encoding="utf-8"))
exp = json.dumps(vector["expected"], ensure_ascii=False, separators=(",", ":"), sort_keys=True)
result_hash = hashlib.sha256(
    f"V-INTEGRITY-MISMATCH\t{hashlib.sha256(exp.encode()).hexdigest()}\n".encode()
).hexdigest()

contract = {
    "schema": "verifier_challenge_integrity_mismatch_rejected_contract.v0",
    "package_version": "verifier-challenge-integrity-mismatch-rejected-v0",
    "profile_id": "verifier-challenge-integrity-mismatch-rejected-v0",
    "challenge_id": "integrity_mismatch_rejected",
    "authority": {
        "normative_spec": "conformance/verifier-challenge-integrity-mismatch-rejected-v0/SPEC.md",
        "production_binding": "src/receiptos/verify/verify-receipt.ts",
        "prototype_precedent": "tests/receiptos/verify-receipt.test.ts",
    },
    "required_vector_fields": [
        "vector_id",
        "package_version",
        "challenge_id",
        "execution_class",
        "subject_verifier",
        "receipt_root_profile",
        "source_fixture",
        "baseline_input",
        "mutation",
        "field_classification",
        "expected",
    ],
    "forbidden_semantics": [
        "semantic_neighbors",
        "subject_bundle_root",
        "host_error_taxonomy",
        "capsule_output_comparison",
        "general_tamper_proofing",
        "schema_validation",
        "admission_semantics",
        "timing_semantics",
        "observation_non_elevation",
        "missing_required_input_unverifiability",
    ],
    "verifier_entrypoint": {
        "name": "verifyHandoffReceiptRoot",
        "module_path": "src/receiptos/verify/verify-receipt.ts",
        "git_blob_oid": "2e2e45bf30529de93eac58a04465f17ef81edeaa",
    },
    "source_fixture_identity": {
        "repository_path": "src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json",
        "git_blob_oid": "b1be64dbb71898ab5ffa75660f8e07c3250d8be1",
    },
    "vector_inventory": ["V-INTEGRITY-MISMATCH"],
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_recipe": "<vector-id>\\t<sha256(canonical expected JSON)>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_sha256": result_hash,
    "vector_execution_classes": {
        "allowed": ["production-verifier-binding"],
        "definitions": {
            "production-verifier-binding": "Execute verifyHandoffReceiptRoot on baseline and challenged inputs; compare frozen result fields.",
        },
        "vectors": {
            "V-INTEGRITY-MISMATCH": {"execution_class": "production-verifier-binding"},
        },
    },
    "independence_scope": {
        "package_identity": "Python and TypeScript auditors recompute member and expected-result digests without production imports.",
        "challenge_semantics": "Independent verifier validates mutation scope, field classification, and encoded integrity-mismatch relation from frozen spec.",
        "production_result": "Actual verifyHandoffReceiptRoot execution is bound only by TypeScript production runner; no claim of independent full receipt recomputation.",
    },
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
contract_hash = hashlib.sha256((PKG / "contract.json").read_bytes()).hexdigest()
files.append({"path": "conformance/verifier-challenge-integrity-mismatch-rejected-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = hashlib.sha256("".join(file_rows).encode()).hexdigest()

manifest = {
    "schema": "verifier_challenge_integrity_mismatch_rejected_fixture_manifest.v0",
    "package_version": "verifier-challenge-integrity-mismatch-rejected-v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
}
(PKG / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"fixture_set_sha256": fixture_hash, "expected_result_set_sha256": result_hash, "file_count": len(files)}, indent=2))
