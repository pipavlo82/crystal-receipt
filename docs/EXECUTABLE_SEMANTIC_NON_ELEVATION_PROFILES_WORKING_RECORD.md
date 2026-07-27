# Executable Semantic Non-Elevation Profiles — Working Research Record

> **Status**: Non-normative working research record
> **Author**: Pavlo Tvardovskyi
> **Repository**: `pipavlo82/crystal-receipt`
> **Date**: 2026-07-26

This document is not a ReceiptOS specification.

This document does not define conformance.

This document does not allocate normative reason codes.

This document does not certify verifiers.

This document does not change any existing ReceiptOS or Chronicle artifact.

Examples and working labels in this document are research material only.

Research provenance note:

- this record extracts recurring semantic seams already present in ReceiptOS and Chronicle;
- the independent blind-diff work by Tiago Merlini demonstrated why disagreement needs to remain visible and classified rather than silently folded into agreement;
- Aziz's independent async-write compatibility pressure test exposed the downstream aggregate/read-side fold as the next seam;
- neither collaborator is represented here as endorsing this entire working record.

## 1. Status and non-normative scope

This document records a research direction rather than a frozen repository contract.

It is a working record for a family of semantic seams that already recur across ReceiptOS, Chronicle, witness admission, and async decision-write work. It is not a schema contract, not a vector package, not a challenge corpus, and not a replacement for any existing artifact in this repository.

The purpose of the record is narrower than a new taxonomy and broader than a single bug note. It tries to describe a repeatable pattern: one semantic dimension is observed, proven, or computed correctly, and then some downstream system silently treats that result as a stronger result in a different dimension.

The document also sets a boundary around future work. It is not the future executable challenge corpus, and it is not a future normative profile. It is a staging artifact for thinking clearly about what a negative corpus should test and what a future seam-specific profile would need to state explicitly.

## 2. Problem statement

Systems often observe one defensible fact and quietly reinterpret it as a stronger fact that belongs to another semantic dimension.

Typical examples include these transitions:

- observed does not automatically become valid;
- authorized does not automatically become executed;
- executed does not automatically become settled;
- settled does not automatically become historically admitted;
- signed does not automatically become a higher evidence class;
- attested does not automatically become judgment-correct;
- individually admitted entries do not automatically become one comparable aggregate judgment.

The problem is not that the later dimension is unimportant. The problem is that the later dimension usually needs its own rule, evidence basis, authority boundary, and failure mode. When those are skipped, a system can look coherent while silently changing what it claims to know.

The research contribution here is not a new universal taxonomy. It is a reusable way to expose and test semantic seams. The practical goal is to make illegal or unjustified promotions visible, reproducible, and eventually executable as negative-corpus tests.

## 3. Core non-elevation invariant

The core research invariant is this:

> No semantic dimension automatically elevates into another semantic dimension without an explicit, independently verifiable transition rule.

This statement is intentionally broader than any single ReceiptOS seam.

It means that adjacency is not equivalence.

It means that sequence is not implication.

It means that signature is not semantic promotion.

It means that later observation is not retrospective mutation.

It means that aggregation is not policy-neutral interpretation.

A workflow may place dimensions next to one another. A repository may store them in neighboring fields. A downstream system may find the next inference convenient. None of those facts is enough by itself.

Some systems may define valid transitions. This working record does not reject that. It treats a transition as legitimate only when the transition itself is declared, bounded, and independently checkable.

In this framing, the source fact is not denied. The claim is narrower: the source fact alone is insufficient to justify a stronger target claim in another dimension.

## 4. Semantic dimensions are orthogonal

One recurring design mistake is to model all downstream states as one global state machine. This working record does not do that.

The dimensions below are treated as independent dimensions that may be operationally ordered in a workflow without becoming proofs of one another.

| Semantic dimension | Representative states |
|---|---|
| validity | valid, invalid, unverifiable, malformed |
| observation | observed, not observed, unavailable, partially observed |
| timing | on_time, late, overdue, pending, stale |
| authorization | authorized, unauthorized, unknown |
| execution | executed, not executed, partially executed, unknown |
| settlement | settled, not settled, pending, disputed |
| admission | admitted, not admitted, pending, unavailable |
| persistence | written, not written, idempotent, conflict |
| historical inclusion | included, not included, checkpoint-bound, unresolved |
| evidence class | unsigned, signed, witnessed, attested |
| comparability class | comparable, non-comparable, mixed-policy, unresolved |
| aggregate interpretation | set, grouped summary, fold result, blocked aggregate |

