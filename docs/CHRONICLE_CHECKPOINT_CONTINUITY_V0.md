# Chronicle Checkpoint Continuity v0

This document defines the **pairwise continuity** profile for `chronicle_checkpoint.v0`.

Question in scope:

> After applying the required shape and local-verification prerequisites, does the current checkpoint validly continue the supplied predecessor candidate?

This profile is **read-only over the existing artifact contract**. It does not change:

- `chronicle_checkpoint.v0` artifact shape
- checkpoint root derivation
- existing `create*` behavior
- existing local `verify*` behavior

## Out of scope

This profile does **not** define:

- checkpoint observation-index semantics
- global sequence uniqueness
- duplicate detection
- equivocation detection
- conflicting-position detection
- checkpoint-chain registry rules

State boundary:

- `sequence` is **not globally unique**.
- Two checkpoints with the same `sequence` are **not automatically conflicting**.
- A conflicting-position claim requires an externally declared checkpoint-chain observation scope.
- That scope and its observation-index rules are deferred to a separate profile.
- Observation state must never collapse into a continuity-validity state.
- `predecessor_ref_mismatch` means the current checkpoint does not continue the supplied predecessor candidate; it does not claim that no matching predecessor exists elsewhere.

## Preconditions

This profile operates over `chronicle_checkpoint.v0` exactly as it exists today.

The local checkpoint verifier remains the existing one from Chronicle v0: root recomputation plus the requirement that stored `entry_refs` already be in canonical order. Cross-checkpoint continuity is a separate question and MUST NOT alter local verifier semantics.

Implementations MUST derive local checkpoint verification outcomes by applying the existing `verifyChronicleCheckpointV0` semantics to the supplied checkpoint objects. Fixture data MUST NOT be treated as a trusted declaration of local verification success or failure.

## Result shape

```ts
type ChronicleCheckpointContinuityResultV0 = {
  evaluation_state:
    | "evaluated"
    | "unverifiable"
    | "malformed"
    | "not_evaluated"
  verdict: "valid" | "invalid" | null
  relation: "genesis" | "successor" | null
  reason_code:
    | "genesis"
    | "direct_successor"
    | "current_shape_malformed"
    | "current_local_verifier_failed"
    | "predecessor_unknown"
    | "predecessor_shape_malformed"
    | "predecessor_local_verifier_failed"
    | "predecessor_ref_mismatch"
    | "sequence_gap"
    | "predecessor_same_sequence"
    | "predecessor_higher_sequence"
}
```

## Result invariants

- `verdict` MUST be `null` whenever `evaluation_state` is not `evaluated`.
- `malformed` is a shape state, not an invalid verdict.
- `unverifiable` means required evidence was unavailable, not disagreement.
- `not_evaluated` means a prerequisite check concretely failed before continuity could be evaluated.
- `valid` / `invalid` apply only when `evaluation_state = "evaluated"`.
- `relation` MUST be `"genesis"` only for the valid genesis case.
- `relation` MUST be `"successor"` only for the valid direct-successor case.
- `relation` MUST be `null` for all invalid, malformed, unverifiable, and not-evaluated results.

## Normative evaluation order

The evaluator MUST perform pairwise continuity classification in the following order:

1. validate current checkpoint shape;
2. verify current checkpoint locally;
3. classify genesis;
4. if non-genesis, resolve the predecessor candidate;
5. validate predecessor shape;
6. verify predecessor locally;
7. compare `current.prev_checkpoint` with `predecessor.checkpoint_root`;
8. classify the sequence relation.

Evaluation stops at the first applicable outcome. Later checks MUST NOT override an earlier `malformed`, `unverifiable`, or `not_evaluated` result.

The predecessor reference comparison MUST occur before sequence classification.

## Shape rules used by this profile

This profile adopts the existing checkpoint shape rules already enforced at create time:

- `sequence` MUST be an integer.
- `sequence` MUST be `>= 0`.
- `sequence = 0` requires `prev_checkpoint = null`.
- `sequence > 0` requires non-null `prev_checkpoint`.

A checkpoint that fails those rules is malformed for this profile.

## Exact outcomes

The following pairwise distinctions are normative and not merely fixture examples:

