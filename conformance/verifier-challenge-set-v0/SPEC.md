# Verifier Challenge Set v0 — Aggregate Index

Frozen profile: `verifier-challenge-set-v0`

This package is an **aggregate index and boundary** over three already-frozen
ReceiptOS verifier challenge packages for the pinned
`verifyHandoffReceiptRoot` receipt-root profile.

It does **not** freeze new verifier challenge semantics, fourth challenges,
Verifier Challenge Set completeness across ReceiptOS, timing semantics,
Chronicle admission, TEE verifier surfaces, host-error conformance, semantic
neighbors, DCN, verifier-of-verifier, general schema validation, or full
tamper-proofing.

## Purpose

Provide a deterministic index over frozen child packages:

1. `observed_not_validated`
2. `missing_required_input_unverifiable`
3. `integrity_mismatch_rejected`

Child packages remain authoritative for vector semantics, mutations, field
classification, and encoded verification results. This aggregate package
references child package digests only and does not copy or reinterpret child
vectors.

## Subject verifier

- Entrypoint: `verifyHandoffReceiptRoot`
- Module: `src/receiptos/verify/verify-receipt.ts`
- Pinned by Git index/object-store blob OID in the contract.

Git blob pins refer to tracked Git index/object-store identities resolved with
`git rev-parse :<repository-relative-path>`. They do not refer to
platform-normalized working-tree bytes.

## Ordered child inventory

| Ordinal | challenge_id | package_path |
| --- | --- | --- |
| 1 | `observed_not_validated` | `conformance/verifier-challenge-observed-not-validated-v0` |
| 2 | `missing_required_input_unverifiable` | `conformance/verifier-challenge-missing-required-input-unverifiable-v0` |
| 3 | `integrity_mismatch_rejected` | `conformance/verifier-challenge-integrity-mismatch-rejected-v0` |

Each child entry carries:

- `vector_count = 1`
- `execution_class = production-verifier-binding`
- frozen `fixture_set_sha256`
- frozen `expected_result_set_sha256`

## Frozen coverage statement

These three child packages cover the distinct result relations presently frozen
for the pinned `verifyHandoffReceiptRoot` receipt-root profile:

1. **Observation non-elevation** — producer observation cannot override
   independently recomputed validity.
2. **Missing-required-input unverifiability** — absent required
   `anchor.receipt_root` cannot establish valid verification.
3. **Decisive receipt-body integrity mismatch detection** — mutation of a
   decisive receipt-body field is detected by recomputation while the pinned
   comparison operand remains unchanged.

This is **not** a claim that ReceiptOS verifier conformance is complete across
all verifier surfaces.

## Child identity rule

Child packages are referenced by their frozen package digests
(`fixture_set_sha256`, `expected_result_set_sha256`) and repository paths.
Independent auditors verify that each referenced child package exists and that
its live manifest/contract digests match the declared values.

## Aggregate digest rule

`child_identity_set_sha256` is computed from the ordered child identity
records in `contract.json`:

1. For each child in ordinal order, build a record containing only:
   `ordinal`, `challenge_id`, `package_path`, `vector_count`,
   `execution_class`, `fixture_set_sha256`, `expected_result_set_sha256`.
2. Encode the array as canonical JSON (`sort_keys=true`, compact separators).
3. UTF-8 encode the JSON string.
4. SHA-256 the bytes (lowercase hex).

## Aggregate package fixture digest

`fixture_set_sha256` for this aggregate package follows the repository
verifier-challenge package discipline:

- Sorted frozen member paths except `manifest.json`
- Each line: `<path>\t<file-sha256>\n`
- Concatenate UTF-8 lines, then SHA-256 (lowercase hex)

Frozen members: `SPEC.md`, `contract.json`.

## Execution inventory

- child packages: 3
- child vectors total: 3
- execution classes: `production-verifier-binding` × 3

## Semantic authority

Child package SPECs, contracts, and vectors remain authoritative for challenge
semantics. This aggregate SPEC is authoritative only for set identity, child
ordering, child digest references, subject verifier pin, aggregate digest
recipe, and claim boundary.

## Independence scope

Python and TypeScript auditors recompute aggregate package and child-reference
digests without ReceiptOS production imports. They do not execute
`verifyHandoffReceiptRoot` and do not re-derive child vector semantics.

## Non-goals

- new verifier challenge semantics
- fourth challenge
- Verifier Challenge Set completeness across ReceiptOS
- timing semantics
- Chronicle admission
- TEE verifier surfaces
- host-error conformance
- semantic neighbors
- DCN
- verifier-of-verifier
- general schema validation
- full tamper-proofing