> The table is a research map, not a claim that every listed dimension already has a first-class ReceiptOS or Chronicle artifact. Not every system represented by this working record implements every dimension, and the absence of one dimension does not imply failure of the others.

A workflow may order these dimensions operationally. That still does not make one state proof of the next.

For example:

- an observed result is not yet a valid result;
- an authorized action is not yet an executed action;
- a persisted record is not yet a historically included record;
- a signed record is not yet a higher evidence class;
- an admitted entry is not yet an aggregate-comparable judgment.

The working record therefore treats the dimensions as orthogonal first, and only then asks whether a seam-specific transition rule exists.

## 5. Profile grammar

This section proposes a non-normative candidate structure for a semantic non-elevation profile.

It is a working profile grammar, not a schema.

A reusable profile would ideally identify:

1. profile identifier;
2. source semantic dimension;
3. target semantic dimension;
4. source facts;
5. prohibited automatic inference;
6. explicit transition rule, when one exists;
7. required transition evidence;
8. transition authority;
9. independent recomputation procedure;
10. positive control;
11. negative case;
12. historical-retention rule;
13. unexercised branches;
14. relationship to source artifact validity;
15. relationship to Chronicle.

This grammar is intentionally compact. Its purpose is to keep seams inspectable and executable without pretending that all systems share one universal vocabulary.

## 6. Explicit transition-rule requirements

An allowed elevation requires an explicit rule. The rule needs to identify at least:

- the exact source object or source facts;
- the target claim;
- the evidence that bridges them;
- the policy or profile under which the bridge is evaluated;
- who or what is authorized to apply the rule;
- the declared evaluation view;
- the independently recomputable procedure;
- the failure behavior;
- whether historical facts remain preserved.

This research track rejects transitions inferred merely from:

- field presence;
- signature presence;
- attestation presence;
- successful persistence;
- chronological adjacency;
- majority agreement;
- prior admission;
- lack of an observed conflict.

Those facts may still matter. The point is that none of them, by itself, closes the seam.

## 7. Independent recomputation

This section is grounded in the recurring ReceiptOS rule: Don't trust. Recompute.

A transition claim is not independently verifiable when the verifier merely accepts:

- a producer-reported result;
- a source verifier status;
- an unexamined signature assertion;
- a precomputed aggregate judgment;
- a claimed equivalence class.

For the purposes of this working record, it helps to distinguish four activities:

1. recomputation of source facts;
2. verification of transition evidence;
3. evaluation under a declared profile;
4. production of the target outcome.

Those activities may be adjacent, but they are not the same thing.

Not every future domain in this research track will use the same computation. The shared discipline is narrower: a stronger downstream claim should not appear merely because an upstream actor reported it or because an adjacent artifact carries a suggestive field.

## 8. Initial coordinate registry

The table below records an initial coordinate registry. It mixes well-supported coordinates with implied and future ones, but keeps their maturity visible.

