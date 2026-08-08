# Verifier Challenge Chronicle Continuity Set v0 — Aggregate Index

Frozen profile: `verifier-challenge-chronicle-continuity-set-v0`

This package defines the frozen three-challenge Chronicle checkpoint continuity
set: an **aggregate index and boundary** over three already-frozen ReceiptOS
Chronicle checkpoint continuity challenge packages for the pinned
`evaluateChronicleCheckpointContinuityV0` pairwise continuity profile.

It does **not** freeze new continuity challenge semantics, a fourth challenge,
aggregate vectors, aggregate expected-result semantics, every continuity reason
code, malformed or not_evaluated state closure, global Chronicle chain continuity,
full history validation, predecessor discovery, append/ingest correctness,
stale-head semantics, freshness semantics, duplicate/replay detection,
equivocation detection, Chronicle admission, receipt-root verification, RSF,
counterfactual semantics, legal admissibility, or settlement correctness.

## Purpose

Provide a deterministic index over frozen child packages in **production gate
order** (gates 4 → 7 → 8):

1. `predecessor_unknown_unverifiable` — predecessor availability /
   epistemic unverifiability (gate 4)
2. `predecessor_ref_mismatch_rejected` — predecessor-reference binding (gate 7)
3. `sequence_gap_rejected` — sequence adjacency (gate 8)

Child packages remain authoritative for vector semantics, substitutions, field
classification, and encoded continuity results. This aggregate package references
child package digests only and does not copy or reinterpret child vectors.

## Subject continuity evaluator

- Entrypoint: `evaluateChronicleCheckpointContinuityV0`
- Module: `src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts`
- Pinned by Git index/object-store blob OID in the contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Ordered child inventory

| Ordinal | challenge_id | trust_boundary | gate | package_path |
| --- | --- | --- | --- | --- |
| 1 | `predecessor_unknown_unverifiable` | predecessor-availability / epistemic-unverifiability | 4 | `conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0` |
| 2 | `predecessor_ref_mismatch_rejected` | predecessor-reference-binding | 7 | `conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0` |
| 3 | `sequence_gap_rejected` | sequence-adjacency | 8 | `conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0` |

Each child entry carries:

- `vector_count = 1`
- `execution_class = production-continuity-binding`
- frozen `fixture_set_sha256`
- frozen `expected_result_set_sha256`

## Frozen coverage statement

These three child packages cover the distinct pairwise continuity judgment
boundaries presently frozen for the pinned
`evaluateChronicleCheckpointContinuityV0` profile:

1. **Predecessor availability / epistemic unverifiability** — absence of a
   required predecessor candidate for a non-genesis current checkpoint remains
   unverifiable and must not collapse into evaluated invalid continuity.
2. **Predecessor-reference binding** — a supplied locally valid predecessor
   candidate must match `current.prev_checkpoint`.
3. **Sequence adjacency** — after reference binding succeeds, direct successor
   continuity requires `predecessor.sequence === current.sequence - 1`.

This is **not** a claim that every continuity reason code has its own frozen
vector, that all pairwise continuity behavior is covered, or that ReceiptOS
Chronicle checkpoint continuity conformance is complete across all surfaces.

## Minimal-set basis

A read-only minimality audit established `THREE_CHALLENGE_CONTINUITY_MINIMAL_SET_REACHED`
for the current production surface. Removing any child leaves one distinct
boundary unfrozen:

- Without gate 4 child: no frozen `unverifiable` epistemic partition
- Without gate 7 child: no frozen evaluated-negative reference binding
- Without gate 8 child: no frozen evaluated-negative sequence adjacency

Remaining continuity results classify as:

- `sequence_gap`, `predecessor_same_sequence`, and `predecessor_higher_sequence`
  as instances of one sequence-adjacency rule (`sequence_gap` is representative)
- shape malformed paths as input-shape preconditions
- local verifier failures as local-validity prerequisites
- `genesis` and `direct_successor` as positive classifications

This aggregate introduces **no new vectors**, **no new mutation semantics**,
**no new reason codes**, and **no new failure classes**.

## Orthogonality

The three frozen children form a semantic partition on evaluation state:

| Child | Mechanism | Result class |
| --- | --- | --- |
| #1 | required predecessor absent | `unverifiable` / null verdict |
| #2 | wrong supplied predecessor identity | `evaluated` / `invalid` |
| #3 | correct ref, wrong sequence adjacency | `evaluated` / `invalid` |

## Child identity rule

Child packages are referenced by their frozen package digests
(`fixture_set_sha256`, `expected_result_set_sha256`), repository paths, and
declared trust-boundary labels. Independent auditors verify that each referenced
child package exists and that its live manifest/contract digests match the
declared values.

## Aggregate digest rule

`child_identity_set_sha256` is computed from the ordered child identity records
in `contract.json`:

1. For each child in ordinal order, build a record containing only:
   `ordinal`, `challenge_id`, `package_path`, `vector_count`,
   `execution_class`, `fixture_set_sha256`, `expected_result_set_sha256`.
2. Encode the array as canonical JSON (`sort_keys=true`, compact separators).
3. UTF-8 encode the JSON string.
4. SHA-256 the bytes (lowercase hex).

The `trust_boundary` label is frozen in the contract for human and audit
readability but is excluded from the child identity digest recipe above, matching
`verifier-challenge-chronicle-admission-set-v0` discipline.

## Aggregate package fixture digest

`fixture_set_sha256` for this aggregate package follows the repository
verifier-challenge package discipline:

- Sorted frozen member paths except `manifest.json`
- Each line: `<path>\t<file-sha256>\n`
- Concatenate UTF-8 lines, then SHA-256 (lowercase hex)

Frozen members: `SPEC.md`, `contract.json`.

There is **no aggregate `expected_result_set_sha256`**. The aggregate defines no
new expected-result semantics.

## Execution inventory

- child packages: 3
- child vectors total: 3
- execution classes: `production-continuity-binding` × 3
- aggregate vectors: 0 (no `vectors/` directory)

## Claim boundary

After merge of this aggregate package, the following repository-level claim
becomes valid:

> ReceiptOS has a frozen three-challenge Chronicle checkpoint continuity set for
> the pinned `evaluateChronicleCheckpointContinuityV0` profile, covering
> predecessor availability/unverifiability, predecessor-reference binding, and
> sequence adjacency.

Always qualify as **pairwise continuity only**.

Prior to merge, the defensible claim remains at the child level: ReceiptOS has
three frozen Chronicle checkpoint continuity challenges forming a minimal
orthogonal set for the pinned profile.

## Semantic authority

Child package SPECs, contracts, and vectors remain authoritative for challenge
semantics. This aggregate SPEC is authoritative only for set identity, child
ordering, child digest references, trust-boundary mapping, subject continuity
evaluator pin, aggregate digest recipe, and claim boundary.

## Independence scope

Python and TypeScript auditors recompute aggregate package and child-reference
digests without ReceiptOS production imports. They do not execute
`evaluateChronicleCheckpointContinuityV0` and do not re-derive child vector
semantics.

## Non-goals

- fourth continuity challenge
- aggregate vectors
- aggregate expected-result digest
- global Chronicle chain continuity
- full history validation
- predecessor discovery correctness
- append/ingest correctness
- stale-head semantics
- freshness semantics
- duplicate/replay detection
- equivocation detection
- malformed-state closure
- not_evaluated-state closure
- all reason codes individually frozen
- Chronicle admission
- receipt-root verification
- RSF semantics
- counterfactual semantics
- legal admissibility
- settlement correctness
