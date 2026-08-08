# Verifier Challenge checkpoint_entry_refs_noncanonical_rejected v0 (Chronicle checkpoint local verification)

Frozen profile: `verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0`

This package freezes exactly one Chronicle checkpoint **local verification**
challenge vector demonstrating that a `chronicle_checkpoint.v0` with
**non-canonical stored `entry_refs` order** fails `verifyChronicleCheckpointV0`
even when the stored `checkpoint_root` field remains unchanged from a valid
canonically ordered baseline.

It does **not** freeze generic checkpoint-root tampering, collection or
portfolio root verification, Chronicle entry admission, pairwise checkpoint
continuity, a fourth continuity challenge, sequence semantics, predecessor
discovery, global checkpoint chain continuity, canonical head selection,
stale-head semantics, duplicate/replay detection, equivocation detection,
append/ingest semantics, legal admissibility, or settlement correctness.

## Subject local checkpoint verifier

- Entrypoint: `verifyChronicleCheckpointV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Pinned by Git blob OID in the vector and contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Normative profile

- Document: `docs/CHRONICLE.md` (Verification scope)
- Checkpoint verification additionally requires stored `entry_refs` to already
  be in canonical order.

## Local verification versus pairwise continuity

`verifyChronicleCheckpointV0` is checkpoint-local artifact verification.
Pairwise continuity (`evaluateChronicleCheckpointContinuityV0`) consumes local
verification as an upstream prerequisite. This challenge freezes the local
verification boundary itself; it does not add a continuity trust boundary.

## Canonical entry_refs ordering

For `chronicle_checkpoint.v0`, stored `entry_refs` MUST satisfy the canonical
ordering enforced by production `sortEntryRefs`: codepoint ascending sort.

## Baseline authority

Baseline checkpoint derived from the tracked unit-test pattern in
`tests/receiptos/chronicle-checkpoint-v0.test.ts`:

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
stored `entry_refs` order:

- baseline: `["entry-alpha", "entry-beta", "entry-gamma"]`
- challenged: `["entry-gamma", "entry-alpha", "entry-beta"]`

Requirements:

- same entry ref values and multiset
- `checkpoint_root` field byte-for-byte unchanged
- all other checkpoint fields unchanged
- do not recompute or replace `checkpoint_root` on the challenged object

## Live verification mechanism

On the pinned implementation, `verifyChronicleCheckpointV0` returns `ok: true`
only when **both** hold:

1. **Explicit canonical stored-order check** — stored `entry_refs` equals
   `sortEntryRefs(checkpoint.entry_refs)` element-wise.
2. **Stored-order root equality** — stored `checkpoint_root` equals
   `computeChronicleCheckpointRootFromStoredOrder(...)`, which recomputes the
   root from the stored `entry_refs` byte order without sorting.

For the challenged checkpoint, both conditions fail: stored order is
non-canonical, and stored-order recomputation yields a root different from the
unchanged stored `checkpoint_root`.

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
  "checkpoint_root": "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87",
  "recomputed_checkpoint_root": "sha256:96cb15f8241b1e89bef34c088560d55cb75e600b53adaf6a35215225621db866"
}
```

## Frozen members

Exactly three package members participate in the fixture inventory:

1. `SPEC.md`
2. `contract.json`
3. `vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json`

`manifest.json` is self-excluded from the fixture inventory.

## Independence scope

Python and TypeScript independent auditors recompute package fixture and
expected-result digests without production imports. They validate substitution
scope, canonical-order relations, and encoded verification results from the
frozen spec. They do **not** execute `verifyChronicleCheckpointV0`.

Production binding executes `verifyChronicleCheckpointV0` and
`createChronicleCheckpointV0` in TypeScript tests only.

## Claim boundary

Pairwise continuity only is **not** claimed here. This package claims only that
changing stored `entry_refs` from canonical to non-canonical order causes local
checkpoint verification rejection while the stored `checkpoint_root` field
remains unchanged.