| Coordinate | Source dimension | Prohibited inferred target | Existing repository precedent | Current maturity | Candidate transition evidence | Working-record classification |
|---|---|---|---|---|---|---|
| observation -> validity | observation | valid verdict | [`docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`](./EVIDENCE_CAPSULE_SCHEMA_V0.md), [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) | executable | original evidence + independent verifier recomputation | core |
| timing -> validity | timing | invalid or valid verdict by timing alone | [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md), [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) | executable | comparable basis evidence + timing profile evaluation | core |
| source-verifier report -> independent verifier result | observation/report | recomputed verifier truth | [`docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`](./EVIDENCE_CAPSULE_SCHEMA_V0.md), [`README.md`](../README.md) | normative prose | verifier rerun from original evidence | core |
| local validity -> admission | validity | admitted | [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md), [`docs/CHRONICLE.md`](./CHRONICLE.md) | normative prose | declared gate/profile + admission evaluation | core |
| admission -> persistence | admission | written/persisted | [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) | normative prose | write binding + write path gates + prior-write check | core |
| persistence -> historical inclusion | persistence | included in history | implied across [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) and [`docs/CHRONICLE.md`](./CHRONICLE.md) | architectural only | explicit inclusion/checkpoint rule | extension |
| authorization -> execution | authorization | executed action | execution pipeline in [`README.md`](../README.md) | architectural only | execution evidence / tool result / runtime record | extension |
| execution -> settlement | execution | settled outcome | downstream exclusion only | absent/future | settlement evidence under declared settlement profile | deferred |
| settlement -> historical admission | settlement | historically admitted | no direct repository artifact | absent/future | explicit historical admission rule | deferred |
| signature -> higher evidence class | evidence class | promoted evidence authority | proof-first / recomputation framing across [`README.md`](../README.md) and [`docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`](./EVIDENCE_CAPSULE_SCHEMA_V0.md) | architectural only | explicit evidence-class rule + verification | extension |
| attestation -> judgment correctness | evidence class / attestation | correctness of judgment | no direct repository seam | absent/future | attestation verification plus separate judgment evaluation | deferred |
| individual admission -> aggregate comparability | admission / aggregate interpretation | one comparable aggregate judgment | [`docs/CHRONICLE.md`](./CHRONICLE.md), downstream pressure from async-write analysis | architectural only | explicit fold rule + visible inclusion set + policy class check | extension |
| byte identity -> semantic equivalence | artifact identity | semantic sameness | byte-pinned fixture packages and Git-index hardening discipline | executable | explicit equivalence rule if a declared transformation profile allows it | extension |
| same identity -> update, merge, or replacement | identity / persistence | silent update, merge, replacement | [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) | normative prose | canonical content comparison + conflict rule | core |
| unavailability -> contradiction | observation / evidence availability | contradiction or invalidity | [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md), witness semantics in [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md) | executable | explicit contradictory evidence, not mere absence | core |
| absence of observation -> non-occurrence | observation | event non-occurrence | witness timing / coverage-bounded logic in [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md) | normative prose | explicit bounded coverage proof | core |
| later state -> retrospective mutation of historical fact | timing / observation / history | rewritten historical fact | [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md), [`tests/blind-diff/README.md`](../tests/blind-diff/README.md), [`tests/blind-diff/postcorrection.delta.diff`](../tests/blind-diff/postcorrection.delta.diff) | executable | explicit historical-retention rule | core |
| history -> score, reputation, ranking, or certification | historical inclusion / aggregate interpretation | score, reputation, ranking, certification | [`docs/CHRONICLE.md`](./CHRONICLE.md), [`README.md`](../README.md), [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) | normative prose | explicit downstream system with separate semantics | core |

This table should be read as a registry, not as a claim that all listed transitions are already implemented in repository code.

Coordinates classified as core are the most promising starting set for the first working record. Coordinates classified as extension or deferred are still valuable, but they should not make the first artifact overbroad.

The table is also intentionally accurate about absence. Current repository material does not provide implemented seam contracts for authorization, settlement, TEE-related attestation, or aggregate fold rules. Those appear here as implied or future coordinates, not as current repository implementations.

## 9. Historical fact preservation

The clearest concrete example in the current repository is the Unanchored Issuance-Time Witness correction recorded in [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md) and pressure-tested through [`tests/blind-diff/README.md`](../tests/blind-diff/README.md) and [`tests/blind-diff/postcorrection.delta.diff`](../tests/blind-diff/postcorrection.delta.diff).

That seam can be summarized this way:

- a historically proven overdue interval remains a historical finding;
- a later terminal or publication result may make the current timing state late;
- the later timing state does not erase the earlier overdue fact;
- preserving both findings prevented timing from absorbing history.

The concrete witness correction matters because it does not just add a new finding. It preserves disagreement structure. The blind-diff materials preserve the frozen Python residual as evidence of the original ambiguity rather than rewriting that residual into artificial agreement.

The same corrected coexistence structure also exists for publication: a historically proven `publication_overdue` finding remains distinct from a later `late_publication` timing result. The current 16-vector blind-diff package does not exercise that symmetric publication branch.

That historical preservation discipline is itself part of the seam logic. A corrected rule does not retroactively pretend the earlier ambiguity never existed. The historical disagreement remains visible, classified, and bounded.

The blind-diff detectors remain non-production, non-reference research tools. Their value here is methodological: they show why preserved disagreement is more honest than retroactive collapse.

## 10. Negative-corpus design model

The intended future executable corpus is not a bag of corrupted files. It is a seam-testing corpus.

A minimal negative-corpus item would contain:

- one source subject;
- one controlled mutation or omission;
- one prohibited elevation;
- one expected conformance observation;
- explicit preservation of source artifact validity;
- positive controls for equivalence-preserving transformations;
- deterministic identities;
- frozen bytes;
- independently reproducible results.

A negative corpus tests the seam, not whether the source receipt should be rewritten.

