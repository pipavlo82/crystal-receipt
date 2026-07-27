# Recursive Aggregate Boundary v0 — Working Draft

**Status:** Non-normative working draft.

## 1. Purpose

This document sketches a downstream read-side boundary for semantic folds over admitted entries or prior aggregates.

It does **not** modify ReceiptOS proof or admission semantics.
It does **not** add reputation, ranking, scoring, certification, or quality judgment to ReceiptOS.
It does **not** change Chronicle collection, portfolio, or checkpoint schemas.
It does **not** assign normative reason codes.
It does **not** yet define an executable schema.

Later profiles MAY implement this boundary. This document only defines the first working-draft framing.

## 2. Parent invariant

Parent invariant:
[`docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`](./EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md)

This draft is an instantiation of semantic non-elevation, not a new independent principle.

Required relationship:

> aggregated does not automatically become reputation truth

Prior aggregation does not promote an object into:

- a stronger evidence class;
- validity;
- comparability;
- quality;
- reputation truth;
- terminal judgment.

## 3. Repository boundary being clarified

This repository already distinguishes between:

- **Chronicle collection / portfolio / checkpoint** as structural aggregates with recomputable reference-based identity; and
- **Recursive Aggregate Boundary** as semantic read-side fold constraints over admitted entries or prior aggregates.

Chronicle artifacts already demonstrate:

- structural recursion;
- sorted reference normalization;
- independently recomputable roots; and
- separation of root-bearing and non-root metadata.

They do **not** yet establish:

- semantic comparability;
- semantic fold eligibility;
- cross-policy bridge rules;
- recursive aggregate judgment admission; or
- pre-aggregation judgment breakdown.

This distinction must remain explicit. Structural Chronicle aggregates must not be described as already implementing semantic fold comparability.

## 4. Scope and non-goals

This draft proposes a downstream read-side boundary for semantic folds.

It does **not**:

- redefine receipt validity;
- redefine admission;
- change Chronicle root derivation;
- add score, reputation, ranking, certification, or quality semantics;
- define a final wire format, schema, or hash algorithm;
- define a final executable profile;
- define a normative reason-code vocabulary.

## 5. Relation to Chronicle and proof semantics

ReceiptOS proof semantics remain proof-first:

- canonicalization;
- recomputation;
- admission;
- independently recomputable object roots.

Chronicle remains the continuity layer where admissible receipts aggregate into history.

A recursive aggregate boundary begins **after** those steps when a consumer wants to interpret admitted entries or prior aggregates as one semantic fold result.

That later fold is not policy-neutral by default.
Aggregation alone does not create a stronger semantic class.

Reputation remains a downstream consumer example only. The fold is never terminal merely because a prior aggregate exists.

## 6. Core recursive rule

Proposed core rule:

> Any aggregate that may be consumed by a higher-order fold must itself remain a first-class, class-carrying, independently recomputable object.

A recursive aggregate must preserve or bind:

- its own aggregate identity;
- pinned fold policy or policy commitment;
- comparability class;
- independently recomputable transition rule;
- complete canonical inclusion set;
- pre-aggregation breakdown;
- member references;
- member-level admission or eligibility results;
- inclusion and exclusion decisions; and
- the rule under which members were judged comparable.

A higher-order fold must apply the same class and policy checks to child aggregates that a first-level fold applies to entries.

## 7. Async Decision Write compatibility

