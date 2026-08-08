# Verifier Challenge checkpoint_root_mismatch_rejected v0 (Chronicle checkpoint local verification)

Frozen profile: `verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0`

This package freezes exactly one Chronicle checkpoint **local verification**
challenge vector demonstrating that a `chronicle_checkpoint.v0` with a mutated
stored `checkpoint_root` fails `verifyChronicleCheckpointV0` while all semantic
checkpoint content — including canonically ordered `entry_refs` — remains
unchanged.

It does **not** freeze non-canonical stored `entry_refs` order (covered by the
sibling challenge), field-specific root-input mutations as separate challenges,
missing/null root as a separate challenge, duplicate `entry_refs` prohibition,
shape validation, collection or portfolio root verification, Chronicle entry
admission, pairwise checkpoint continuity, global checkpoint chain continuity,
predecessor discovery, canonical head selection, duplicate/replay detection,
equivocation detection, legal admissibility, or settlement correctness.

## Subject local checkpoint verifier

- Entrypoint: `verifyChronicleCheckpointV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Pinned by Git blob OID in the vector and contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Normative profile

- Document: `docs/CHRONICLE.md` (Verification scope)
- Checkpoint verification requires stored `checkpoint_root` to equal
  recomputation from stored checkpoint content.

## Local verification versus pairwise continuity

`verifyChronicleCheckpointV0` is checkpoint-local artifact verification.
Pairwise continuity (`evaluateChronicleCheckpointContinuityV0`) consumes local
verification as an upstream prerequisite. This challenge freezes the stored-root
integrity conjunct of local verification; it does not add a continuity trust
boundary.

## Two-term ok semantics

On the pinned implementation, `verifyChronicleCheckpointV0` returns `ok: true`
only when **both** hold:

1. **Explicit canonical stored-order check** — stored `entry_refs` equals
   `sortEntryRefs(checkpoint.entry_refs)` element-wise.
2. **Stored-root integrity** — stored `checkpoint_root` equals
   `computeChronicleCheckpointRootFromStoredOrder(...)`.

This challenge freezes the second conjunct while the first still passes.

## Baseline authority

Baseline checkpoint derived from the same canonical three-ref pattern frozen by
challenge #1 (`checkpoint_entry_refs_noncanonical_rejected`):

- `createChronicleCheckpointV0` with three distinct entry refs in canonical
  sorted order
- `checkpointId`: `checkpoint-demo`
- `collectionRef`: `/collection/demo`
- `entryRefs`: `["entry-alpha", "entry-beta", "entry-gamma"]`
- `prevCheckpoint`: `sha256:abcdef`
- `sequence`: `2`

Baseline locally verifies with `ok: true`.

## Challenge substitution

Create the challenged checkpoint by deep-cloning the baseline and changing **only**
stored `checkpoint_root`:

- baseline root (R):
  `sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87`
- challenged stored root (R_BAD):
  `sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`

Requirements:

- all semantic fields byte-for-byte unchanged
- `entry_refs` remain canonical and identical to baseline
- do not mutate any field other than `checkpoint_root`

## Exact frozen results

Baseline:

```json
{
  "ok": true,
  "checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87",
  "recomputed_checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87"
}
```

Challenged:

```json
{
  "ok": false,
  "checkpoint_root": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "recomputed_checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87"
}
```

## Orthogonality vs canonical-order challenge

Challenge #1 (`checkpoint_entry_refs_noncanonical_rejected`) permutes stored
`entry_refs` while leaving `checkpoint_root` unchanged; both conjuncts fail on
that frozen vector.

The independent alternate control (not a second frozen vector) shows the
canonical-order conjunct can fail while stored-root equality holds: non-canonical
stored order with `checkpoint_root` adjusted to match stored-order recomputation
still yields `ok: false`.

This challenge isolates the converse: canonical order passes, stored-root
integrity fails.

## Frozen members

Exactly three package members participate in the fixture inventory:

1. `SPEC.md`
2. `contract.json`
3. `vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json`

`manifest.json` is self-excluded from the fixture inventory.

## Independence scope

Python and TypeScript independent auditors recompute package fixture and
expected-result digests without production imports. They validate substitution
scope, canonical-order controls, root-integrity relations, and encoded verification
results from the frozen spec. They do **not** execute `verifyChronicleCheckpointV0`.

Production binding executes `verifyChronicleCheckpointV0` and
`createChronicleCheckpointV0` in TypeScript tests only.

## Claim boundary

This package claims only that mutating only the stored `checkpoint_root` while
canonical checkpoint content remains unchanged causes local checkpoint
verification rejection via stored-root integrity binding.

Checkpoint-local lane production closure is **not** claimed here.
