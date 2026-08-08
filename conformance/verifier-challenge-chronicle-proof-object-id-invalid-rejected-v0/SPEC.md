# Verifier Challenge proof_object_id_invalid_rejected v0 (Chronicle admission)

Frozen profile: `verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0`

This package freezes exactly one Chronicle admission challenge vector
demonstrating **identity binding rejection**: an invalid portable proof object
identity must not establish Chronicle admission even when HandoffEvidence
receipt-root verification succeeds and cross-object plus reported-state
consistency gates pass.

It does **not** freeze proof_ref validity, all Chronicle identity semantics,
capsule label inconsistency, verifier_result inconsistency, proof_root
mismatch, evidence-root mismatch, missing evidence root, timing, TEE,
semantic neighbors, DCN, verifier-of-verifier, legal admissibility,
settlement correctness, or full Chronicle admission closure.

## Subject admission verifier

- Entrypoint: `tryCreateChronicleEntryV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Pinned by Git blob OID in the vector and contract.

The subject is Chronicle admission, not receipt-root verification.
`createChronicleEntryV0` is a throwing compatibility wrapper and is not the
frozen subject entrypoint.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`.

## Identity derivation authority

- Entrypoint: `deriveProofObjectId`
- Module: `src/receiptos/capsule/portable-proof-object-v0.ts`

Production rule (frozen, not extended):

```text
deriveProofObjectId(receiptRoot) => proofobj-{receiptRoot without 0x prefix}
```

For the verified evidence root
`0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`, the
canonical proof object identity is
`proofobj-687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`.

## Admission gate order

For this vector, gates 1–7 pass and gate 8 rejects (first-failure-wins):

1. evidence root present
2. evidence root recompute match
3. proof_object.receipt_root cross-object match
4. capsule stored root match
5. capsule computed root match
6. capsule match/status consistency
7. capsule verifier_result consistency
8. **proof_object_id identity binding** — challenged failure here
9. proof_ref identity binding — not reached as first failure

## Challenge semantics

### Governed input

Admission inputs derived from the pinned baseline authority:

- `tests/fixtures/receiptos-chronicle-admission-v0/vectors/01-clean-admitted.json`

### Baseline properties

1. The evidence root is independently valid.
2. Cross-object receipt-root consistency remains valid
   (`proof_object.receipt_root` equals verified evidence root; capsule stored
   and computed roots agree).
3. Capsule reported-state consistency remains valid (match/status and
   verifier_result labels consistent with verified state).

### Mutation rule

Apply exactly one mutation to a deep clone of baseline admission inputs:

- path: `proof_object.proof_object_id`
- from: `proofobj-687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`
- to: `proofobj-invalid`

HandoffEvidence MUST remain unchanged. `proof_object.receipt_root`, `proof_ref`,
capsule fields, provenance fields, and Chronicle options MUST remain unchanged.

### Exact challenged failure

```json
{
  "success": false,
  "failure": {
    "failure_class": "identity_inconsistency",
    "reason_code": "proof_object_id_invalid"
  }
}
```

A `proof_object_id` inconsistent with `deriveProofObjectId(verifiedRoot)` must
reject admission at gate 8. This vector does not alter evidence bytes.

### Receipt-root control

Unchanged HandoffEvidence must satisfy:

```json
{
  "ok": true,
  "receipt_root": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
  "recomputed_root": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"
}
```

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_admitted` | `success: true` with pinned `ChronicleEntryV0` |
| `challenged_admitted` | `success: false` |
| `evidence_receipt_verification_unchanged` | same evidence before/after mutation |
| `evidence_receipt_verification_ok` | receipt-root control `ok: true` |
| `proof_object_receipt_root_unchanged` | `proof_object.receipt_root` identical |
| `proof_object_id_changed_only` | only `proof_object.proof_object_id` differs |
| `cross_object_gates_pass` | gates 3–5 would pass on challenged input |
| `reported_state_gates_pass` | gates 6–7 would pass on challenged input |
| `identity_binding_blocks_admission` | gate 8 rejects challenged input |
| `failure_class_exact` | `identity_inconsistency` |
| `reason_code_exact` | `proof_object_id_invalid` |
| `non_throwing` | `tryCreateChronicleEntryV0` must not throw |

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate mutation scope, identity
derivation encoding, gate-order relation, and encoded admission results from
the frozen spec. They do not execute `tryCreateChronicleEntryV0`.

Production binding executes `tryCreateChronicleEntryV0` and
`verifyHandoffReceiptRoot` in TypeScript tests only.

## Non-goals

- proof_ref validity
- all Chronicle identity semantics
- capsule label / verifier_result inconsistency vectors
- cross-object proof_root / capsule root mismatch vectors
- evidence-root admission vectors
- timing, TEE, semantic neighbors, DCN, verifier-of-verifier
- legal admissibility or settlement correctness
