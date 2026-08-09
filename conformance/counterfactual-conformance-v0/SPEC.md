# Counterfactual Conformance v0 — Umbrella Package

Frozen profile: `counterfactual-conformance-v0`

## Normative purpose

Bind the exact frozen 10-member Counterfactual Conformance v0 neighborhood into
one versioned umbrella package with:

1. a deterministic **DCN** generator grounded in frozen child vector authorities;
2. cryptographic child-package and expected-result-set bindings;
3. a closed production verification entrypoint (package → DCN → Lane I → Lane H);
4. an independent package-identity auditor that does not import production code.

## Authoritative meaning of DCN

**DCN** means **Deterministic Counterfactual Neighborhood**.

It is the ordered challenge-identity set with schema
`receiptos.counterfactual_neighborhood.v0` whose SHA-256 identity is the Lane B
neighborhood digest. Leaf challenge SPECs list `dcn` as a non-claim; this
umbrella is the package that closes that DCN identity for the exact 10-member
inventory.

DCN identity excludes expected results, actual/runtime results, source validity,
verdicts, timestamps, host paths, and ambient worktree state.

## Exact identity chain

1. Frozen child packages publish `fixture_set_sha256` and
   `expected_result_set_sha256`.
2. Umbrella `contract.children` binds each of the 10 members by package path,
   vector id, surface, execution class, and those digests.
3. `child_identity_set_sha256` uses the repository aggregate recipe: ordered
   child identity records → canonical JSON (`sort_keys`, compact separators) →
   UTF-8 → SHA-256 lowercase hex.
4. DCN generator loads committed vector bytes, projects Lane A → Lane B
   identities in declared order, and recomputes neighborhood SHA-256.
5. Generated DCN must equal pinned Lane B digest:
   `37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d`.
6. Umbrella `fixture_set_sha256` hashes sorted frozen member files except
   `manifest.json` using `<path>\t<file-sha256>\n`.

## Child package authority

Child packages remain authoritative for vector semantics. The umbrella does not
copy expected payloads and does not reinterpret challenge meaning. Missing,
duplicate, extra, substituted, or digest-mismatched children fail closed as
package verification errors — never as semantic nonconformance.

## Expected-result binding

Lane G remains the semantic expected authority. The umbrella binds the exact
expected-result-set digests required by all 10 members. It does not accept
caller-supplied expected digests and does not derive expected data from
execution.

## Source materialization and evaluation sequence

Production entrypoint:
`verifyCounterfactualConformancePackage` in
`src/receiptos/challenge/counterfactual-conformance-package.ts`.

Exact sequence:

1. Validate umbrella schema and package identity.
2. Validate child package identities/digests.
3. Generate/reconstruct the DCN.
4. Recompute and verify Lane B neighborhood SHA-256.
5. Derive the Lane H request through Lane I.
6. Evaluate the neighborhood through Lane H.
7. Return the bounded aggregate evaluation plus minimum package identity
   evidence.

## Aggregate verdict rules

Lane H aggregate rules apply unchanged:

- evaluated + all members conformant → aggregate conformant;
- evaluated + any nonconformant and zero unresolved → aggregate nonconformant;
- any execution-unresolved member → aggregate execution-unresolved, verdict null;
- inventory/identity failures are pre-execution package or aggregate contract
  errors and are not semantic nonconformance.

## Unresolved semantics

Unresolved is not nonconformant. Package corruption is not verifier
nonconformance.

## Deterministic regeneration / check

```text
bun conformance/counterfactual-conformance-v0/generate_package.ts --check
bun conformance/counterfactual-conformance-v0/generate_package.ts --write
```

`--check` generates into memory, compares committed generated artifacts, reports
drift, and never rewrites files.

`--write` targets only `conformance/counterfactual-conformance-v0/` generated
identity files (`contract.json`, `manifest.json`, `dcn/neighborhood.json`).
It never mutates child packages.

## Independent verification

```text
python conformance/counterfactual-conformance-v0/verify_independent.py
bun conformance/counterfactual-conformance-v0/audit_package.ts
```

Independent auditors verify umbrella structure, child inventory, digests, DCN
canonical preimage / Lane B SHA-256, and closed file inventory without importing
ReceiptOS production TypeScript.

## Explicit non-claims

This package does not claim:

- source validity;
- universal verifier correctness;
- coverage beyond the exact frozen 10-member neighborhood;
- absence of all implementation defects;
- real-world system authorization;
- equivalence between unresolved and nonconformant.
