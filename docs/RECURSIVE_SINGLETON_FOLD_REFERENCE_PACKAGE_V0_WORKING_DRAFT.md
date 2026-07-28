# Recursive Singleton Fold Reference Package v0 — Working Draft

**Status:** NON-NORMATIVE WORKING DRAFT.

**Classification:**

- non-core candidate executable reference package;
- working draft;
- internally reviewed;
- byte-pinned as a draft artifact only;
- not frozen;
- not a conformance standard;
- not a ReceiptOS validity rule;
- not a Chronicle schema change;
- not a scoring, ranking, reputation, certification, or trust-tier mechanism.

This document defines the candidate reference-package contract for a future
frozen executable package built on the merged Recursive Singleton Fold Profile
v0.

It does **not**:

- change the RSF profile formula;
- change Chronicle schemas;
- change shared admission v0;
- decide shared admission v1;
- freeze the package in this pass; or
- make conformance claims.

## 1. Purpose

This working draft defines the narrowest reference-package contract needed to
make future frozen Recursive Singleton Fold vectors reproducible without
silently deciding architecture by fixture construction alone.

The package contract must be strong enough that two independent implementations
can derive the same canonical evaluation inputs, the same canonical accepted or
rejected outputs, the same package identity, and the same pairwise conflict
results from the same carried bytes.

This reference package remains downstream of:

- the merged Recursive Singleton Fold Profile v0;
- the merged Recursive Aggregate Boundary v0 draft;
- existing Chronicle admission semantics; and
- existing package-integrity precedents already present in the repository.

## 2. Scope and non-goals

This draft covers only the reference-package contract.

It does **not** yet create:

- schemas;
- validators;
- TypeScript types;
- evaluators;
- fixtures;
- vectors;
- manifests;
- runners;
- independent implementations.

It also does **not**:

- freeze package bytes;
- request independent reproduction;
- claim conformance; or
- change ReceiptOS or Chronicle core semantics.

## 3. Parent artifacts and binding discipline

This draft is constrained by:

- `docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md`
- `docs/RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md`
- `docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`
- `docs/ASYNC_DECISION_WRITE_V0.md`
- `docs/CHRONICLE.md`
- `docs/analysis/ruleset-version-pinned-input.md`

The package contract uses the repository’s existing pinned-input discipline:

- exact literals matter;
- exact declaration bytes matter;
- exact commitment recomputation matters;
- package identity must not depend on mutable runtime repository state.

## 4. Exact evaluation-input artifact

The canonical parse target for one singleton-fold evaluation is the closed
package-local input artifact:

- `recursive_singleton_fold_evaluation_input.v0`

This artifact is distinct from:

- the nested source-admission bundle;
- the evaluation output envelope; and
- the final aggregate object.

### 4.1 Exact top-level shape

```json
{
  "schema": "recursive_singleton_fold_evaluation_input.v0",
  "profile_id": "recursive-singleton-fold-profile-v0",
  "profile_sha256": "170909acb19d28cae58c8870c5169dfde8ae1416e84a5c798a89f336bc1974c5",
  "source_admission_bundle": {
    "...": "complete recursive_singleton_fold_source_admission_bundle.v0"
  },
  "fold_policy_declaration": {
    "...": "complete recursive_singleton_fold_policy.v0"
  },
  "comparability_class_declaration": {
    "...": "complete recursive_singleton_comparability_class.v0"
  },
  "transition_rule_declaration": {
    "...": "complete recursive_singleton_transition_rule.v0"
  },
  "profile_local_notes": null
}
```

### 4.2 Required fields and literals

All eight top-level fields are required:

- `schema`
- `profile_id`
- `profile_sha256`
- `source_admission_bundle`
- `fold_policy_declaration`
- `comparability_class_declaration`
- `transition_rule_declaration`
- `profile_local_notes`

Pinned exact literals:

- `schema` MUST equal exactly:
  - `recursive_singleton_fold_evaluation_input.v0`
- `profile_id` MUST equal exactly:
  - `recursive-singleton-fold-profile-v0`
- `profile_sha256` MUST equal exactly:
  - `170909acb19d28cae58c8870c5169dfde8ae1416e84a5c798a89f336bc1974c5`

Unknown top-level fields are malformed.

### 4.3 Requiredness and nullability

Pinned nullability:

- `profile_local_notes` is required and MUST be exactly one of:
  - `null`
  - JSON string
- empty string is permitted and is distinct from `null`
- all other top-level fields are required and non-null

