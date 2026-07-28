# Recursive Singleton Fold Profile v0 — Working Draft

**Status:** NON-NORMATIVE WORKING DRAFT.

**Classification:**

- non-core candidate executable profile;
- working draft;
- not yet frozen;
- not yet a conformance standard;
- not a ReceiptOS validity rule;
- not a Chronicle schema change;
- not a scoring, ranking, reputation, certification, or trust-tier mechanism.

This document pins profile-local semantics that the merged Recursive Aggregate Boundary v0 deliberately left unresolved. It does not claim that these semantics were already repository-global or already implemented before this document.

## 1. Purpose

This draft defines the narrowest candidate executable profile for a singleton semantic fold over an already admitted `chronicle_entry.v0` object.

This profile begins only **after** successful independent Chronicle admission.
It does not alter source receipt validity.
It does not alter Chronicle history.
It does not add reputation to ReceiptOS.
It does not create frozen vectors, schemas, evaluators, or conformance requirements yet.

## 2. Parent artifacts and governing boundary

This profile is downstream of, and constrained by:

- [`docs/RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md`](./RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md)
- [`docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`](./EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md)
- [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md)
- [`docs/CHRONICLE.md`](./CHRONICLE.md)
- [`docs/analysis/ruleset-version-pinned-input.md`](./analysis/ruleset-version-pinned-input.md)

This profile is one concrete instantiation of the RAB parent invariant:

> aggregated does not automatically become reputation truth

It also preserves the Async Decision Write rule that:

> same identity + non-identical canonical content is conflict

This profile does **not** reuse the word **conflict** for ordinary non-comparability, policy mismatch, class mismatch, or fold ineligibility.

## 3. Define-before-use terminology

This subsection pins exact meanings before later use.

### unchanged

`unchanged` is not a free semantic term.

Where retained as prose shorthand, it means only the exact equality relation declared by this profile, normally equality of the validated input and output `semantic_result_commitment`.

It does **not** mean byte-identical source and aggregate objects.

### same result

`same result` means equality of the profile-defined `semantic_result_commitment`, derived from byte-equivalent canonical semantic-statement objects.

### same policy

`same policy` means:

- byte-equivalent canonical `fold_policy_declaration`; and
- equal independently recomputed `fold_policy_commitment` values.

### comparable

`comparable` means eligible under the exact inline `comparability_class_declaration` whose stored commitment equals its independently recomputed commitment.

It does **not** mean generally similar, mutually valid, or merely admitted.

### same aggregate

For idempotent replay, `same aggregate` means both:

- equal `aggregate_id`; and
- byte-equivalent canonical aggregate content.

Equal `aggregate_id` alone is insufficient.

### identity conflict

`identity conflict` means:

- same claimed object identity; and
- non-identical canonical object content.

It does **not** mean policy mismatch, class mismatch, non-comparability, or fold ineligibility.

## 4. Source subject

The pinned source object type for this profile is:

- `chronicle_entry.v0`

This draft distinguishes four different things and does not treat them as aliases:

1. **source entry object identity**
2. **source entry canonical-content commitment**
3. **semantic result commitment**
4. **singleton aggregate identity**

Repository-grounded constraints:

- `entry_id` alone is insufficient to bind canonical entry content;
- `receipt_root` is a proof/evidence identity and must not silently become the fold semantic-result commitment;
- `proof_object_ref` is a reference and must not silently become semantic-result identity;
- source admission remains governed by the existing Chronicle admission gate;
- this profile begins only after successful independent admission; and
- a future portable package must ship enough source material to independently verify that admission rather than merely trust an `entry_id`.

## 5. Chronicle admission prerequisite

This profile consumes only a source object that already satisfied the existing Chronicle entry admission gate.

For this profile, the prerequisite is:

- the source object is a valid `chronicle_entry.v0` instance;
- that entry was produced only after successful independent admission under the existing Chronicle creation path; and
- the future portable package ships enough source material to independently verify that prerequisite.

This profile does not replace or weaken that admission gate.
A singleton fold over an admitted entry is still downstream read-side work, not a substitute for proof recomputation or Chronicle admission.

## 6. PROPOSED PROFILE-LOCAL FIELD — source_entry_content_commitment

### 6.1 Purpose

`source_entry_content_commitment` is a PROPOSED PROFILE-LOCAL COMMITMENT that binds the complete canonical `chronicle_entry.v0` object.

It exists because `entry_id` does not bind complete entry content.

### 6.2 Exact input object

The exact input object is the fully materialized `chronicle_entry.v0` JSON object with the following fields present and validated:

- `schema`
- `entry_id`
- `source_system`
- `receipt_root`
- `proof_object_ref`
- `evidence_capsule_ref`
- `provenance_summary_ref`
- `created_from`
- `labels`
- `notes`

### 6.3 Exact canonicalization and hashing

- canonicalization function/profile:
  - repository `canonicalize()` from `src/receiptos/canon/canonicalize.ts`
