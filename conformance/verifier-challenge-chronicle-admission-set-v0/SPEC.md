# Verifier Challenge Chronicle Admission Set v0 — Aggregate Index

Frozen profile: `verifier-challenge-chronicle-admission-set-v0`

This package is an **aggregate index and boundary** over three already-frozen
ReceiptOS Chronicle admission challenge packages for the pinned
`tryCreateChronicleEntryV0` admission profile.

It does **not** freeze new Chronicle admission challenge semantics, fourth
challenges, every admission reason code, full Chronicle admission closure,
global verifier completeness, timing semantics, TEE admission, semantic
neighbors, DCN, verifier-of-verifier, legal admissibility, or settlement
correctness.

## Purpose

Provide a deterministic index over frozen child packages:

1. `proof_root_mismatch_rejected` — cross-object consistency
2. `proof_object_id_invalid_rejected` — portable proof-object identity consistency
3. `capsule_label_inconsistent_rejected` — reported-state consistency

Child packages remain authoritative for vector semantics, mutations, field
classification, and encoded admission results. This aggregate package references
child package digests only and does not copy or reinterpret child vectors.

## Subject admission verifier

- Entrypoint: `tryCreateChronicleEntryV0`
- Module: `src/receiptos/capsule/chronicle-portfolio-v0.ts`
- Pinned by Git index/object-store blob OID in the contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Ordered child inventory

| Ordinal | challenge_id | trust_boundary | package_path |
| --- | --- | --- | --- |
| 1 | `proof_root_mismatch_rejected` | cross-object-consistency | `conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0` |
| 2 | `proof_object_id_invalid_rejected` | identity-consistency | `conformance/verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0` |
| 3 | `capsule_label_inconsistent_rejected` | reported-state-consistency | `conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0` |

Each child entry carries:

- `vector_count = 1`
- `execution_class = production-admission-binding`
- frozen `fixture_set_sha256`
- frozen `expected_result_set_sha256`

## Frozen coverage statement

These three child packages cover the distinct admission trust boundaries
presently frozen for the pinned `tryCreateChronicleEntryV0` admission profile:

1. **Cross-object consistency** — embedded root-bearing fields must agree with
   independently verified evidence roots.
2. **Portable proof-object identity consistency** — canonical proof-object
   identity must derive from the verified receipt root.
3. **Reported-state consistency** — producer-reported capsule labels must not
   contradict independently verified receipt state.

This is **not** a claim that every Chronicle admission reason code has its own
frozen vector, that all Chronicle admission behavior is covered, or that
ReceiptOS Chronicle admission conformance is complete across all surfaces.

## Minimal-set basis

A read-only minimality audit established `THREE_CHALLENGE_MINIMAL_SET_REACHED`
for the current production surface. Remaining admission reason codes classify as:

- additional vectors within the three represented trust boundaries
- receipt-root prerequisite or receipt-root surface overlap
- non-production adapter taxonomy (`malformed_input`)

This aggregate introduces **no new vectors**, **no new mutation semantics**,
**no new reason codes**, and **no new failure classes**.

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
`verifier-challenge-set-v0` discipline.

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
- execution classes: `production-admission-binding` × 3
- aggregate vectors: 0 (no `vectors/` directory)

## Semantic authority

Child package SPECs, contracts, and vectors remain authoritative for challenge
semantics. This aggregate SPEC is authoritative only for set identity, child
ordering, child digest references, trust-boundary mapping, subject admission
verifier pin, aggregate digest recipe, and claim boundary.

## Independence scope

Python and TypeScript auditors recompute aggregate package and child-reference
digests without ReceiptOS production imports. They do not execute
`tryCreateChronicleEntryV0` and do not re-derive child vector semantics.

## Non-goals

- new Chronicle admission challenge semantics
- fourth challenge
- Chronicle admission set completeness across ReceiptOS
- every admission reason code frozen
- verifier_result_inconsistent, proof_ref_invalid, capsule_stored_mismatch, or
  capsule_computed_mismatch as separate aggregate children
- timing semantics
- TEE admission
- semantic neighbors
- DCN
- verifier-of-verifier
- legal admissibility
- settlement correctness
