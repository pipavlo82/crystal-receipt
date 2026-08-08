# Verifier Challenge capsule_label_inconsistent_rejected v0 (Chronicle admission)

Frozen profile: `verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0`

This package freezes exactly one Chronicle admission challenge vector
demonstrating **reported-state label rejection**: reported capsule
receipt-root state must not contradict independently verified receipt state
during Chronicle admission.

It does **not** freeze verifier_result_inconsistent, proof_ref validity,
proof_object_id validity as challenged semantics, capsule stored/computed
mismatch, proof root mismatch, evidence root mismatch, missing evidence root,
all reported-state semantics, full Chronicle admission closure, timing, TEE,
semantic neighbors, DCN, verifier-of-verifier, legal admissibility, or
settlement correctness.

## Subject admission verifier

- Entrypoint: `tryCreateChronicleEntryV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`

The subject surface is Chronicle admission, not receipt-root verification.
`createChronicleEntryV0` is a throwing compatibility wrapper and is not the
frozen subject entrypoint.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`.

## Distinction from prior frozen challenges

| Challenge | Trust boundary | Failure |
| --- | --- | --- |
| proof_root_mismatch_rejected | cross-object consistency | `cross_object_inconsistency` / `proof_root_mismatch` |
| proof_object_id_invalid_rejected | identity consistency | `identity_inconsistency` / `proof_object_id_invalid` |
| **this challenge** | **reported-state consistency** | **`reported_state_inconsistency` / `capsule_label_inconsistent`** |

This challenge is distinct from the receipt-root `observed_not_validated`
challenge, which governs `verifyHandoffReceiptRoot` on `anchor.verifier_status`,
not Chronicle admission capsule labels.

## Admission gate order

For this vector, gates 1–5 pass and gate 6 rejects (first-failure-wins):

1. evidence root present
2. evidence root recompute match
3. proof_object.receipt_root cross-object match
4. capsule stored root match
5. capsule computed root match
6. **capsule match/status consistency** — challenged failure here
7. verifier_result consistency — not reached as first failure
8. proof_object_id identity — not reached as first failure
9. proof_ref identity — not reached as first failure

## Challenge semantics

### Governed input

Admission inputs derived from the pinned baseline authority:

- `tests/fixtures/receiptos-chronicle-admission-v0/vectors/01-clean-admitted.json`

### Baseline properties

1. HandoffEvidence receipt-root verification succeeds.
2. Cross-object root consistency succeeds (`proof_object.receipt_root`,
   capsule stored/computed roots agree with verified/recomputed roots).
3. Baseline capsule `receipt_root.match == true` and `status == "verified"`.
4. Baseline capsule `verifier_result.ok == true` and `status == "verified"`.
5. Canonical `proof_object_id` and `proof_ref` remain valid on both baseline
   and challenged inputs (identity gates are not reached).

### Reported-state binding

`receipt_root.match` is reported state, not independent evidence. After
independent evidence-root verification and cross-object root checks succeed,
admission rejects when the capsule reports `match: false` while stored and
computed roots remain correct.

### Mutation rule

Apply exactly one mutation to a deep clone of baseline admission inputs:

- path: `proof_object.evidence_capsule.receipt_root.match`
- from: `true`
- to: `false`

Do not mutate `status`, `stored`, `computed`, `verifier_result`, identity
fields, HandoffEvidence, or Chronicle options.

### Exact challenged failure

```json
{
  "success": false,
  "failure": {
    "failure_class": "reported_state_inconsistency",
    "reason_code": "capsule_label_inconsistent"
  }
}
```

A reported `match: false` cannot coexist with the otherwise verified receipt
state for admission. Evidence and root-bearing fields remain unchanged.

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
| `proof_object_receipt_root_unchanged` | top-level proof root identical |
| `capsule_stored_root_unchanged` | capsule stored root identical |
| `capsule_computed_root_unchanged` | capsule computed root identical |
| `capsule_match_changed_only` | only `match` differs |
| `capsule_status_unchanged` | `status` remains `"verified"` |
| `verifier_result_unchanged` | verifier_result object identical |
| `proof_object_id_unchanged` | canonical identity preserved |
| `proof_ref_unchanged` | canonical ref preserved |
| `cross_object_gates_pass` | gates 3–5 would pass on challenged input |
| `reported_state_blocks_admission` | gate 6 rejects challenged input |
| `failure_class_exact` | `reported_state_inconsistency` |
| `reason_code_exact` | `capsule_label_inconsistent` |
| `non_throwing` | `tryCreateChronicleEntryV0` must not throw |

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate mutation scope, gate-order
relation, and encoded admission results from the frozen spec. They do not
execute `tryCreateChronicleEntryV0`.

Production binding executes `tryCreateChronicleEntryV0` and
`verifyHandoffReceiptRoot` in TypeScript tests only.

## Non-goals

- verifier_result_inconsistent
- proof_ref / proof_object_id validity as challenged semantics
- capsule stored/computed mismatch vectors
- cross-object proof_root mismatch vectors
- evidence-root admission vectors
- full Chronicle admission closure