That distinction matters. A future conformance failure may show that a verifier or aggregate layer made an illegal promotion even when the source artifact remains valid for its own layer.

### 10.1 Initial candidate negative-corpus registry

Any candidate finding-like term in this section is labeled as a working research term only.

| Vector identifier | Source facts | Prohibited inferred state | Minimal mutation or omission | Expected conformance observation | Source artifact validity effect | Chronicle effect | Registry tier | Repository precedent |
|---|---|---|---|---|---|---|---|---|
| `observed_not_validated` | source observation exists | observed becomes valid | preserve observed source-verifier status without independent recomputation | **WORKING LABEL вЂ” NON-NORMATIVE:** observation_is_not_validation | source validity unchanged until recomputed | no Chronicle inclusion from observation alone | core | Evidence Capsule validity/observation separation |
| `timing_not_validity` | late or overdue timing fact | timing becomes invalidity by itself | preserve timing state, remove contradictory evidence | **WORKING LABEL вЂ” NON-NORMATIVE:** timing_is_not_validity | source validity unchanged or separately evaluated | no timing-only Chronicle effect | core | Witness timing rules |
| `source_report_not_recomputed_result` | producer/source verifier report present | report becomes independent verifier result | remove independent recomputation while preserving report | **WORKING LABEL вЂ” NON-NORMATIVE:** source_report_is_not_recomputed_result | source validity not established by report alone | no Chronicle entry from report alone | core | Evidence Capsule / README proof boundary |
| `authorized_not_executed` | authorization evidence exists | authorized becomes executed | omit or negate execution evidence | **WORKING LABEL вЂ” NON-NORMATIVE:** authorization_is_not_execution | source artifact still structurally valid | no execution-derived Chronicle effect | extension | pipeline precedent only |
| `executed_not_settled` | execution evidence exists | executed becomes settled | omit settlement evidence | **WORKING LABEL вЂ” NON-NORMATIVE:** execution_is_not_settlement | execution validity unchanged | no settlement-derived history | extension | future seam |
| `settled_not_historically_admitted` | settlement claim exists | settled becomes historically admitted | omit historical admission bridge | **WORKING LABEL вЂ” NON-NORMATIVE:** settlement_is_not_historical_admission | settlement claim unchanged | no automatic Chronicle inclusion | deferred | future seam |
| `signed_not_promoted` | signature present | signature becomes higher evidence class | preserve signature, remove class-promotion rule | **WORKING LABEL вЂ” NON-NORMATIVE:** signature_is_not_promotion | source validity unchanged | no upgraded Chronicle meaning | extension | proof-first framing |
| `attested_not_judgment_correct` | attestation present | attestation becomes correctness | preserve attestation, remove independent judgment basis | **WORKING LABEL вЂ” NON-NORMATIVE:** attestation_is_not_correctness | source validity unchanged | no promoted judgment | deferred | future seam |
| `locally_valid_not_admitted` | local recomputation succeeds | local validity becomes admitted | remove gate evidence or admission bridge | **WORKING LABEL вЂ” NON-NORMATIVE:** local_validity_is_not_admission | local validity preserved | no admitted-only Chronicle effect | core | Async Decision Write |
| `admitted_not_persisted` | admission outcome exists | admitted becomes persisted | remove write binding or persistence record | **WORKING LABEL вЂ” NON-NORMATIVE:** admission_is_not_persistence | source admission unchanged | no persistence-derived history | core | Async Decision Write |
| `persisted_not_aggregate_comparable` | persisted entries exist | persistence becomes safe aggregate comparability | mix policy/comparability classes without fold rule | **WORKING LABEL вЂ” NON-NORMATIVE:** persistence_is_not_comparability | source entry validity unchanged | aggregate blocked or broken out | extension | aggregate pressure seam |
| `unavailable_not_contradictory` | evidence unavailable | unavailable becomes contradiction | remove evidence without adding mismatch | **WORKING LABEL вЂ” NON-NORMATIVE:** unavailable_is_not_contradictory | source may become unavailable or unresolved, not contradictory by default | no invalidity-only Chronicle effect | core | witness + async-write distinction |
| `not_observed_not_non_occurrence` | no observation recorded | absence becomes non-occurrence | bounded non-observation only, no global negative proof | **WORKING LABEL вЂ” NON-NORMATIVE:** absence_of_observation_is_not_non_occurrence | source validity unchanged | no negative history inference | core | witness coverage logic |
| `same_identity_nonidentical_content_conflict` | same identity reused | same identity becomes update/merge/replacement | mutate canonical content under same identity | **WORKING LABEL вЂ” NON-NORMATIVE:** same_identity_requires_conflict | original source validity unchanged | no silent overwrite in history layer | core | Async Decision Write conflict seam |
| `later_completion_preserves_overdue_history` | overdue interval already proven | later completion erases historical overdue | add later terminal/publication after overdue interval | **WORKING LABEL вЂ” NON-NORMATIVE:** later_completion_preserves_history | source artifact validity unchanged | no historical erasure in downstream interpretation | core | witness correction + blind-diff evidence |
| `equivalent_representation_preserves_semantics` | representation changes under declared equivalence profile | byte difference becomes semantic difference by default | apply an explicit equivalence-preserving transformation profile | **WORKING LABEL вЂ” NON-NORMATIVE:** explicit_equivalence_profile_required | source validity unchanged under declared profile only | Chronicle effect depends on declared profile, not generic byte drift | extension | Git-index byte-pinning discipline |