- canonicalization behavior:
  - object keys sorted lexicographically;
  - arrays preserve declared array order;
  - `undefined` is not permitted in the source object;
  - `null` remains explicit and canonicalized as `null`;
  - empty arrays remain explicit and canonicalized as `[]`.
- byte encoding:
  - UTF-8 bytes of the canonicalized JSON string
- hash algorithm:
  - SHA-256 hex digest
- output format:
  - `sha256:<64-lowercase-hex>`

### 6.4 Field inclusion rule

Every `chronicle_entry.v0` field is included.

This profile does **not** silently exclude:

- `labels`
- `notes`
- `created_from`
- `proof_object_ref`
- `evidence_capsule_ref`
- `provenance_summary_ref`

Repository-grounded reason:

Chronicle v0 currently defines `chronicle_entry.v0` as one first-class object shape. This profile therefore binds the complete declared source entry object rather than silently recasting some Chronicle fields as mutable sidecar metadata.

### 6.5 Fail-closed behavior

The implementation MUST fail closed if any of the following occurs:

- malformed JSON object;
- unknown field present;
- required field absent;
- field type mismatch;
- invalid `schema` value;
- non-string label member;
- malformed `receipt_root` or `proof_object_ref` shape;
- any attempt to canonicalize an object that is not first validated as an exact `chronicle_entry.v0` instance.

### 6.6 Safety property

Preferred safety property:

> same `entry_id` + different `source_entry_content_commitment` remains an explicit identity conflict

This preserves the Async Decision Write rule without silently trusting `entry_id` alone.

## 7. PROPOSED PROFILE-LOCAL FIELD — semantic_statement

### 7.1 Decision point

This draft does **not** reuse any existing field directly as the semantic-result commitment.

It does **not** reuse directly:

- `receipt_root`
- `proof_object_id`
- `proof_object_ref`
- `entry_id`
- `collection_root`
- `portfolio_root`

### 7.2 Chosen profile-local semantic statement

This draft defines the exact profile-local semantic statement object:

- `chronicle_entry_singleton_semantic_statement.v0`

This object is intended to express mechanically:

> this exact admitted `chronicle_entry.v0` content is eligible for the pinned singleton identity transition under the exact pinned fold-policy, comparability-class, and transition-rule declarations.

This is a profile-local eligibility/preservation statement.

It is **not**:

- a new ReceiptOS validity class;
- quality;
- reputation;
- correctness beyond existing admission; or
- terminal truth.

Merely renaming or rehashing proof/reference fields does not create a semantic-result class.
The semantic statement is derived only after independent Chronicle admission and after recomputation of all pinned profile declaration commitments.

### 7.3 Exact semantic-statement object

```json
{
  "schema": "chronicle_entry_singleton_semantic_statement.v0",
  "source_entry_schema": "chronicle_entry.v0",
  "source_entry_ref": "<entry_id>",
  "source_entry_content_commitment": "sha256:<...>",
  "source_admission_state": "chronicle_entry_independently_admitted",
  "fold_policy_commitment": "sha256:<...>",
  "comparability_class_commitment": "sha256:<...>",
  "transition_rule_commitment": "sha256:<...>",
  "singleton_transition_eligibility": "eligible_under_exact_singleton_profile_declarations"
}
```

### 7.4 Why this is the narrowest honest preserved relation

This statement is narrower than the complete source-entry content because it does not directly preserve all source-entry fields.

It preserves only the exact profile-local semantic statement that:

- one exact admitted Chronicle entry;
- with one exact source-entry content commitment;
- under one exact fold-policy commitment;
- one exact comparability-class commitment; and
- one exact transition-rule commitment;

is eligible for the singleton identity transition without semantic elevation.

`receipt_root` and `proof_object_ref` may remain source/provenance inputs in the admitted source entry but are not themselves promoted into semantic-result identity.

### 7.5 PROPOSED PROFILE-LOCAL COMMITMENT — semantic_result_commitment

`semantic_result_commitment` is derived from the complete exact semantic-statement object above.

- canonicalization function/profile:
  - repository `canonicalize()`
- byte encoding:
  - UTF-8 bytes of the canonicalized semantic-statement JSON
- hash algorithm:
  - SHA-256 hex digest
- output format:
  - `sha256:<64-lowercase-hex>`

### 7.6 Recomputation invariants

The following invariants are required:

1. the complete inline semantic-statement object is present;
2. `semantic_result_commitment` is independently recomputed from that object;
3. the stored commitment equals the recomputed commitment;
4. mismatch fails closed;
5. consumers MUST NOT trust the stored commitment without recomputation.

The semantic statement MUST also cross-check that its:

- `source_entry_ref`
- `source_entry_content_commitment`
- `fold_policy_commitment`
- `comparability_class_commitment`
- `transition_rule_commitment`
- `source_admission_state`