### 4.4 Canonicalization boundary

The canonicalization boundary for one evaluator invocation is the complete
validated `recursive_singleton_fold_evaluation_input.v0` object.

Pinned requirements:

- validation occurs before canonicalization;
- canonicalization uses repository `canonicalize()`;
- input canonical bytes are UTF-8 canonical JSON bytes;
- no timestamp, runtime, host, path, or UI metadata is permitted;
- no Unicode normalization is applied.

### 4.5 Evaluation-input closure

The declaration objects inside the evaluation input are the exact complete
objects pinned by the RSF profile:

- `recursive_singleton_fold_policy.v0`
- `recursive_singleton_comparability_class.v0`
- `recursive_singleton_transition_rule.v0`

They are not shorthand labels and are not replaceable by loose function
arguments.

A frozen fixture package and an independent implementation require this one
closed evaluation-input artifact. Separate function arguments are not a
sufficient frozen package contract.

## 5. Chronicle construction-options adapter

The package may carry source-entry construction options that are passed into the
Chronicle entry constructor. The actual constructor semantics remain:

```ts
created_from: options?.createdFrom ?? proofObject.source_evidence_ref ?? null
```

The v0 package contract pins the adapter semantics exactly.

### 5.1 created_from

Package field shape:

- `created_from` is JSON string or `null`

Pinned adapter behavior:

- string:
  - pass the exact string as `createdFrom`
- `null`:
  - use constructor fallback semantics

Resulting Chronicle field:

- `proofObject.source_evidence_ref ?? null`

Therefore, in v0:

- `created_from: null` and omission are equivalent for this adapter
- `created_from: null` does **not** force output `null`
- when `proofObject.source_evidence_ref` is non-null, v0 cannot force null
- tagged fallback / force-null / exact-string modes are deferred to a future revision

### 5.2 entry_id

Package field shape:

- `entry_id` is JSON string or `null`

Pinned adapter behavior:

- string:
  - pass the exact string as `entryId`
- `null`:
  - omit `entryId`
  - constructor default path applies
- empty string:
  - preserved exactly because empty string is non-nullish

### 5.3 evidence_capsule_ref

Package field shape:

- `evidence_capsule_ref` is JSON string or `null`

Pinned adapter behavior:

- string:
  - pass the exact string as `evidenceCapsuleRef`
- `null`:
  - omit `evidenceCapsuleRef`
  - constructor default path applies
- empty string:
  - preserved exactly because empty string is non-nullish

### 5.4 provenance_summary_ref

Package field shape:

- `provenance_summary_ref` is JSON string or `null`

Pinned adapter behavior:

- string:
  - pass the exact string as `provenanceSummaryRef`
- `null`:
  - omit `provenanceSummaryRef`
  - constructor default path applies
- empty string:
  - preserved exactly because empty string is non-nullish

### 5.5 labels

Package field shape:

- `labels` is an array of exact string members

Pinned adapter behavior:

- evaluator passes a fresh array copy into construction
- exact string members are preserved
- exact array order is preserved
- no normalization, deduplication, or sorting is performed by package contract

### 5.6 notes

Package field shape:

- `notes` is JSON string or `null`

Pinned adapter behavior:

- string, including empty string:
  - preserved exactly
- `null`:
  - produces output `null`
- omission:
  - also produces output `null`

### 5.7 Nullish summary

For all `??`-controlled constructor string options in this package:

- explicit `null` and omission are equivalent where nullish-coalescing is used
- empty string is non-nullish and is therefore preserved exactly

## 6. Notes application order

The package pins notes application as follows:

1. deterministically construct and verify the aggregate with `profile_local_notes: null`;
2. derive commitments and aggregate identity;
3. apply the evaluation input’s final notes;
4. fully validate the complete final aggregate.

Pinned future vector notes:

- SF-V1 input notes are `null`
- SF-V1B input notes are `null`
- SF-C1 Object A notes are `null`
- SF-C1 Object B notes are `"sf-c1"`

## 7. Four-state evaluation model

The evaluator uses one exact exhaustive mapping.

### malformed

Use only for structural or literal-contract failures:

- malformed evaluation input;
- wrong schema/profile literals;
- missing or unknown input fields;
- malformed source bundle;
- wrong pinned dependency literals;
- malformed options;
- malformed evidence, proof object, source entry, or declarations.

### unverifiable

Use only for a structurally valid input where the receipt-root admission
prerequisite is unavailable and no judgment can be made.

### evaluated / rejected

