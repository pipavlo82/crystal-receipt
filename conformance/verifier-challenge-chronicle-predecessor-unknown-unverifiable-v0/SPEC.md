# Verifier Challenge predecessor_unknown_unverifiable v0 (Chronicle checkpoint continuity)

Frozen profile: `verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0`

This package freezes exactly one Chronicle checkpoint continuity challenge vector
demonstrating **predecessor unknown unverifiability**: for a locally valid
non-genesis current checkpoint, absence of the required predecessor candidate
MUST remain epistemically unverifiable and MUST NOT be collapsed into an
evaluated invalid continuity judgment.

It does **not** freeze predecessor-reference mismatch, sequence adjacency failure,
same-sequence or higher-sequence variants, malformed current or predecessor,
local verifier failures, genesis positive classification, global chain continuity,
predecessor discovery correctness, checkpoint registry semantics, append/ingest
semantics, stale/fresh checkpoint semantics, duplicate/replay protection,
Chronicle admission, receipt-root verification, RSF, counterfactual semantics,
legal admissibility, or settlement correctness.

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

For this vector, gates 1–3 pass and gate 4 stops evaluation (first-failure-wins
for the challenged relation):

1. current shape valid
2. current local verification succeeds
3. genesis classification — not genesis (`sequence > 0`)
4. **predecessor present** — challenged failure here (`predecessor_unknown`)
5. predecessor shape valid — not reached
6. predecessor local verification succeeds — not reached
7. current.prev_checkpoint vs predecessor.checkpoint_root — not reached
8. sequence relation classification — not reached

## Challenge semantics

### Governed input

Continuity pair derived from the pinned baseline authority vector `valid_successor`
in:

- `tests/fixtures/chronicle-checkpoint-continuity-v0.json`

### Baseline properties

1. Current checkpoint shape is valid and local verification succeeds.
2. Current checkpoint is non-genesis (`sequence > 0`).
3. Baseline predecessor candidate shape is valid and local verification succeeds.
4. Baseline continuity evaluation yields a direct successor relation.

### Predecessor removal rule

Apply exactly one substitution to the baseline evaluation pair:

- keep `current` byte-for-byte unchanged from baseline
- replace the supplied `predecessor` argument with `null`

Do not mutate `current.prev_checkpoint`, `current.checkpoint_root`,
`current.sequence`, `current.entry_refs`, or any checkpoint field.
Do not substitute an empty object or malformed predecessor in place of `null`.

This is an argument-availability challenge, not a checkpoint mutation challenge.

### Epistemic invariant

`evaluation_state: "unverifiable"` means required continuity evidence is
unavailable. It does **not** mean continuity was evaluated and found invalid.

The evaluator MUST NOT collapse predecessor absence into:

- `evaluation_state: "evaluated"`
- `verdict: "invalid"`

Missing evidence is not a negative continuity judgment.

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
  "evaluation_state": "unverifiable",
  "verdict": null,
  "relation": null,
  "reason_code": "predecessor_unknown"
}
```

Absence of the required predecessor candidate must yield the challenged tuple
without throwing.

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_evaluation_state` | `evaluated` |
| `baseline_verdict` | `valid` |
| `baseline_relation` | `successor` |
| `baseline_reason_code` | `direct_successor` |
| `challenged_evaluation_state` | `unverifiable` |
| `challenged_verdict` | `null` |
| `challenged_relation` | `null` |
| `challenged_reason_code` | `predecessor_unknown` |
| `current_checkpoint_unchanged` | current object identical between baseline and challenged |
| `current_checkpoint_locally_valid` | `verifyChronicleCheckpointV0` ok on current |
| `current_is_non_genesis` | `current.sequence > 0` |
| `predecessor_argument_removed_only` | only supplied predecessor argument differs |
| `missing_predecessor_blocks_evaluation` | predecessor availability gate is first stop |
| `missing_predecessor_does_not_imply_invalid` | no `evaluated`/`invalid` verdict emitted |
| `predecessor_ref_gate_not_reached` | ref comparison is downstream |
| `sequence_gate_not_reached` | sequence classification is downstream |
| `non_throwing` | evaluator must not throw |

## Orthogonality

This property is orthogonal to:

- **predecessor-reference mismatch** (challenge #1): wrong supplied predecessor
  → `evaluated` / `invalid` / `predecessor_ref_mismatch`
- **sequence adjacency failure** (challenge #2): correct predecessor reference
  but wrong sequence adjacency → `evaluated` / `invalid` / `sequence_gap`

This challenge (#3): required predecessor unavailable → `unverifiable` / null
verdict / `predecessor_unknown`

These are distinct semantic states.

## Independence scope

Python and TypeScript auditors recompute member and expected-result digests
without ReceiptOS production imports. They validate substitution scope, gate-order
relation, and encoded continuity results from the frozen spec. They do not
execute `evaluateChronicleCheckpointContinuityV0`.

Production binding executes `evaluateChronicleCheckpointContinuityV0` and
`verifyChronicleCheckpointV0` in TypeScript tests only.

## Non-goals

- predecessor-reference mismatch
- sequence adjacency failure
- predecessor_same_sequence
- predecessor_higher_sequence
- malformed current
- malformed predecessor
- current_local_verifier_failed
- predecessor_local_verifier_failed
- genesis positive classification
- global chain continuity
- predecessor discovery correctness
- checkpoint registry semantics
- append/ingest semantics
- stale/fresh checkpoint semantics
- duplicate/replay protection
- Chronicle admission
- receipt-root verification
- RSF
- counterfactual semantics
- legal admissibility
- settlement correctness
