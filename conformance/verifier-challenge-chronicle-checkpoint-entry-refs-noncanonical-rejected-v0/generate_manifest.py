import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0"
VECTOR_ID = "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL"

members = [
    "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/SPEC.md",
    "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
]

vector = json.loads((PKG / "vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json").read_text(encoding="utf-8"))
exp = json.dumps(vector["expected"], ensure_ascii=False, separators=(",", ":"), sort_keys=True)
result_hash = hashlib.sha256(
    f"{VECTOR_ID}\t{hashlib.sha256(exp.encode()).hexdigest()}\n".encode()
).hexdigest()

contract = {
    "schema": "verifier_challenge_chronicle_checkpoint_entry_refs_noncanonical_rejected_contract.v0",
    "package_version": "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    "profile_id": "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    "challenge_id": "checkpoint_entry_refs_noncanonical_rejected",
    "authority": {
        "normative_spec": "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/SPEC.md",
        "production_binding": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
        "baseline_authority": "tests/receiptos/chronicle-checkpoint-v0.test.ts",
    },
    "required_vector_fields": [
        "vector_id",
        "package_version",
        "challenge_id",
        "execution_class",
        "subject_local_checkpoint_verifier",
        "checkpoint_construction_authority",
        "local_verification_profile",
        "baseline_authority",
        "baseline_checkpoint",
        "substitution",
        "challenged_checkpoint",
        "field_classification",
        "canonical_order_control",
        "expected",
    ],
    "forbidden_semantics": [
        "generic_checkpoint_root_tampering",
        "collection_root_verification",
        "portfolio_root_verification",
        "chronicle_entry_admission",
        "pairwise_checkpoint_continuity",
        "fourth_continuity_challenge",
        "sequence_semantics",
        "predecessor_discovery",
        "global_checkpoint_chain",
        "canonical_head_selection",
        "stale_head_semantics",
        "duplicate_replay_detection",
        "equivocation_detection",
        "append_ingest_semantics",
        "legal_admissibility",
        "settlement_correctness",
    ],
    "local_checkpoint_verifier": {
        "name": "verifyChronicleCheckpointV0",
        "module_path": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
        "git_blob_oid": "0e790911092546c62344f980e6b611542bcd00fe",
    },
    "checkpoint_construction_entrypoint": {
        "name": "createChronicleCheckpointV0",
        "module_path": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
        "git_blob_oid": "0e790911092546c62344f980e6b611542bcd00fe",
    },
    "normative_spec_identity": {
        "repository_path": "docs/CHRONICLE.md",
        "git_blob_oid": "327898f793116681646e424f6a7cfc9f9887f2fb",
    },
    "baseline_authority_identity": {
        "repository_path": "tests/receiptos/chronicle-checkpoint-v0.test.ts",
    },
    "vector_inventory": [VECTOR_ID],
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_recipe": "<vector-id>\\t<sha256(canonical expected JSON)>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_sha256": result_hash,
    "vector_execution_classes": {
        "allowed": ["production-checkpoint-local-binding"],
        "definitions": {
            "production-checkpoint-local-binding": "Execute verifyChronicleCheckpointV0 on baseline and challenged checkpoints; compare frozen local verification result fields.",
        },
        "vectors": {
            VECTOR_ID: {"execution_class": "production-checkpoint-local-binding"},
        },
    },
    "independence_scope": {
        "package_identity": "Python and TypeScript auditors recompute member and expected-result digests without production imports.",
        "challenge_semantics": "Independent verifier validates substitution scope, canonical-order relation, and encoded local verification results from frozen spec.",
        "production_result": "Actual verifyChronicleCheckpointV0 execution is bound only by TypeScript production runner; no claim of independent full checkpoint local verification recomputation.",
    },
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
contract_hash = hashlib.sha256((PKG / "contract.json").read_bytes()).hexdigest()

files = []
for path in sorted(members + ["conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/contract.json"]):
    data = (ROOT / path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    files.append({"path": path, "sha256": digest})

file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = hashlib.sha256("".join(file_rows).encode()).hexdigest()

manifest = {
    "schema": "verifier_challenge_chronicle_checkpoint_entry_refs_noncanonical_rejected_fixture_manifest.v0",
    "package_version": "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
}
(PKG / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"fixture_set_sha256": fixture_hash, "expected_result_set_sha256": result_hash, "file_count": len(files)}, indent=2))