match the validated source object, recomputed source-entry commitment, independently recomputed declaration commitments, and validated admission prerequisite used by the aggregate.

## 8. PROPOSED PROFILE-LOCAL FIELD — fold_policy_declaration

### 8.1 Exact declaration object

```json
{
  "schema": "recursive_singleton_fold_policy.v0",
  "policy_version": "recursive-singleton-fold-policy-v0",
  "policy_id": "singleton-chronicle-entry-semantic-preservation",
  "source_object_schema": "chronicle_entry.v0",
  "aggregate_object_schema": "recursive_singleton_aggregate.v0",
  "member_cardinality": 1,
  "aggregation_mode": "singleton_only",
  "semantic_elevation": "forbidden",
  "source_identity_reuse": "forbidden",
  "multi_member_extension": "deferred"
}
```

### 8.2 Semantics

This declaration means:

- exactly one admitted `chronicle_entry.v0` source object is eligible;
- the aggregate object is distinct from the source entry;
- semantic preservation is permitted only in the narrow profile-local semantic statement defined by this profile;
- stronger semantic class creation is forbidden; and
- any multi-member behavior is deferred, not silently inherited.

### 8.3 Commitment derivation

PROPOSED PROFILE-LOCAL COMMITMENT:

- field name: `fold_policy_commitment`
- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output: `sha256:<64-lowercase-hex>`

### 8.4 Recomputation invariants

The following invariants are required:

1. the complete structured declaration is present;
2. its commitment is recomputed from the canonical inline declaration;
3. the stored commitment equals the recomputed commitment;
4. mismatch fails closed;
5. a consumer MUST NOT trust the stored commitment without recomputing it; and
6. the complete declaration bytes must ship in the future portable package.

## 9. PROPOSED PROFILE-LOCAL FIELD — comparability_class_declaration

### 9.1 Exact declaration object

```json
{
  "schema": "recursive_singleton_comparability_class.v0",
  "class_version": "recursive-singleton-comparability-class-v0",
  "class_id": "admitted-chronicle-entry-singleton",
  "source_object_schema": "chronicle_entry.v0",
  "admission_required": true,
  "cross_entry_comparability": "not_asserted",
  "cross_policy_bridge": "deferred",
  "cross_class_bridge": "deferred",
  "singleton_eligibility_rule": "exactly_one_independently_admitted_source_entry"
}
```

### 9.2 Semantics

This declaration means:

- the profile is defined only for exactly one independently admitted source entry;
- the profile does not assert general cross-entry comparability;
- singleton eligibility is explicit and does not automatically generalize to multi-member folds.

### 9.3 Commitment derivation

PROPOSED PROFILE-LOCAL COMMITMENT:

- field name: `comparability_class_commitment`
- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output: `sha256:<64-lowercase-hex>`

### 9.4 Recomputation invariants

The following invariants are required:

1. the complete structured declaration is present;
2. its commitment is recomputed from the canonical inline declaration;
3. the stored commitment equals the recomputed commitment;
4. mismatch fails closed;
5. a consumer MUST NOT trust the stored commitment without recomputing it; and
6. the complete declaration bytes must ship in the future portable package.

## 10. PROPOSED PROFILE-LOCAL FIELD — transition_rule_declaration

### 10.1 Exact declaration object

```json
{
  "schema": "recursive_singleton_transition_rule.v0",
  "rule_version": "recursive-singleton-transition-rule-v0",
  "rule_id": "semantic_result_preserving_singleton_identity_transition",
  "source_object_schema": "chronicle_entry.v0",
  "aggregate_object_schema": "recursive_singleton_aggregate.v0",
  "preserved_equality_relation": "semantic_result_commitment_equality_only",
  "source_identity_reuse": "forbidden",
  "stronger_class_creation": "forbidden",
  "fail_closed_on_malformed_or_unknown_input": true
}
```

### 10.2 Semantics

This declaration means:

- the singleton transition preserves semantic-statement commitment equality only;
- it does not preserve source object identity;
- it does not preserve byte identity with the source entry;
- it does not create stronger semantic class.

### 10.3 Commitment derivation

PROPOSED PROFILE-LOCAL COMMITMENT:

- field name: `transition_rule_commitment`
- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output: `sha256:<64-lowercase-hex>`

### 10.4 Recomputation invariants

The following invariants are required:

1. the complete structured declaration is present;
2. its commitment is recomputed from the canonical inline declaration;
3. the stored commitment equals the recomputed commitment;
4. mismatch fails closed;
5. a consumer MUST NOT trust the stored commitment without recomputing it; and
6. the complete declaration bytes must ship in the future portable package.

## 11. PROPOSED PROFILE-LOCAL OBJECT — recursive_singleton_aggregate.v0

### 11.1 Candidate object model