This draft must compose with:
[`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md)

The existing repository rules remain unchanged:

- same identity plus non-identical canonical content is conflict;
- silent deduplication is not neutral;
- merge, update, replacement, or reinterpretation must not occur silently;
- byte-equivalent replay of the same canonical object may be idempotent.

This draft does **not** reuse the word **conflict** for ordinary non-comparability.

Preferred language for aggregate-fold failures:

- non-comparable;
- mixed-policy blocked;
- fold ineligible;
- recursive class mismatch.

**Identity conflict** remains reserved for:

- same identity + non-identical canonical content.

## 8. Singleton fold rule

This section is mandatory because a singleton fold is the first pressure case.

This draft does **not** define:

`fold({e}) == e`

as byte identity or object identity under the current heterogeneous entry and aggregate representations.

A bare entry and a singleton aggregate have different canonical content because the aggregate carries aggregate-specific fields such as:

- inclusion set;
- fold-policy binding;
- comparability class;
- transition-rule binding;
- pre-aggregation breakdown.

Therefore the proposed default rule is:

- the singleton aggregate has a distinct aggregate identity;
- the singleton aggregate may preserve the input’s semantic result commitment;
- the singleton aggregate may preserve the input’s pinned policy and comparability class;
- preservation establishes semantic equivalence, not object identity;
- aggregation alone must not create a stronger semantic class.

This draft intentionally uses the neutral term **semantic result commitment**.
The exact field mapping remains unresolved for a later executable profile.

Distinctions that must remain explicit:

### Input entry identity versus aggregate object identity versus semantic result commitment

- the input entry identity is one object identity;
- the singleton aggregate identity is a different aggregate object identity;
- the semantic result commitment may remain equivalent even when object identity differs.

### Default current model

- entry identity differs from singleton aggregate identity;
- a semantically non-transforming singleton fold may preserve the semantic result commitment;
- preservation is semantic equivalence, not byte identity or object identity.

### Same singleton fold executed twice

- same aggregate identity;
- byte-equivalent canonical aggregate;
- idempotent replay.

## 9. Conceptual micro-vectors

These are non-executable micro-vectors for boundary design.

### RAB-V1 — degenerate-single-entry-fold

Input:

- one admitted entry;
- one pinned policy;
- one comparability class;
- one fold transition rule.

Expected properties:

- aggregate identity differs from input entry identity;
- canonical inclusion set has exactly one member;
- pre-aggregation breakdown is present;
- semantic result commitment is preserved where the fold is semantically non-transforming;
- pinned policy and comparability class remain explicit;
- no stronger semantic class is created;
- the aggregate remains first-class and independently recomputable.

### RAB-V1b — repeated-singleton-fold-idempotency

Two independent executions over byte-equivalent canonical inputs under the same pinned policy, class, and transition rule must produce:

- the same aggregate identity;
- byte-equivalent canonical aggregate content;
- the same inclusion set;
- the same transition result.

### RAB-V2 — aggregate-of-aggregates

Input:

- two or more prior aggregates;
- explicit child policy/class commitments;
- a higher-order fold policy;
- a higher-order transition rule.

Expected properties:

- each child aggregate remains independently recomputable;
- lower-level inclusion sets and breakdowns remain traceable;
- comparability is checked before the higher-order fold;
- higher-order identity binds the canonical child references, policy, class, and transition rule;
- mismatched class or policy is blocked unless an explicit independently verifiable bridge rule exists;
- no prior aggregate is treated as terminal or privileged.

### RAB-A1 — entry-as-fold-raw-input

Deferred architectural alternative only.

RAB-A1 is not merely an implementation alternative that needs more tests.
It is a mutually exclusive representation fork relative to the default singleton distinct-identity rule used in this working draft.

Under the default heterogeneous entry/aggregate representation:

- a singleton aggregate has distinct canonical content; and
- a singleton aggregate has distinct object identity.

Under RAB-A1:

- every entry would instead be canonically defined as a fold over raw input.

That unification could create a byte-identity path for a singleton fold.
Adopting RAB-A1 would therefore require revising or superseding the default singleton rule in this working draft.
It would also require proving compatibility with existing schemas, roots, fixtures, exports, historical identities, and the complete test suite.

Both models must not be presented as simultaneously active or compatible.
This working draft prices the split explicitly and does **not** adopt RAB-A1 in v0.

## 10. Additional conceptual matrix

At minimum, later executable work should preserve the following cases:

| Case | Fold eligible? | Identity changes? | What must remain recomputable? | What must remain visible after blocked fold? |
|---|---|---:|---|---|
| homogeneous same-policy fold | yes | yes | inclusion set, policy binding, class, transition rule, output identity | full member breakdown |
| heterogeneous fold without bridge rule | no | n/a | member identities, child policy/class commitments, blocked condition | incompatibility + breakdown |
| mixed-policy blocked fold | no | n/a | policy commitments, inclusion/exclusion decision basis | mixed-policy reason + breakdown |
| same members reordered under order-independent policy | yes | no | normalized inclusion-set commitment | normalized set and rule |
| member added or removed | maybe | yes | changed inclusion set and changed result | which member changed |
| same members under a different fold policy | maybe | yes | policy commitment and transition rule | policy difference |
| missing pre-aggregation breakdown | no | n/a | failure to satisfy fold contract | missing-breakdown visibility |
| persisted but not aggregate-comparable | no | n/a | source persistence and source admission state | breakdown without promoted judgment |
| aggregate-of-aggregates class mismatch | no | n/a | child class commitments and higher-order rule | child mismatch traceability |
| duplicate-looking members without explicit dedup rule | no by default | n/a | exact member references and input multiplicity | duplicate visibility |
| fold output consumed by another downstream decision | depends on class/policy checks | maybe | child aggregate identity, class, policy, transition rule | retained lineage and child references |

## 11. Identity proposal

This draft does not freeze a final schema or hash algorithm.

Candidate aggregate identity inputs should conceptually include:

- aggregate profile/version;
- canonical inclusion-set commitment;
- pinned fold-policy commitment;
- comparability-class commitment;
- transition-rule commitment;
- canonical pre-aggregation breakdown commitment where required.

Constraints:

- metadata unrelated to semantic fold identity should not silently enter the aggregate identity;
- ordering may be normalized only when the pinned policy declares the fold order-independent;
- same members with a different policy, class, or transition rule must produce a different aggregate identity;
- identity collision with non-identical canonical content is an explicit conflict under the Async Decision Write rule.

## 12. Comparability and policy binding

Comparability is not granted by inclusion alone.

A later executable profile should likely require explicit representation of:

- member comparability class;
- fold comparability class;
- pinned fold policy or policy commitment; and
- any bridge rule required for cross-class or cross-policy composition.

This draft does not freeze the exact representation of those commitments.
It only states that a higher-order fold must not silently erase them.

The repository’s ruleset-pinning discipline is relevant here: if a later fold policy changes, that change must surface as a different commitment, never as silent reinterpretation.

## 13. Chronicle boundary

Chronicle Portfolio already demonstrates:

- structural recursion;
- sorted reference normalization;
- independently recomputable roots; and
- separation of root-bearing and non-root metadata.

It does not yet establish:

- semantic comparability;
- semantic fold eligibility;
- cross-policy bridge rules;
- recursive aggregate judgment admission; or
- pre-aggregation judgment breakdown.

Nothing in this draft implies that Chronicle must emit reputation.
Reputation remains a downstream consumer example showing why the fold is never terminal.

## 14. Labels and reason-code status

This draft may cite the existing working label:

- `persisted_not_aggregate_comparable`

But that label remains non-normative here unless and until the repository pins it as implemented vocabulary.

This draft does not invent a final reason-code vocabulary.
Candidate blocked conditions should remain descriptive only.

Examples of descriptive labels only:

- mixed-policy blocked;
- recursive class mismatch;
- fold ineligible;
- missing pre-aggregation breakdown.

## 15. Open questions

The following remain unresolved:

1. What is the exact representation of semantic result commitment?
2. What is the exact aggregate identity schema?
3. Is pre-aggregation breakdown directly identity-bearing, or referenced by commitment?
4. How are policy bridge rules represented?
5. Are duplicate member references rejected or normalized?
6. How are order-dependent versus order-independent fold profiles declared?
7. How are excluded members represented?
8. What is the correct terminal-state interpretation, if any?
9. Does any future profile adopt entry-as-fold-raw-input unification?

## 16. Recommended status path

The first artifact should be a non-normative working draft.

Only later work should decide whether to split into:

- a semantic boundary specification;
- an executable aggregate profile;
- a challenge-set extension; or
- a Chronicle-adjacent read-side package.

Until then, the safe repository position is:

- preserve structural Chronicle recursion as implemented;
- preserve Async Decision Write identity/conflict rules as implemented semantically;
- block semantic elevation from persistence, inclusion, prior aggregation, or apparent majority agreement.

## 17. Summary formulation

A recursive aggregate boundary is needed because an admitted object is not automatically a semantically comparable object, and a prior aggregate is not automatically terminal truth.

The working constraint for later profiles is simple:

> a higher-order fold may consume child aggregates only if those child aggregates remain first-class, class-carrying, independently recomputable objects whose inclusion sets, policy commitments, comparability basis, and breakdowns remain visible and verifiable.
