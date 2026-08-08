# Verifier Challenge sequence_gap_rejected v0 (Chronicle checkpoint continuity)

Frozen profile: `verifier-challenge-chronicle-sequence-gap-rejected-v0`

This package freezes exactly one Chronicle checkpoint continuity challenge vector
demonstrating **sequence adjacency rejection**: after predecessor-reference binding
succeeds, direct successor continuity additionally requires
`predecessor.sequence === current.sequence - 1`.

It does **not** freeze predecessor-reference mismatch, predecessor unknown,
same-sequence or higher-sequence variants, all sequence reason codes individually,
global chain ordering, full-history validation, predecessor discovery, append/ingest
semantics, stale-head semantics, checkpoint freshness, duplicate/replay protection,
equivocation, Chronicle admission, receipt-root verification, RSF, counterfactual
semantics, legal admissibility, or settlement correctness.

## Subject continuity evaluator

- Entrypoint: `evaluateChronicleCheckpointContinuityV0`
- Module: `src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts`

Local checkpoint verification prerequisite:

- Entrypoint: `verifyChronicleCheckpointV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`

The subject surface is pairwise Chronicle checkpoint continuity evaluation. This
challenge is distinct from predecessor-reference binding (challenge #1).

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`.

## Continuity gate order

For this vector, gates 1–7 pass and gate 8 classifies the challenged failure:

1. current shape valid
2. current local verification succeeds
3. genesis classification — not genesis (`sequence > 0`)
4. predecessor present — supplied
5. predecessor shape valid
6. predecessor local verification succeeds
7. **current.prev_checkpoint vs predecessor.checkpoint_root** — passes on challenged pair
8. **sequence relation classification** — challenged `sequence_gap` here

## Challenge semantics

### Governed input

Continuity pair derived from the pinned baseline authority vector `valid_successor`
in:

- `tests/fixtures/chronicle-checkpoint-continuity-v0.json`

Challenged current taken from the tracked `sequence_gap` fixture vector.

### Baseline properties

1. Baseline current and predecessor shape are valid and local verification succeeds.
2. `current.prev_checkpoint == predecessor.checkpoint_root`.
3. `predecessor.sequence == current.sequence - 1`.
4. Baseline continuity evaluation yields a direct successor relation.

### Current substitution rule

Apply exactly one substitution to the baseline evaluation pair:

- keep `predecessor` byte-for-byte unchanged from baseline (`checkpoint-1`)
- replace the supplied `current` argument with the tracked locally-valid current
  checkpoint from the `sequence_gap` fixture vector (`checkpoint-4`, sequence 4)

Do not manually mutate checkpoint fields. Do not alter the predecessor object.

### Reference binding vs sequence adjacency

Reference binding alone does not establish direct-successor continuity. The
challenged pair satisfies `current.prev_checkpoint == predecessor.checkpoint_root`
while `predecessor.sequence < current.sequence - 1`, yielding sequence gap
invalidity.

This is orthogonal to challenge #1, which changes only the predecessor argument
while sequence adjacency remains valid.

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
  "reason_code": "sequence_gap"
}
```

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
| `challenged_reason_code` | `sequence_gap` |
| `baseline_current_locally_valid` | baseline current passes local verify |
| `challenged_current_locally_valid` | challenged current passes local verify |
| `predecessor_locally_valid` | predecessor passes local verify |
| `predecessor_unchanged` | predecessor object identical between pairs |
| `current_argument_changed_only` | only supplied current differs |
| `challenged_predecessor_ref_matches` | challenged ref binding succeeds |
| `sequence_adjacency_fails` | `predecessor.sequence < current.sequence - 1` |
| `sequence_gap_blocks_continuity` | sequence gate yields invalid continuity |
| `predecessor_ref_gate_passes` | ref comparison succeeds before sequence gate |
| `sequence_gate_is_first_classifying_failure` | sequence classification is first challenged failure |
| `non_throwing` | evaluator must not throw |

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate substitution scope, gate-order
relation, and encoded continuity results from the frozen spec. They do not
execute `evaluateChronicleCheckpointContinuityV0`.

Production binding executes `evaluateChronicleCheckpointContinuityV0` and
`verifyChronicleCheckpointV0` in TypeScript tests only.

## Non-goals

- predecessor_ref_mismatch
- predecessor_unknown
- predecessor_same_sequence
- predecessor_higher_sequence
- all sequence reason codes frozen individually
- global chain ordering
- full-history validation
- predecessor discovery
- append/ingest semantics
- stale-head semantics
- checkpoint freshness
- duplicate/replay protection
- equivocation
- Chronicle admission
- receipt-root verification
- RSF
- counterfactual semantics
- legal admissibility
- settlement correctness
