# Verifier Challenge predecessor_ref_mismatch_rejected v0 (Chronicle checkpoint continuity)

Frozen profile: `verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0`

This package freezes exactly one Chronicle checkpoint continuity challenge vector
demonstrating **predecessor reference mismatch rejection**: a supplied predecessor
candidate must match the current checkpoint's reported predecessor link during
pairwise continuity evaluation.

It does **not** freeze global Chronicle chain validity, full-history ordering,
append/ingest behavior, predecessor lookup/registry semantics, stale-head semantics,
checkpoint freshness, observation index, duplicate/replay detection, equivocation,
missing-predecessor challenges, sequence-gap challenges, same-sequence challenges,
higher-sequence challenges, Chronicle admission, receipt-root verifier semantics,
RSF, counterfactual semantics, legal admissibility, or settlement correctness.

## Subject continuity evaluator

- Entrypoint: `evaluateChronicleCheckpointContinuityV0`
- Module: `src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts`

Local checkpoint verification prerequisite:

- Entrypoint: `verifyChronicleCheckpointV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`

The subject surface is pairwise Chronicle checkpoint continuity evaluation, not
Chronicle admission and not global chain verification.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`.

## Continuity gate order

For this vector, gates 1–6 pass and gate 7 rejects (first-failure-wins for the
challenged relation):

1. current shape valid
2. current local verification succeeds
3. genesis classification — not genesis (`sequence > 0`)
4. predecessor present — supplied
5. predecessor shape valid
6. predecessor local verification succeeds
7. **current.prev_checkpoint vs predecessor.checkpoint_root** — challenged failure here
8. sequence relation classification — not reached as first failure

## Challenge semantics

### Governed input

Continuity pair derived from the pinned baseline authority vector `valid_successor`
in:

- `tests/fixtures/chronicle-checkpoint-continuity-v0.json`

### Baseline properties

1. Current checkpoint shape is valid and local verification succeeds.
2. Baseline predecessor candidate shape is valid and local verification succeeds.
3. Baseline continuity evaluation yields a direct successor relation.

### Predecessor substitution rule

Apply exactly one substitution to the baseline evaluation pair:

- keep `current` byte-for-byte unchanged from baseline
- replace the supplied `predecessor` argument with the wrong-but-locally-valid
  predecessor checkpoint `checkpoint-1-other` from the tracked
  `predecessor_ref_mismatch` precedent vector in the same fixture

Do not mutate `current.prev_checkpoint`, `current.checkpoint_root`, `current.sequence`,
`current.entry_refs`, or any predecessor checkpoint root fields.

### Individual validity vs continuity

Both baseline and challenged predecessor candidates are locally valid checkpoints.
Individual checkpoint validity does not establish pairwise continuity validity.

### Exact baseline result

```json
{
  "evaluation_state": "evaluated",
  "verdict": "valid",
  "relation": "successor",
  "reason_code": "direct_successor"
}
```

### Exact challenged result

```json
{
  "evaluation_state": "evaluated",
  "verdict": "invalid",
  "relation": null,
  "reason_code": "predecessor_ref_mismatch"
}
```

A locally valid but wrong predecessor candidate must yield the challenged tuple
without throwing.

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_evaluation_state` | `evaluated` |
| `baseline_verdict` | `valid` |
| `baseline_relation` | `successor` |
| `baseline_reason_code` | `direct_successor` |
| `challenged_evaluation_state` | `evaluated` |
| `challenged_verdict` | `invalid` |
| `challenged_relation` | `null` |
| `challenged_reason_code` | `predecessor_ref_mismatch` |
| `current_checkpoint_unchanged` | current object identical between baseline and challenged |
| `baseline_predecessor_locally_valid` | `verifyChronicleCheckpointV0` ok on baseline predecessor |
| `challenged_predecessor_locally_valid` | `verifyChronicleCheckpointV0` ok on challenged predecessor |
| `current_checkpoint_locally_valid` | `verifyChronicleCheckpointV0` ok on current |
| `predecessor_argument_changed_only` | only supplied predecessor differs |
| `predecessor_ref_mismatch_blocks_continuity` | ref mismatch is first failing continuity relation |
| `sequence_gate_not_first_failure` | sequence classification is downstream for this challenge |
| `non_throwing` | evaluator must not throw |

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate substitution scope, gate-order
relation, and encoded continuity results from the frozen spec. They do not
execute `evaluateChronicleCheckpointContinuityV0`.

Production binding executes `evaluateChronicleCheckpointContinuityV0` and
`verifyChronicleCheckpointV0` in TypeScript tests only.

## Non-goals

- global Chronicle chain validity
- full-history ordering
- append/ingest behavior
- predecessor lookup/registry semantics
- stale-head semantics
- checkpoint freshness
- observation index semantics
- duplicate/replay detection
- equivocation
- missing predecessor challenge
- sequence-gap challenge
- same-sequence challenge
- higher-sequence challenge
- Chronicle admission
- receipt-root verifier semantics
- RSF
- counterfactual semantics
- legal admissibility
- settlement correctness