```json
{
  "schema": "recursive_singleton_aggregate.v0",
  "profile_version": "recursive-singleton-fold-profile-v0",
  "aggregate_id": "sha256:<...>",
  "source_entry_ref": "<entry_id>",
  "source_entry_content_commitment": "sha256:<...>",
  "semantic_statement": { "...": "..." },
  "semantic_result_commitment": "sha256:<...>",
  "canonical_inclusion_set": [
    {
      "member_schema": "chronicle_entry.v0",
      "member_ref": "<entry_id>",
      "member_source_entry_content_commitment": "sha256:<...>"
    }
  ],
  "inclusion_set_commitment": "sha256:<...>",
  "fold_policy_declaration": { "...": "..." },
  "fold_policy_commitment": "sha256:<...>",
  "comparability_class_declaration": { "...": "..." },
  "comparability_class_commitment": "sha256:<...>",
  "transition_rule_declaration": { "...": "..." },
  "transition_rule_commitment": "sha256:<...>",
  "pre_aggregation_breakdown": { "...": "..." },
  "pre_aggregation_breakdown_commitment": "sha256:<...>",
  "transition_result": {
    "status": "singleton_transition_ok",
    "semantic_equivalence_result": "semantic_result_commitment_preserved",
    "source_identity_reuse_result": "source_identity_not_reused",
    "stronger_semantic_class_creation_result": "no_stronger_semantic_class_created"
  },
  "no_stronger_semantic_class_created": true,
  "profile_local_notes": null
}
```

### 11.2 Identity-bearing fields

Identity-bearing fields are:

- `schema`
- `profile_version`
- `source_entry_ref`
- `source_entry_content_commitment`
- `semantic_result_commitment`
- `inclusion_set_commitment`
- `fold_policy_commitment`
- `comparability_class_commitment`
- `transition_rule_commitment`
- `pre_aggregation_breakdown_commitment`

### 11.3 Inspectable but not separately identity-bearing fields

These structured materials must remain available in the future portable package even when identity binds them through commitments:

- `semantic_statement`
- `canonical_inclusion_set`
- `fold_policy_declaration`
- `comparability_class_declaration`
- `transition_rule_declaration`
- `pre_aggregation_breakdown`
- `transition_result`
- `no_stronger_semantic_class_created`

### 11.4 Prohibited render/runtime metadata

The candidate aggregate identity must not silently absorb:

- wall-clock timestamps;
- renderer labels;
- UI presentation fields;
- runtime hostnames;
- tool execution timings;
- mutable comments;
- unbound explanatory prose.

No identity-bearing structured object may be committed only by an unverifiable label.
No cryptographic commitment may exist without the committed structured material being available in the future portable package.

### 11.5 Exact `profile_local_notes` contract

`profile_local_notes` MUST be present in every complete `recursive_singleton_aggregate.v0`.

Its value MUST be exactly one of:

- JSON `null`; or
- a JSON string.

The following MUST NOT appear as a `profile_local_notes` value:

- field omission;
- `undefined`;
- a JSON number;
- a JSON boolean;
- a JSON array;
- a JSON object.

Deterministic profile construction, including SF-V1 and SF-V1B, MUST emit:

```json
"profile_local_notes": null
```

A non-null string is permitted only as consumer-supplied, profile-local canonical content, attached only after the profile-mandated deterministic aggregate has already been independently constructed and verified.

A complete aggregate whose `profile_local_notes` is a non-null string MUST be validated as a complete aggregate at the point that value is present. It MUST NOT be described as valid merely because a prior version of the same aggregate with `profile_local_notes: null` was previously validated. Validation of the final complete aggregate MUST independently recompute and verify all identity-bearing commitments, all derived fields, and `aggregate_id`.

`profile_local_notes` MUST NOT affect:

- `source_entry_content_commitment`;
- `semantic_result_commitment`;
- `inclusion_set_commitment`;
- `fold_policy_commitment`;
- `comparability_class_commitment`;
- `transition_rule_commitment`;
- `pre_aggregation_breakdown_commitment`;
- policy eligibility;
- comparability eligibility;
- `transition_result`;
- `no_stronger_semantic_class_created`;
- `aggregate_id`;
- source or aggregate admission semantics;
- interpretation of evidence, history, comparability, or reputation.

It remains part of the complete canonical `recursive_singleton_aggregate.v0` content.

An empty string (`""`) is a permitted `profile_local_notes` value. JSON `null` and JSON `""` are distinct canonical contents.

A string value is interpreted as an exact JSON string value encoded through the profile's UTF-8 canonical JSON process. No Unicode normalization is performed or permitted implicitly; exact Unicode scalar values therefore remain significant to complete canonical aggregate bytes.

`profile_local_notes` remains:

- non-normative;
- semantically inert;
- non-identity-bearing;
- an intentional canonical-content conflict surface, per §20.

This subsection does not introduce a new commitment over `profile_local_notes` and does not add it to the aggregate identity seed defined in §12.1.

## 12. PROPOSED PROFILE-LOCAL FIELD — aggregate_id

### 12.1 Exact derivation seed