Use for structurally valid and evaluable input that fails:

- recomputation;
- consistency;
- commitments;
- eligibility;
- transition;
- no-elevation;
- identity; or
- complete final aggregate validation.

### evaluated / accepted

Use only after every check passes and the complete final aggregate validates.

### Envelope consequences

Pinned consequences:

- accepted => aggregate present, finding null
- all other states => aggregate null, exactly one finding
- no partial aggregate is emitted
- host exceptions never choose canonical state or finding

## 8. Single-evaluation finding vocabulary

This draft uses a closed 32-code single-evaluation vocabulary.

Two required additions are pinned here:

- `malformed_evaluation_input`
- `complete_aggregate_validation_mismatch`

Pinned totals:

- malformed: `9`
- unverifiable: `1`
- evaluated/rejected: `22`
- total: `32`

Pinned legal states:

- `malformed_evaluation_input`
  - legal only under `evaluation_state: "malformed"`
- `complete_aggregate_validation_mismatch`
  - legal only under `evaluation_state: "evaluated"`
  - and `profile_verdict: "rejected"`

All of these remain:

- **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**

## 9. Exact 28-position evaluation order

There is exactly one operative evaluation-order definition in this document.
It contains exactly 28 positions.

1. complete evaluation-input shape and literals;
2. source-admission bundle shape and pinned dependency literals;
3. nested source-admission containers;
4. construction-options shape;
5. evidence shape;
6. Portable Proof Object shape;
7. claimed source-entry shape;
8. receipt-root prerequisite and recomputation;
9. cross-object consistency;
10. proof-object identity;
11. proof reference;
12. Chronicle admission gate;
13. reconstructed source-entry canonical-byte equality;
14. source-entry content commitment;
15. fold-policy declaration shape then commitment;
16. comparability declaration shape then commitment;
17. transition-rule declaration shape then commitment;
18. input semantic statement then commitment;
19. inclusion set then commitment;
20. policy eligibility;
21. comparability eligibility;
22. transition construction and forbidden source identity reuse;
23. output semantic statement and semantic-result preservation;
24. transition result;
25. no-elevation invariant;
26. breakdown then breakdown commitment;
27. aggregate identity;
28. apply final notes and fully validate complete aggregate.

Pinned exact failure codes:

- position 1:
  - `malformed_evaluation_input`
- position 4:
  - `malformed_source_entry_construction_options`
- position 8:
  - `source_admission_prerequisite_unavailable` when absent
  - otherwise `source_receipt_root_mismatch`
- position 28:
  - `complete_aggregate_validation_mismatch`

For every compound position:

- subchecks execute left-to-right exactly as written;
- the first failed subcheck determines the finding;
- shape validation precedes commitment recomputation;
- structure construction precedes structure commitment verification.

Position 12 has no separate host-exception code because every recognized gate
failure must already map to positions 8–11.
An unrecognized implementation exception is an implementation failure, not
canonical evaluator output.

## 10. Shared-admission v0 portability binding

The evaluator compares against exact package-contract literals:

- admission profile:
  - `receiptos-chronicle-admission-v0`
- fixture-set SHA:
  - `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f`

The repository manifest is historical provenance, not mutable runtime
authority.
The future RSF package carries the dependency identity.
Repository evolution cannot silently change evaluation meaning.
There is no automatic upgrade to v1.
Shared admission v1 remains unresolved and separate.

## 11. SF-V1 contract

SF-V1 consumes exactly one complete:

- `recursive_singleton_fold_evaluation_input.v0`

with:

- `profile_local_notes: null`

The expected output is exactly one accepted evaluation envelope.
All declaration objects come from the evaluation input, not loose unstructured
arguments.

## 12. SF-V1B contract

Pinned candidate files:

- `vectors/sf-v1b/input-a.json`
- `vectors/sf-v1b/input-b.json`
- `vectors/sf-v1b/expected-a.json`
- `vectors/sf-v1b/expected-b.json`

Pinned requirements:

- input files are byte-identical;
- their manifest hashes are identical;
- both are separately read and parsed from their own bytes;
- each complete evaluation input contains its own complete nested source bundle and declarations;
- both use `profile_local_notes: null`;
- separate evaluator invocations are mandatory;
- expected outputs are byte-identical accepted envelopes;
- no shared in-memory object is reused;
- this is replay idempotency only, not the independent second implementation.

## 13. SF-C1 pairwise contract

The exact ordered pairwise input is:

- `recursive_singleton_fold_pairwise_input.v0`

Exact fields:

