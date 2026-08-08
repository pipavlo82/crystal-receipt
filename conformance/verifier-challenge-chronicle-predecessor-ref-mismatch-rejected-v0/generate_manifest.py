import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0"

members = [
    "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/SPEC.md",
    "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json",
]

files = []
for path in sorted(members):
    data = (ROOT / path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    files.append({"path": path, "sha256": digest})

vector = json.loads((PKG / "vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json").read_text(encoding="utf-8"))
exp = json.dumps(vector["expected"], ensure_ascii=False, separators=(",", ":"), sort_keys=True)
result_hash = hashlib.sha256(
    f"V-CHRONICLE-PREDECESSOR-REF-MISMATCH\t{hashlib.sha256(exp.encode()).hexdigest()}\n".encode()
).hexdigest()

contract = {
    "schema": "verifier_challenge_chronicle_predecessor_ref_mismatch_rejected_contract.v0",
    "package_version": "verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
    "profile_id": "verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
    "challenge_id": "predecessor_ref_mismatch_rejected",
    "authority": {
        "normative_spec": "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/SPEC.md",
        "production_binding": "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
        "baseline_authority": "tests/fixtures/chronicle-checkpoint-continuity-v0.json",
    },
    "required_vector_fields": [
        "vector_id",
        "package_version",
        "challenge_id",
        "execution_class",
        "subject_continuity_evaluator",
        "local_checkpoint_verifier",
        "continuity_profile",
        "source_fixture",
        "baseline_pair",
        "substitution",
        "challenged_pair",
        "field_classification",
        "local_verification_controls",
        "expected",
    ],
    "forbidden_semantics": [
        "global_chain_validity",
        "full_history_ordering",
        "append_ingest_behavior",
        "predecessor_lookup_registry",
        "stale_head_semantics",
        "checkpoint_freshness",
        "observation_index",
        "duplicate_replay_detection",
        "equivocation",
        "predecessor_unknown",
        "sequence_gap",
        "predecessor_same_sequence",
        "predecessor_higher_sequence",
        "chronicle_admission",
        "receipt_root_verifier",
        "rsf",
        "counterfactual",
        "legal_admissibility",
        "settlement_correctness",
    ],
    "continuity_entrypoint": {
        "name": "evaluateChronicleCheckpointContinuityV0",
        "module_path": "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
        "git_blob_oid": "428923f10aac54bfaaebedfad494118cbb17d744",
    },
    "local_checkpoint_verifier": {
        "name": "verifyChronicleCheckpointV0",
        "module_path": "src/receiptos/capsule/chronicle-portfolio-v0.ts",
        "git_blob_oid": "0e790911092546c62344f980e6b611542bcd00fe",
    },
    "source_fixture_identity": {
        "repository_path": "tests/fixtures/chronicle-checkpoint-continuity-v0.json",
        "git_blob_oid": "88a41845d6b5fa16d057b884f113c9df3f4a9e28",
        "baseline_vector_name": "valid_successor",
        "precedent_vector_name": "predecessor_ref_mismatch",
    },
    "normative_spec_identity": {
        "repository_path": "docs/CHRONICLE_CHECKPOINT_CONTINUITY_V0.md",
        "git_blob_oid": "ada3f0f5d5e13eccf6588ee1a9828efa6a7b1703",
    },
    "vector_inventory": ["V-CHRONICLE-PREDECESSOR-REF-MISMATCH"],
    "hash_algorithm": "sha256-lowercase-hex",
    "fixture_set_recipe": "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_recipe": "<vector-id>\\t<sha256(canonical expected JSON)>\\n concatenated UTF-8 then SHA-256.",
    "expected_result_set_sha256": result_hash,
    "vector_execution_classes": {
        "allowed": ["production-continuity-binding"],
        "definitions": {
            "production-continuity-binding": "Execute evaluateChronicleCheckpointContinuityV0 on baseline and challenged checkpoint pairs; compare frozen continuity result fields.",
        },
        "vectors": {
            "V-CHRONICLE-PREDECESSOR-REF-MISMATCH": {"execution_class": "production-continuity-binding"},
        },
    },
    "independence_scope": {
        "package_identity": "Python and TypeScript auditors recompute member and expected-result digests without production imports.",
        "challenge_semantics": "Independent verifier validates substitution scope, gate-order relation, and encoded continuity relation from frozen spec.",
        "production_result": "Actual evaluateChronicleCheckpointContinuityV0 execution is bound only by TypeScript production runner; no claim of independent full continuity recomputation.",
    },
}
(PKG / "contract.json").write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
contract_hash = hashlib.sha256((PKG / "contract.json").read_bytes()).hexdigest()
files.append({"path": "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/contract.json", "sha256": contract_hash})
files.sort(key=lambda item: item["path"])
file_rows = [f'{item["path"]}\t{item["sha256"]}\n' for item in files]
fixture_hash = hashlib.sha256("".join(file_rows).encode()).hexdigest()

manifest = {
    "schema": "verifier_challenge_chronicle_predecessor_ref_mismatch_rejected_fixture_manifest.v0",
    "package_version": "verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
    "file_count": len(files),
    "files": files,
    "fixture_set_sha256": fixture_hash,
}
(PKG / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"fixture_set_sha256": fixture_hash, "expected_result_set_sha256": result_hash, "file_count": len(files)}, indent=2))