`aggregate_id` is derived from this exact seed object:

```json
{
  "schema": "recursive_singleton_aggregate_identity_seed.v0",
  "aggregate_schema": "recursive_singleton_aggregate.v0",
  "profile_version": "recursive-singleton-fold-profile-v0",
  "source_entry_ref": "<entry_id>",
  "source_entry_content_commitment": "sha256:<...>",
  "semantic_result_commitment": "sha256:<...>",
  "inclusion_set_commitment": "sha256:<...>",
  "fold_policy_commitment": "sha256:<...>",
  "comparability_class_commitment": "sha256:<...>",
  "transition_rule_commitment": "sha256:<...>",
  "pre_aggregation_breakdown_commitment": "sha256:<...>"
}
```

### 12.2 Exact derivation

- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output format: `sha256:<64-lowercase-hex>`
- truncation: none; full cryptographic identity required in v0

### 12.3 Aggregate-identity exclusions and classifications

The following fields are excluded from aggregate identity and classified explicitly:

- `semantic_statement`
  - safely derivable from identity-bound inputs because its full structure is bound by independently recomputed `semantic_result_commitment`
- `fold_policy_declaration`
  - safely derivable for identity purposes because its full structure is bound by independently recomputed `fold_policy_commitment`
- `comparability_class_declaration`
  - safely derivable for identity purposes because its full structure is bound by independently recomputed `comparability_class_commitment`
- `transition_rule_declaration`
  - safely derivable for identity purposes because its full structure is bound by independently recomputed `transition_rule_commitment`
- `canonical_inclusion_set`
  - safely derivable for identity purposes because its full structure is bound by independently recomputed `inclusion_set_commitment`
- `pre_aggregation_breakdown`
  - safely derivable for identity purposes because its full structure is bound by independently recomputed `pre_aggregation_breakdown_commitment`
- `transition_result`
  - safely derivable from identity-bound validated inputs and separately equality-checked against recomputation
- `no_stronger_semantic_class_created`
  - safely derivable because it is a recomputed invariant equality-checked against the stored value
- `profile_local_notes`
  - deliberately non-identity-bearing and semantically inert;
  - prohibited from changing normative interpretation;
  - still part of canonical aggregate content.

Any field in this profile that would be unsafe as an unbound semantic field must instead be:

- included in an identity-bearing commitment;
- made uniquely recomputable and equality-checked; or
- treated as a canonical-content conflict surface.

## 13. PROPOSED PROFILE-LOCAL FIELD — canonical_inclusion_set

### 13.1 Exact v0 structure

For v0 the inclusion set is exactly one member:

```json
[
  {
    "member_schema": "chronicle_entry.v0",
    "member_ref": "<entry_id>",
    "member_source_entry_content_commitment": "sha256:<...>"
  }
]
```

### 13.2 Exact rules

- cardinality: exactly `1`
- duplicate rule: duplicates forbidden by cardinality constraint
- ordering rule: fixed singleton order; no reordering semantics needed in v0
- reference field: `member_ref = source_entry_ref = entry_id`
- source-content binding field: `member_source_entry_content_commitment`

### 13.3 Inclusion-set commitment

PROPOSED PROFILE-LOCAL COMMITMENT:

- field name: `inclusion_set_commitment`
- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output: `sha256:<64-lowercase-hex>`

### 13.4 Recomputation invariants

The following invariants are required:

- `inclusion_set_commitment` MUST equal independent recomputation over the complete inline canonical inclusion set;
- mismatch fails closed;
- the inline member reference and source-content commitment MUST match the validated source entry;
- consumers MUST NOT trust the stored inclusion-set commitment without recomputation.

Aggregate-of-aggregates and multi-member folds remain deferred.

## 14. PROPOSED PROFILE-LOCAL FIELD — pre_aggregation_breakdown

### 14.1 Chosen representation

This v0 draft chooses:

- **inline structured breakdown**

Reason:

- least ambiguous;
- independently portable;
- easiest for a second implementation to inspect and recompute;
- avoids hiding profile meaning behind only a content address in the first profile.

### 14.2 PROFILE-LOCAL machine classifications

All machine vocabulary below is:

- **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**

Pinned permitted values in the successful v0 singleton case:

- `source_admission_prerequisite`
  - `chronicle_entry_independently_admitted`
- `inclusion_decision`
  - `included`
- `exclusion_decision`
  - `none`
- `comparability_evaluation`
  - `singleton_class_eligible`
- `policy_evaluation`
  - `singleton_policy_eligible`
- `no_elevation_finding`
  - `no_stronger_semantic_class_created`

### 14.3 Exact breakdown object