- `schema`
- `object_a`
- `object_b`

Pinned requirements:

- all fields present;
- no unknown fields;
- ordered pair;
- `object_a` validated before `object_b`;
- no symmetric normalization;
- swapping A/B is a distinct deterministic input;
- output preserves A/B ordering;
- SF-C1 notes pair is fixed:
  - A: `null`
  - B: `"sf-c1"`

### 13.1 Pairwise malformed finding schema

The exact pairwise malformed finding is:

- `recursive_singleton_fold_pairwise_finding.v0`

Closed codes:

- `malformed_pairwise_input`
- `malformed_object_a`
- `malformed_object_b`

Malformed output must have:

- `conflict_state: "malformed"`
- `conflict_verdict: null`
- both aggregate-id fields null
- exactly one pairwise finding

Validation order:

1. outer pairwise input shape
2. `object_a` complete aggregate validation
3. `object_b` complete aggregate validation
4. pairwise comparison

If both objects are invalid, `malformed_object_a` wins because A is checked
first.

No vague wording such as:

- equivalent shape;
- codes as appropriate; or
- reuse of single-evaluation malformed codes for pairwise input

remains operative in this document.

## 14. Manifest and fixture-set identity mechanics

The package manifest mechanics are pinned exactly as follows.

- `manifest.json` is package-carried
- it is not listed in its own `files` array
- it does not contribute to its own `fixture_set_sha256`
- no circular self-hash exists
- every other identity-bearing package file appears exactly once
- package paths are sorted by unsigned UTF-8 byte order
- fixture-set input is exactly:
  - `<path><TAB><lowercase-sha256><LF>`
- README, when carried, is listed and contributes
- schemas, dependency records, inputs, expected outputs, and profile/hash records contribute
- source code, validators, runners, tests, diagnostics, and conformance tooling do not contribute
- no unmanifested package file is allowed

This matches actual shared-admission package precedent:

- README is included through `manifest.files`
- the manifest itself is not included in its own `files` array

## 15. Aggregate validation and conflict separation

This reference package preserves the RSF profile’s distinction among:

- malformed input;
- unverifiable prerequisite absence;
- evaluated/rejected failure;
- evaluated/accepted success;
- pairwise identity conflict between otherwise valid aggregates.

A pairwise malformed result is not the same thing as a valid same-identity
non-identical-content conflict.
A single-evaluation malformed code is not reused as a pairwise malformed code.
A malformed aggregate is not accepted merely because it carries a claimed
aggregate identity.

## 16. Candidate paths

Candidate runtime schema paths use the existing repository schema convention
under:

- `src/receiptos/schemas/`

Added candidate runtime schemas:

- `src/receiptos/schemas/recursive-singleton-fold-evaluation-input-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-pairwise-input-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-pairwise-finding-v0.schema.json`

Candidate vector materials remain under fixtures:

- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1/input.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1/expected.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/input-a.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/input-b.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/expected-a.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/expected-b.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-c1/input.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-c1/expected.json`

All paths remain candidate, not canonical.

## 17. Reference implementation boundary

This working draft does not introduce:

- frozen vectors;
- canonical manifests;
- executable schemas;
- validators;
- evaluators;
- runners;
- independent implementations; or
- conformance claims.

It does not freeze the package in this pass.
It does not alter any RSF profile formula.
It does not change Chronicle schemas.
It does not change shared admission v0 bytes.
It does not decide shared admission v1.

## 18. Independent second implementation boundary

This draft keeps replay idempotency (SF-V1B) separate from the later
independent second implementation requirement.

SF-V1B proves:

- byte-identical inputs;
- separate parsing;
- separate evaluator invocation; and
- byte-identical accepted outputs.

It does **not** by itself satisfy:

- an independently authored second implementation.

## 19. Summary

This document now contains one coherent operative contract for the Recursive
Singleton Fold Reference Package v0 working draft.

It pins exactly:

- the Chronicle construction-options adapter semantics;
- one closed evaluation-input artifact;
- one exhaustive four-state model;
- one closed 32-code single-evaluation vocabulary;
- one exact 28-position evaluation order;
- one portable shared-admission v0 dependency binding;
- one exact SF-V1 contract;
- one exact SF-V1B replay-idempotency fixture contract;
- one exact ordered SF-C1 pairwise contract; and
- one non-circular manifest and fixture-set identity rule set.

This remains an internally reviewed reference-package working draft.
It is readiness-closed for the currently identified contract gaps.
It is **not** frozen.
