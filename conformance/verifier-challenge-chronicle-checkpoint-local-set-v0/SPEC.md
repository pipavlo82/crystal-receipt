# Verifier Challenge Chronicle Checkpoint Local Set v0 — Aggregate Index

Frozen profile: `verifier-challenge-chronicle-checkpoint-local-set-v0`

This package defines the frozen two-challenge Chronicle checkpoint **local verification**
set: an **aggregate index and boundary** over two already-frozen ReceiptOS Chronicle
checkpoint-local challenge packages for the pinned `verifyChronicleCheckpointV0`
profile.

It does **not** freeze new checkpoint-local challenge semantics, a third challenge,
aggregate vectors, aggregate expected-result semantics, shape validation,
duplicate entry_ref prohibition, field-specific root-mismatch challenges,
collection or portfolio verification, pairwise checkpoint continuity, global
Chronicle chain continuity, predecessor discovery, canonical head selection,
stale-head semantics, duplicate/replay detection, equivocation detection,
Chronicle admission, receipt-root verification, RSF, counterfactual semantics,
legal admissibility, or settlement correctness.

## Purpose

Provide a deterministic index over frozen child packages in **live conjunction
expression order**:

1. `checkpoint_root_mismatch_rejected` — stored checkpoint_root integrity
   (`rootMatches`)
2. `checkpoint_entry_refs_noncanonical_rejected` — canonical stored entry_ref
   ordering (`entryRefsAreCanonical`)

This ordering follows the live boolean expression:

```text
ok = rootMatches && entryRefsAreCanonical
```

It is an aggregate indexing convention only. It is **not** first-failure order,
gate precedence, or runtime failure taxonomy — `verifyChronicleCheckpointV0`
returns only one boolean `ok`.

Child packages remain authoritative for vector semantics, substitutions, field
classification, and encoded local verification results. This aggregate package
references child package digests only and does not copy or reinterpret child vectors.

## Subject local checkpoint verifier

- Entrypoint: `verifyChronicleCheckpointV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Normative doc: `docs/CHRONICLE.md`
- Pinned by Git index/object-store blob OID in the contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Live success semantics

On the pinned implementation, local checkpoint verification succeeds only when
**both** independent predicates hold:

1. **Stored-root integrity** — stored `checkpoint_root` equals
   `computeChronicleCheckpointRootFromStoredOrder(...)`.
2. **Canonical stored entry_ref ordering** — stored `entry_refs` equals
   `sortEntryRefs(checkpoint.entry_refs)` element-wise.

Mechanical independence was demonstrated:

- `rootMatches=true`, `entryRefsAreCanonical=false` → `ok=false`
- `rootMatches=false`, `entryRefsAreCanonical=true` → `ok=false`
- both true → `ok=true`

No third independent checkpoint-local predicate exists in the pinned verifier.
Duplicate entry_refs are currently allowed when canonical and root-consistent.
`sequence` / `prev_checkpoint` shape semantics are outside
`verifyChronicleCheckpointV0`. Field-specific content mutations are instances of
the existing root-integrity property and are not distinct children.

## Ordered child inventory

| Ordinal | challenge_id | trust_boundary | package_path |
| --- | --- | --- | --- |
| 1 | `checkpoint_root_mismatch_rejected` | stored-root-integrity | `conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0` |
| 2 | `checkpoint_entry_refs_noncanonical_rejected` | canonical-entry-ref-order | `conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0` |

Each child entry carries:

- `vector_count = 1`
- `execution_class = production-checkpoint-local-binding`
- frozen `fixture_set_sha256`
- frozen `expected_result_set_sha256`

## Frozen coverage statement

These two child packages cover the distinct checkpoint-local verification
boundaries presently frozen for the pinned `verifyChronicleCheckpointV0` profile:

1. **Stored-root integrity** — mutating only the stored `checkpoint_root` while
   canonical checkpoint content remains unchanged causes rejection via root mismatch.
2. **Canonical stored entry_ref ordering** — non-canonical stored `entry_refs`
   order causes rejection even when stored root is adjusted to match stored-order
   recomputation.

This is **not** a claim of checkpoint-local lane production closure, full
checkpoint validity, shape validation, or global continuity.

## Child identity rule

Child packages are referenced by their frozen package digests
(`fixture_set_sha256`, `expected_result_set_sha256`) and repository paths.
Independent auditors verify that each referenced child package exists and that its
live manifest/contract digests match the declared values.

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
`verifier-challenge-chronicle-continuity-set-v0` discipline.

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

- child packages: 2
- child vectors total: 2
- execution classes: `production-checkpoint-local-binding` × 2
- aggregate vectors: 0 (no `vectors/` directory)

## Claim boundary

Prior to merge, the defensible claim is:

> ReceiptOS has a freeze-ready aggregate for the complete two-property Chronicle
> checkpoint-local verifier surface of the pinned `verifyChronicleCheckpointV0`
> profile: stored checkpoint_root integrity and canonical stored entry_ref ordering
> are independently frozen.

Do **not** use "production-closes" until this aggregate is merged and a final
closure audit passes.

## Semantic authority

Child package SPECs, contracts, and vectors remain authoritative for challenge
semantics. This aggregate SPEC is authoritative only for set identity, child
ordering, child digest references, trust-boundary mapping, subject local verifier
pin, aggregate digest recipe, and claim boundary.

## Independence scope

Python and TypeScript auditors recompute aggregate package and child-reference
digests without ReceiptOS production imports. They do not execute
`verifyChronicleCheckpointV0` and do not re-derive child vector semantics.

## Non-goals

- third checkpoint-local challenge
- aggregate vectors
- aggregate expected-result digest
- shape validation
- duplicate entry_ref prohibition
- field-specific root-mismatch challenges
- collection verification
- portfolio verification
- pairwise checkpoint continuity
- global chain continuity
- predecessor discovery
- canonical head selection
- stale-head semantics
- duplicate/replay detection
- equivocation detection
- append/ingest
- legal admissibility
- settlement correctness