```json
{
  "schema": "recursive_singleton_breakdown.v0",
  "source_entry_ref": "<entry_id>",
  "source_entry_content_commitment": "sha256:<...>",
  "source_admission_prerequisite": "chronicle_entry_independently_admitted",
  "inclusion_decision": "included",
  "exclusion_decision": "none",
  "comparability_evaluation": "singleton_class_eligible",
  "policy_evaluation": "singleton_policy_eligible",
  "transition_input": {
    "semantic_result_commitment": "sha256:<...>"
  },
  "transition_output": {
    "semantic_result_commitment": "sha256:<...>"
  },
  "no_elevation_finding": "no_stronger_semantic_class_created"
}
```

### 14.4 Commitment and identity binding

The full inline breakdown remains available in the aggregate object.
Its commitment is identity-bearing through:

- `pre_aggregation_breakdown_commitment`

Derivation:

- canonicalization: repository `canonicalize()`
- bytes: UTF-8 canonical JSON bytes
- hash: SHA-256
- output: `sha256:<64-lowercase-hex>`

### 14.5 Recomputation invariants

The following invariants are required:

- `pre_aggregation_breakdown_commitment` MUST equal independent recomputation over the complete inline canonical breakdown;
- mismatch fails closed;
- consumers MUST NOT trust the stored commitment without recomputation;
- `comparability_evaluation` is recomputed from the source and exact comparability declaration;
- `policy_evaluation` is recomputed from the source and exact policy declaration;
- `transition_input` equals the validated input `semantic_result_commitment`;
- `transition_output` equals the independently derived output `semantic_result_commitment`;
- `no_elevation_finding` is recomputed from the exact transition rule and equality relation, not trusted as an annotation.

Unbound explanatory metadata must not substitute for this breakdown.

## 15. Deterministic transition_result

### 15.1 Exact profile-local object

`transition_result` is an exact deterministic profile-local object:

```json
{
  "status": "singleton_transition_ok",
  "semantic_equivalence_result": "semantic_result_commitment_preserved",
  "source_identity_reuse_result": "source_identity_not_reused",
  "stronger_semantic_class_creation_result": "no_stronger_semantic_class_created"
}
```

### 15.2 Exact derivation requirements

The following are required:

- `transition_result` is recomputed;
- stored and recomputed `transition_result` values are equal;
- mismatch fails closed.

### 15.3 Why transition_result may remain outside the identity seed

`transition_result` may remain outside the aggregate identity seed only because:

- it is fully and uniquely derivable from identity-bound validated inputs; and
- it is checked for equality with recomputation.

If a future revision makes `transition_result` not uniquely derivable, the necessary commitment must be added to the identity seed instead.

## 16. no_stronger_semantic_class_created as recomputed invariant

`no_stronger_semantic_class_created` is a recomputed invariant, not a trusted boolean assertion.

It is derived from:

- the pinned `transition_rule_declaration`;
- the input semantic statement;
- the output semantic statement;
- the preserved equality relation;
- the absence of source identity reuse; and
- the absence of any class promotion.

Stored and recomputed values MUST match.
Mismatch fails closed.

This field is safely excluded from aggregate identity only because it is uniquely recomputed from identity-bound inputs and equality-checked.

## 17. Exact singleton transition rule

### 17.1 Rule name

PROPOSED PROFILE-LOCAL FIELD:

- `semantic_result_preserving_singleton_identity_transition`

### 17.2 Exact validated inputs

The rule consumes only:

- one validated `chronicle_entry.v0` source object;
- one valid `source_entry_content_commitment` over that object;
- one valid inline semantic-statement object and valid `semantic_result_commitment` over that object;
- one valid `fold_policy_declaration` and `fold_policy_commitment`;
- one valid `comparability_class_declaration` and `comparability_class_commitment`;
- one valid `transition_rule_declaration` and `transition_rule_commitment`.

### 17.3 Preconditions

The rule fails closed unless all of the following are true:

- source entry is exact `chronicle_entry.v0`;
- source admission prerequisite is satisfied;
- source entry content commitment verifies;
- all declaration commitments independently verify against their inline declarations;
- the semantic statement independently verifies against the validated source object and declaration commitments;
- inclusion set cardinality is exactly one;
- singleton policy eligibility evaluates to `singleton_policy_eligible`;
- singleton comparability eligibility evaluates to `singleton_class_eligible`.

### 17.4 Exact output construction

The rule mechanically:

1. validates the complete source entry and admission prerequisite;
2. recomputes `source_entry_content_commitment`;
3. recomputes all declaration commitments;
4. evaluates singleton policy and comparability eligibility;
5. constructs the exact input semantic-statement object;
6. recomputes the input `semantic_result_commitment`;
7. constructs the singleton aggregate;
8. constructs the exact output semantic-statement object;
9. recomputes the output `semantic_result_commitment`;
10. requires equality between input and output semantic-result commitments;
11. derives `transition_result`;
12. derives `no_stronger_semantic_class_created`;
13. recomputes the breakdown and its commitment;
14. derives `aggregate_id` from all pinned identity inputs;
15. verifies all stored/recomputed values; and
16. fails closed on any mismatch.

### 17.5 Exact equality relation preserved

The preserved relation is:

