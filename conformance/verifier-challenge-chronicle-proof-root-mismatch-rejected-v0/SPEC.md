# Verifier Challenge proof_root_mismatch_rejected v0 (Chronicle admission)

Frozen profile: `verifier-challenge-chronicle-proof-root-mismatch-rejected-v0`

This package freezes exactly one Chronicle admission challenge vector
demonstrating **cross-object proof-root mismatch rejection**: independently
verified HandoffEvidence must not establish Chronicle admission when the
portable proof object's top-level `receipt_root` disagrees with the verified
evidence root.

It does **not** freeze all Chronicle admission semantics, receipt-root verifier
challenge-set completeness, evidence_root_missing, evidence_root_mismatch,
capsule label consistency, verifier_result consistency, proof_object_id
validity, proof_ref validity, timing semantics, TEE admission, semantic
neighbors, DCN, verifier-of-verifier, legal admissibility, settlement
correctness, or general malformed-input handling.

## Subject admission verifier

- Entrypoint: `tryCreateChronicleEntryV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Pinned by Git blob OID in the vector and contract.

`createChronicleEntryV0` is a throwing compatibility wrapper and is not the
frozen subject entrypoint.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Admission versus receipt-root verification

HandoffEvidence receipt-root verification and Chronicle admission are separate
gates.

For this vector:

1. Baseline HandoffEvidence independently recomputes successfully through the
   admission gate's evidence-root checks.
2. The same unchanged evidence remains valid under `verifyHandoffReceiptRoot`
   (`ok: true`).
3. A single mutation to `proof_object.receipt_root` blocks Chronicle admission
   at the cross-object proof-root binding without altering evidence bytes.

## Challenge semantics

### Governed input

Admission inputs derived from the pinned baseline authority:

- `tests/fixtures/receiptos-chronicle-admission-v0/vectors/01-clean-admitted.json`

The vector uses `input.evidence`, `input.proof_object`, and `input.options`
from that fixture.

### Cross-object binding

`proof_object.receipt_root` is a cross-object admission binding field. After
evidence-root presence and recomputation succeed, admission compares
`proofObject.receipt_root` to the verified evidence root.

### Mutation rule

Apply exactly one mutation to a deep clone of baseline admission inputs:

- path: `proof_object.receipt_root`
- from: `0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`
- to: `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`

No HandoffEvidence field may change. `anchor.receipt_root`, `proof_object_id`,
`proof_ref`, capsule fields, and provenance fields MUST remain unchanged.

### Exact challenged failure

```json
{
  "success": false,
  "failure": {
    "failure_class": "cross_object_inconsistency",
    "reason_code": "proof_root_mismatch"
  }
}
```

The admission gate is first-failure-wins for this frozen input. This vector
does not alter evidence bytes.

### Receipt-root control

Unchanged HandoffEvidence must satisfy:

```json
{
  "ok": true,
  "receipt_root": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
  "recomputed_root": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"
}
```

This control demonstrates receipt verification succeeds while Chronicle
admission fails.

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_admitted` | `success: true` with pinned `ChronicleEntryV0` |
| `challenged_admitted` | `success: false` |
| `evidence_receipt_verification_unchanged` | same evidence object before/after mutation |
| `evidence_receipt_verification_ok` | receipt-root control `ok: true` |
| `proof_object_receipt_root_changed_only` | only `proof_object.receipt_root` differs |
| `cross_object_root_mismatch_blocks_admission` | challenged admission rejected |
| `failure_class_exact` | `cross_object_inconsistency` |
| `reason_code_exact` | `proof_root_mismatch` |
| `non_throwing` | `tryCreateChronicleEntryV0` must not throw |

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate mutation scope, field
classification, and encoded admission relation from the frozen spec. They do
not execute `tryCreateChronicleEntryV0` and do not claim independent full
Chronicle admission recomputation.

Production binding executes `tryCreateChronicleEntryV0` and
`verifyHandoffReceiptRoot` in TypeScript tests only.

## Non-goals

- all Chronicle admission semantics
- receipt-root verifier challenge-set completeness
- evidence_root_missing / evidence_root_mismatch admission vectors
- capsule label / verifier_result consistency vectors
- proof_object_id / proof_ref identity vectors
- timing, TEE, semantic neighbors, DCN, verifier-of-verifier
- legal admissibility or settlement correctness