`equivalent_representation_preserves_semantics` is a positive control, not a negative case. It matters because semantic equivalence does not replace byte identity where the artifact contract is byte-exact. Equivalence can only be evaluated under an explicitly declared transformation profile.

## 11. Relationship to ReceiptOS Verifier Challenge Set v0

This working record and the future ReceiptOS Verifier Challenge Set v0 should remain strictly separate.

### This working record is for

- general semantic coordinates;
- prohibited implicit promotions;
- explicit transition-rule requirements;
- profile structure;
- negative-corpus design principles;
- cross-system seam definitions.

### ReceiptOS Verifier Challenge Set v0 is expected to contain

- deterministic challenge derivation;
- fixed mandatory core;
- equivalence-preserving positive vectors;
- `source_receipt_root`;
- `subject_bundle_root`;
- challenge identifiers;
- conformance-run inputs and outputs;
- conformance findings distinct from receipt reason codes.

Critical boundary:

> Failure of a challenge vector may invalidate a verifier's conformance claim for the tested profile. It does not change the validity of the source receipt.

Additional boundary conditions:

- challenge objects do not enter Chronicle;
- challenge outcomes are not scores;
- challenge outcomes are not ranks;
- challenge outcomes are not certification;
- passing a challenge set does not create a verifier badge or trust tier.

Witness vectors, Chronicle admission fixtures, blind-diff harnesses, and Git-index byte-pinning are precedents for the engineering discipline. They are not already an implementation of ReceiptOS Verifier Challenge Set v0.

## 12. Existing ReceiptOS and Chronicle applications

This section summarizes the strongest concrete precedents already present in the repository. The artifacts named here are existing repository materials. This section's synthesis is non-normative.

- validity versus observation in [`docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`](./EVIDENCE_CAPSULE_SCHEMA_V0.md);
- timing and historical overdue preservation in [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md);
- schema validity versus semantic admission in [`docs/UNANCHORED_ISSUANCE_WITNESS_V0_STATUS.md`](./UNANCHORED_ISSUANCE_WITNESS_V0_STATUS.md);
- local validity, admission, binding, conflict, and persistence in [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md);
- Chronicle history versus scoring, ranking, certification, and reputation in [`docs/CHRONICLE.md`](./CHRONICLE.md) and [`README.md`](../README.md);
- independent blind-diff agreement versus reference-authority status in [`tests/blind-diff/README.md`](../tests/blind-diff/README.md);
- byte-pinned artifacts versus working-tree representation in witness and Chronicle fixture packages, including [`tests/fixtures/receiptos-chronicle-admission-v0/README.md`](../tests/fixtures/receiptos-chronicle-admission-v0/README.md).

These are repository precedents. This document does not convert them into one new normative theory.

## 13. Async decision/write profile