> input semantic-statement commitment equality with output semantic-statement commitment

Concretely:

> output `semantic_result_commitment` equals validated input `semantic_result_commitment`

This is semantic equivalence.

It is **not**:

- source-entry byte identity;
- source-entry object identity;
- source identity reuse;
- proof identity promotion;
- stronger evidence;
- broader comparability; or
- reputation truth.

### 17.6 Exact failure conditions

Fail closed on:

- malformed source object;
- malformed declarations;
- malformed semantic statement;
- unknown fields where exact object shape is required;
- cardinality != 1;
- source admission prerequisite not satisfied;
- content commitment mismatch;
- semantic-statement mismatch;
- declaration commitment mismatch;
- inclusion-set commitment mismatch;
- breakdown commitment mismatch;
- transition-result mismatch;
- no-elevation invariant mismatch;
- aggregate identity seed mismatch;
- any attempt to treat source entry identity as aggregate identity.

### 17.7 Exact fail-closed result

The semantic rule is:

- do not emit a successful singleton aggregate;
- do not update, merge, replace, reinterpret, or silently deduplicate;
- surface profile-local failure classification only.

Any machine vocabulary at this layer remains:

- **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**

## 18. SF-V1 — future vector contract

### SF-V1 — degenerate-single-entry-fold

The future frozen vector must pin exact inputs sufficient for two independent implementations to derive and verify:

- `source_entry_content_commitment`;
- the exact semantic-statement object;
- `semantic_result_commitment`;
- all declaration commitments;
- `inclusion_set_commitment`;
- `pre_aggregation_breakdown_commitment`;
- `transition_result`;
- `no_stronger_semantic_class_created`;
- distinct `aggregate_id`; and
- complete candidate aggregate content.

Required source inputs:

- exact `chronicle_entry.v0` bytes;
- enough source-admission materials to independently verify the entry rather than trust `entry_id` alone;
- exact declaration objects and bytes for policy/class/rule.

The deterministic SF-V1 aggregate MUST contain exactly:

```json
"profile_local_notes": null
```

This value is part of complete canonical aggregate content but is excluded from every commitment and from `aggregate_id`, per §11.5 and §12.3.

No fixture bytes are created by this document.

## 19. SF-V1B — future vector contract

### SF-V1B — repeated-singleton-fold-idempotency

This future vector must pin that two executions over byte-equivalent canonical inputs and identical declarations produce:

- the same aggregate identity;
- byte-equivalent canonical aggregate content;
- the same exact semantic-statement object;
- the same commitments;
- the same `transition_result`;
- the same `no_stronger_semantic_class_created` invariant.

Both independent evaluator invocations MUST construct complete aggregate objects containing exactly:

```json
"profile_local_notes": null
```

The two invocations are: two separately parsed byte-equivalent canonical inputs, evaluated by two separate evaluator invocations, with equality required of complete canonical aggregate bytes, all commitments, `aggregate_id`, `transition_result`, and the no-elevation result. Separate operating-system processes and separate programming languages are not required by this vector; that concern belongs to the independent second implementation described in §23, not to SF-V1B.

This is:

- idempotent replay of the same aggregate construction.

This is **not**:

- reuse of source entry identity.

## 20. SF-C1 — future conflict-control contract

### SF-C1 — same-identity-nonidentical-content-conflict

Primary valid canonical-content conflict path:

- two otherwise valid canonical aggregate objects;
- the same identity-bearing fields and commitments;
- therefore the same derived `aggregate_id`;
- different permitted non-identity-bearing canonical content;
- for example different `profile_local_notes`;
- therefore non-identical complete canonical aggregate bytes.

The future SF-C1 vector must pin exactly this pair:

- Object A: `"profile_local_notes": null`
- Object B: `"profile_local_notes": "sf-c1"`

Both objects must be otherwise byte-equivalent and individually valid complete aggregate objects, with:

- the same identity-bearing fields;
- the same independently recomputed commitments;
- the same `aggregate_id`;
- different complete canonical aggregate bytes;
- both complete objects independently validating.

Changing `profile_local_notes` from `null` to `"sf-c1"` does not require changing or recomputing any identity-bearing value, but the final complete aggregate containing `"sf-c1"` must still pass full validation, per §11.5, at the point that value is present.

Expected semantics:

- explicit identity conflict;
- no update;
- no merge;
- no replacement;
- no reinterpretation;
- no silent deduplication.

`profile_local_notes` is non-normative, semantically inert, prohibited from changing interpretation, intentionally non-identity-bearing, and still part of canonical aggregate content.

### 20.1 Inline-structure divergence path

A second path must be distinguished clearly:

- changing an inline declaration, semantic statement, inclusion set, or breakdown while retaining its old stored commitment creates a structure-to-commitment mismatch;
- that mismatch must fail closed during cross-object consistency validation;
- it must not be accepted as a valid aggregate merely because the claimed `aggregate_id` remains unchanged.