- If the supplied predecessor candidate is locally verified, `current.prev_checkpoint` equals `predecessor.checkpoint_root`, and `predecessor.sequence = current.sequence - 1`, the result is the valid direct-successor outcome.
- If the supplied predecessor candidate is locally verified and has `predecessor.sequence = current.sequence - 1`, but `current.prev_checkpoint != predecessor.checkpoint_root`, the result is `predecessor_ref_mismatch`, not a successor result and not a sequence-classification result.
- If the supplied predecessor candidate is locally verified, `current.prev_checkpoint` equals `predecessor.checkpoint_root`, and `predecessor.sequence = current.sequence`, the result is `predecessor_same_sequence`.


### Current shape malformed

Return:

- `evaluation_state: "malformed"`
- `verdict: null`
- `relation: null`
- `reason_code: "current_shape_malformed"`

### Current local verifier fails

Return:

- `evaluation_state: "not_evaluated"`
- `verdict: null`
- `relation: null`
- `reason_code: "current_local_verifier_failed"`

### Valid genesis

If current is locally verified and has:

- `sequence = 0`
- `prev_checkpoint = null`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "valid"`
- `relation: "genesis"`
- `reason_code: "genesis"`

Genesis is not a successor claim.

### Required predecessor unavailable

If current has `sequence > 0` and no predecessor candidate is resolved for evaluation, return:

- `evaluation_state: "unverifiable"`
- `verdict: null`
- `relation: null`
- `reason_code: "predecessor_unknown"`

### Predecessor shape malformed

Return:

- `evaluation_state: "malformed"`
- `verdict: null`
- `relation: null`
- `reason_code: "predecessor_shape_malformed"`

### Predecessor local verifier fails

Return:

- `evaluation_state: "not_evaluated"`
- `verdict: null`
- `relation: null`
- `reason_code: "predecessor_local_verifier_failed"`

### Predecessor checkpoint root does not equal current.prev_checkpoint

If predecessor is otherwise locally verified, but:

- `current.prev_checkpoint != predecessor.checkpoint_root`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "invalid"`
- `relation: null`
- `reason_code: "predecessor_ref_mismatch"`

### Valid direct successor

If predecessor is locally verified and:

- `current.prev_checkpoint = predecessor.checkpoint_root`
- `predecessor.sequence = current.sequence - 1`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "valid"`
- `relation: "successor"`
- `reason_code: "direct_successor"`

### Sequence gap

If predecessor is locally verified and:

- `current.prev_checkpoint = predecessor.checkpoint_root`
- `predecessor.sequence < current.sequence - 1`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "invalid"`
- `relation: null`
- `reason_code: "sequence_gap"`

### Predecessor at same sequence

If predecessor is locally verified and:

- `current.prev_checkpoint = predecessor.checkpoint_root`
- `predecessor.sequence = current.sequence`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "invalid"`
- `relation: null`
- `reason_code: "predecessor_same_sequence"`

### Predecessor at higher sequence

If predecessor is locally verified and:

- `current.prev_checkpoint = predecessor.checkpoint_root`
- `predecessor.sequence > current.sequence`

Return:

- `evaluation_state: "evaluated"`
- `verdict: "invalid"`
- `relation: null`
- `reason_code: "predecessor_higher_sequence"`

## Explicit non-rules in v0

This profile does not require:

- `current.entry_refs` to be a superset of `predecessor.entry_refs`
- `collection_ref` to remain stable
- `collection_ref` to resolve to exactly the checkpoint `entry_refs`
- global uniqueness of `sequence`
- completeness or omission-detectability claims

Those remain separately specified future rules.

## Conformance vectors

This profile is accompanied by:

- `tests/fixtures/chronicle-checkpoint-continuity-v0.json`

These vectors are normative for independent implementations of the pairwise continuity profile.

This fixture does not include duplicate-observation or same-sequence conflicting-root cases. Those require a separate, explicitly scoped observation-index profile and are out of scope here.

## Non-goals preserved

This profile does not change Chronicle v0 local verification scope. A checkpoint may still be locally root-valid while failing pairwise continuity, and pairwise continuity evaluation may still be blocked by malformed input, missing predecessor evidence, or failed local verification prerequisites.