[`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md) is already an active concrete example of the broader non-elevation principle.

It separates:

- `decision_view`;
- `landing_view`;
- recomputation;
- validity;
- admission;
- write binding;
- idempotency;
- same-identity conflict;
- persistence.

In simplified terms:

- `decision_view` is the original decision meaning under recomputation and declared basis;
- `landing_view` is the later write-side outcome, including whether the decision was written, replayed idempotently, or blocked by conflict;
- recomputation remains distinct from any producer-reported or writer-reported state;
- validity remains distinct from admission;
- admission remains distinct from persistence;
- same-identity replay remains distinct from same-identity conflict.

An independently pressure-tested degenerate case also matters here:

A useful pressure-tested degenerate case is when the decision-side view and the landing-side view resolve to the same underlying committed artifact state. In that case, the asynchronous boundary collapses into the synchronous case without needing a separate semantic branch.

That collapse is acceptable because it is a degenerate case of the same seam, not a new semantic rule.

This working record does not modify or expand Async Decision Write v0.

## 14. Aggregate/read-side seam

*Research seam identified through external pressure testing; not yet a normative repository contract.*

Central coordinate:

> Individually valid or admitted entries do not automatically become one comparable aggregate judgment.

Minimum candidate fold contract:

- exact inclusion set;
- entry identity for every item;
- pinned policy or comparability class per entry;
- admission outcome per entry;
- preservation of flagged, pending, unavailable, or unresolved states;
- explicit comparability rule;
- independently recomputable fold rule;
- pre-aggregation breakdown;
- aggregate output identity;
- no silent dropping of incompatible classes.

Prohibited automatic elevations:

- included -> comparable;
- admitted -> mutually comparable;
- persisted -> safe to aggregate;
- majority agreement -> truth;
- absence of conflict -> semantic equivalence;
- mixed-policy entries -> policy-neutral judgment.

This seam belongs initially in the working record and later merits a separate read-side or aggregate profile. It should not be folded into Async Decision Write v0.

## 15. Deferred derivative tracks

### 15.1 Temporal admissibility and non-retroactive revocation

Working name:

`TEMPORAL_ADMISSIBILITY_AND_REVOCATION_V0`

Invariant:

Later revocation or policy change may affect present use without rewriting historical admissibility under the pinned earlier view.

- dependency on this working record: high;
- likely dependency on the future Challenge Set: yes;
- current status: backlog;
- premature design mistake to avoid: treating current revocation as retrospective mutation of historical fact.

### 15.2 Witnessed Receipt Expectation

Working object:

`witnessed_receipt_expectation.v0`

Invariant:

A declared expectation is evidence that an output was expected; it is not evidence that it occurred, and absence is not proof of non-occurrence.

- dependency on this working record: high;
- likely dependency on the future Challenge Set: yes;
- current status: backlog;
- premature design mistake to avoid: turning unmet expectation into contradiction by default.

### 15.3 Coverage-bounded evidence of non-occurrence

Invariant:

Not found within declared coverage does not mean never occurred.

- dependency on this working record: high;
- likely dependency on the future Challenge Set: yes;
- current status: backlog;
- premature design mistake to avoid: claiming global non-occurrence from bounded search coverage.

### 15.4 Cross-system Action Closure

Chain:

`authorization -> decision -> execution -> observation -> settlement -> history`

Invariant:

Every closed transition requires explicit evidence. An open transition remains open rather than being inferred from a neighboring state.

- dependency on this working record: high;
- likely dependency on the future Challenge Set: yes;
- current status: backlog;
- premature design mistake to avoid: modeling neighboring states as automatic implications.

## 16. Non-goals

This working record explicitly rejects the following:

- scores;
- rankings;
- reputation;
- certification;
- verifier badges;
- trust tiers;
- a universal ontology of all states;
- one global state machine;
- implicit promotion by signature;
- implicit promotion by TEE or attestation;
- silent cross-policy aggregation;
- retrospective rewriting of historical facts;
- treating unavailable evidence as contradictory;
- treating absence of observation as non-occurrence;
- production evaluator claims;
- normative reason-code allocation;
- modification of source receipt validity by a conformance challenge.

## 17. Open questions

This section records open questions without answering them prematurely.

1. How is transition authority identified across independent systems?
2. Do profiles require their own deterministic identity?
3. How are positive equivalence controls declared?
4. How are unexercised symmetric branches recorded?
5. How are aggregate comparability classes represented?
6. How do challenge findings remain separate from receipt reason codes?
7. How do staged research labels become frozen vocabulary, if ever?
8. Does every coordinate need two independent implementations before promotion?

## 18. Promotion criteria

Promotion toward a future normative profile would require at least:

- two independent implementations;
- frozen negative and positive corpus;
- independently reproducible identities;
- explicit class-preservation tests;
- a cross-platform runner;
- preservation of source receipt validity;
- reviewed transition authority and evidence requirements;
- documented unexercised branches;
- preserved historical disagreement;
- a clear separation between verifier conformance and artifact validity;
- no scoring, ranking, certification, or reputation semantics.