This integrity mismatch is distinct from the primary valid SF-C1 conflict fixture.
The future frozen SF-C1 vector should use the valid non-identity-bearing canonical-content path so the case is independently reproducible without constructing an internally invalid aggregate.

### 20.2 Conflict semantics and separation

This profile distinguishes identity conflict from ordinary:

- non-comparability;
- policy mismatch;
- class mismatch; and
- fold ineligibility.

This reuses the Async Decision Write semantic rule exactly.

Any machine vocabulary at this profile layer must be marked:

- **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**

Suggested profile-local label, if later needed:

- `same_identity_nonidentical_content_conflict`

## 21. Boundaries and non-elevation

This draft states explicitly:

- admitted does not automatically become comparable;
- persisted does not automatically become fold-eligible;
- aggregated does not automatically become reputation truth;
- singleton wrapping does not create stronger evidence;
- a signed or hashed aggregate does not become semantically correct merely because its commitments verify;
- the profile does not alter source receipt validity;
- the profile does not alter Chronicle history; and
- the profile does not add reputation to ReceiptOS.

A future semantic-review pass means only internal profile consistency under repository-grounded review.
It does **not** mean frozen, independently implemented, externally reproduced, accepted by Aziz, or conformance certified.

## 22. Deferred scope

The following remain **DEFERRED**:

- aggregate-of-aggregates;
- cross-policy bridge rules;
- cross-class bridge rules;
- multi-member folds;
- order-dependent folds;
- reputation calculations;
- scoring;
- terminal-state interpretation;
- RAB-A1 entry-as-fold-raw-input;
- positive observation-axis work;
- frozen vectors;
- schemas and evaluator implementation.

RAB-A1 is mutually exclusive with the heterogeneous entry/aggregate model used by this profile.
It must not be silently blended into this profile.
Adopting RAB-A1 would require revising or superseding the distinct singleton aggregate identity rule.
Both representation models must not be presented as simultaneously active.
RAB-A1 remains unadopted in v0.

## 23. Promotion gate

Before this profile may produce frozen vectors, all of the following must be true:

- semantic review pass;
- exact profile bytes pinned;
- profile SHA-256 pinned from Git-index bytes;
- executable schema created;
- reference evaluator created;
- independent second implementation created;
- SF-V1, SF-V1B, and SF-C1 expected outputs generated independently;
- disagreements preserved and classified;
- manifest package generated from sorted Git-index bytes;
- LF-only / no-BOM checks pass; and
- complete ReceiptOS regression suite passes.

Independent confirmation remains gated on:

- exact pinned profile bytes;
- schemas;
- reference evaluator;
- independent second implementation;
- frozen vectors;
- disagreement preservation;
- manifest package; and
- independent recomputation.

## 24. Draft quality constraints

This document resolves the following terms to exact profile fields, declaration bytes, commitments, or deterministic rules:

- `unchanged` -> equality of validated input and output `semantic_result_commitment`
- `same result` -> equality of `semantic_result_commitment` derived from byte-equivalent canonical semantic-statement objects
- `same policy` -> byte-equivalent canonical `fold_policy_declaration` plus equal independently recomputed `fold_policy_commitment`
- `comparable` -> eligible under the exact inline `comparability_class_declaration` whose stored commitment equals its independently recomputed commitment
- `same aggregate` -> equal `aggregate_id` plus byte-equivalent canonical aggregate content
- `identity conflict` -> same claimed object identity plus non-identical canonical object content

Proposed names in this draft are not claimed as production names unless and until later artifacts pin them.

## 25. Recommended portable package inventory for future freezing

A future portable singleton package must include enough material for an independent implementation to derive without interpretation:

- source object identity;
- source entry content commitment;
- exact semantic statement object;
- semantic-result commitment;
- inclusion-set commitment;
- policy/class/rule commitments;
- aggregate identity;
- idempotent replay; and
- identity-conflict control.

Minimum package materials:

- exact `chronicle_entry.v0` bytes;
- enough source-admission materials to verify that entry honestly;
- exact declaration objects and bytes;
- manifest with sorted file inventory;
- expected aggregate artifact bytes;
- expected SF-C1 conflict-control materials;
- independent recomputation instructions.

## 26. Summary

This draft does not claim that the repository already had a singleton-fold profile.
It proposes one narrow candidate profile-local semantics package so that a future frozen vector does not silently decide architecture by fixture construction alone.

The narrow profile-local commitments pinned here are:

- complete source-entry content commitment;
- separate semantic statement and semantic-result commitment;
- inspectable and hashable policy/class/rule declarations;
- explicit singleton inclusion set;
- explicit inline pre-aggregation breakdown;
- deterministic transition_result;
- recomputed no-elevation invariant;
- distinct aggregate identity; and
- exact identity-conflict control semantics.

That is the minimum honest bridge from the merged Recursive Aggregate Boundary v0 working draft to a future frozen singleton package.
