# ReceiptOS Verifier Challenge Set v0 — Working Design Draft

> Status: Non-normative working design draft
> Author: Pavlo Tvardovskyi
> Repository: pipavlo82/crystal-receipt
> Date: 2026-07-27

This is not a ReceiptOS specification.

This does not define current verifier conformance.

This does not certify verifiers.

This does not allocate normative ReceiptOS reason codes.

This does not change source receipt validity.

This does not create Chronicle history.

No vector bytes or identities are frozen by this document.

This working draft is grounded in the repository's existing seam and proof-boundary materials, especially:

- [`docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`](./EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md)
- [`docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`](./EVIDENCE_CAPSULE_SCHEMA_V0.md)
- [`docs/ASYNC_DECISION_WRITE_V0.md`](./ASYNC_DECISION_WRITE_V0.md)
- [`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`](./UNANCHORED_ISSUANCE_WITNESS_V0.md)
- [`tests/blind-diff/README.md`](../tests/blind-diff/README.md)
- [`tests/fixtures/receiptos-chronicle-admission-v0/README.md`](../tests/fixtures/receiptos-chronicle-admission-v0/README.md)

## 1. Status and scope

This document is a non-normative design draft for a future ReceiptOS Verifier Challenge Set v0.

Its purpose is to define the intended boundary, object model, and challenge logic for a future executable corpus that evaluates verifier behavior against seam-sensitive challenge inputs. It does not freeze schemas, bytes, vectors, manifests, or conformance claims yet.

The draft stays separate from the existing working research record on semantic non-elevation. That working record describes reusable seam coordinates and transition rules. This draft describes the future challenge mechanism that may operationalize some of those seams.

## 2. Problem statement

ReceiptOS already distinguishes several semantic layers that can be checked independently:

- source evidence and receipt validity;
- observation versus recomputation;
- local validity versus admission;
- admission versus persistence;
- history versus score, rank, certification, or reputation.

What the repository does not yet have is a dedicated challenge layer that tests whether a verifier preserves those seams correctly under controlled mutations, omissions, substitutions, ordering changes, environment/composition variation, and equivalence-preserving transformations.

The design problem is therefore not how to recompute source receipts again in the abstract. It is how to evaluate verifier behavior without rewriting the source artifact's meaning. A challenge framework should be able to say that a verifier handled a seam incorrectly while leaving the source receipt and its own validity semantics untouched.

## 3. Challenge Set boundary

The intended flow is:

Source Subject  
-> Deterministic Challenge Derivation  
-> Subject Bundle  
-> Verifier Conformance Run  
-> Challenge Findings

The core boundary is this:

A challenge result evaluates the verifier's behavior under a declared profile.

It does not mutate:

- the source receipt;
- the source receipt's validity;
- the source evidence;
- the original ReceiptOS verdict;
- Chronicle history.

A failed challenge may count against the verifier's claimed conformance for the tested profile only.

It is not:

- a receipt-invalidity result;
- a score;
- a rank;
- a certificate;
- a verifier badge;
- a trust tier;
- a reputation signal.

## 4. Source subject and immutable validity

A source subject is the exact artifact or bundle being challenged.

The source subject may be:

- a single receipt;
- a proof object;
- a witness-bound artifact;
- a bundle of related artifacts whose identity is already fixed by declared repository rules.

Candidate source-subject fields, explicitly non-normative and non-frozen, include:

- `challenge_set_version`
- `profile_id`
- `source_subject_type`
- `source_receipt_root`
- `source_artifact_refs`
- `source_ruleset_ref`
- `source_validity_snapshot`
- `source_validity_view`

The source validity snapshot is recorded for comparison and must not be rewritten by challenge results.

This draft does not freeze a schema for these fields. It only marks the intended design boundary: challenge runs test verifier behavior against a source subject whose upstream semantic identity remains intact.

## 5. Challenge derivation model

Every challenge is intended to be derived from:

- exact source subject identity;
- challenge identifier;
- challenge profile version;
- deterministic mutation parameters;
- canonical derivation procedure.

A challenge must declare whether it is a:

- negative mutation;
- omission case;
- substitution case;
- ordering case;
- equivalence-preserving positive control;
- environment/composition case.

The derivation must be independently reproducible.

Random or model-generated mutation output cannot be mandatory unless the randomness or generation basis is fully pinned.

The same source subject, challenge identifier, and derivation parameters should therefore produce the same challenge object and the same challenge identity.

This draft does not yet freeze the derivation algorithm or the canonical byte layout.

## 6. Mandatory core and extensions

This section records only the design distinction between a candidate mandatory core and candidate extensions.

Candidate core membership means the seam appears strong enough, common enough, and repository-grounded enough to belong in the first future frozen challenge package.

Extension membership means the seam is still relevant, but it depends more heavily on domain-specific transition definitions, future captured artifacts, or later repository profiles.

Core membership is not frozen.

Extension membership is not a downgrade in importance. It only means the seam is not yet mature enough for the first future mandatory package.

## 7. Positive controls

A future challenge set should not contain only negative cases.

Positive controls are needed to show that a verifier can preserve semantics when the input transformation is explicitly declared to be equivalence-preserving. This matters especially where byte identity is strict for artifact integrity, but semantic equivalence may still be tested under a separately declared transformation profile.

Positive controls test false rejection, not semantic promotion.

Equivalence applies only under a declared transformation profile.

Semantic equivalence does not replace byte identity where the artifact contract is byte-exact.

Examples of candidate equivalence-preserving transformations include:

- key-order normalization where canonicalization permits it;
- line-ending differences before canonical Git-object extraction;
- transport wrapper differences excluded from semantic identity;
- byte-identical replay;
- declared representation transformations.

## 8. Challenge object model

A future challenge object should remain distinct from the source subject.

Candidate fields, described without freezing a schema, include:

- `challenge_id`
- `profile_id`
- `challenge_kind`
- `source_receipt_root`
- `source_artifact_ref`
- `mutation_description`
- `mutation_parameters`
- `derived_subject`
- `expected_semantic_boundary`
- `expected_conformance_observation`
- `source_validity_effect`
- `chronicle_effect`
- `control_class`
- `unexercised_branches`

If a future challenge entry introduces a finding-like label, that label should be marked as:

`WORKING LABEL — NON-NORMATIVE`

These names are design placeholders only. They are not current ReceiptOS schema fields.

The important boundary is conceptual: the challenge object is a derived evaluator input, not a replacement for the source artifact.

## 9. Subject bundle identity

A future challenge set will likely need a subject-bundle identity distinct from the original source receipt identity.

Candidate identity:

- `subject_bundle_root`

The bundle should bind only deterministic challenge inputs and derived challenge subjects.

Candidate inclusion includes:

- challenge-set version;
- profile identifier;
- source receipt root;
- sorted challenge object identities;
- declared canonicalization profile.

The identity should explicitly exclude:

- run timestamps;
- verifier name;
- execution duration;
- scores;
- UI metadata;
- mutable observations;
- Chronicle identifiers;
- generated commentary.

This design draft expects a future `subject_bundle_root` or equivalent identity, but does not freeze the root formula yet.

## 10. Conformance run model

A future verifier conformance run is expected to accept a challenge object or subject bundle and produce a run result.

A future run object would likely contain:

- challenge-set identity;
- subject bundle identity;
- verifier implementation identity;
- verifier configuration identity;
- runtime environment identity;
- per-challenge observations;
- unexpected errors;
- unexecuted challenges;
- reproducibility metadata;
- final run completion state.

A run may report:

- completed;
- incomplete;
- environment failure;
- unexpected verifier behavior;
- expected boundary preserved;
- expected boundary violated.

These are research categories, not normative enums.

The conformance run is therefore a separate evaluation layer. It is not an override of the source verifier result, and it is not a substitute for source receipt verification.

## 11. Findings versus ReceiptOS reason codes

The boundary here is strict.

- receipt reason codes explain artifact verification or admission;
- challenge findings explain verifier behavior under a challenge;
- challenge findings should not be reused as receipt-invalidity codes unless semantics are exactly identical;
- failed verifier conformance should not rewrite the receipt's reason code;
- a second competing ReceiptOS vocabulary should not be created casually.

This separation matters because a challenge failure may indicate that a verifier handled a seam incorrectly even while the source artifact remains valid, invalid, unavailable, or admitted exactly as before.

This draft therefore does not allocate challenge findings as ReceiptOS reason codes, and it does not imply that future challenge findings should reuse existing reason-code enums directly.

## 12. Verifier failure semantics

A verifier failure inside the future challenge set should be interpreted narrowly.

It may show that:

- the verifier collapsed one dimension into another;
- the verifier trusted a reported state rather than recomputing;
- the verifier treated unavailable evidence as contradictory;
- the verifier silently promoted local validity into admission;
- the verifier silently promoted admission into persistence;
- the verifier failed to preserve historical facts under later state changes;
- the verifier treated conflicting same-identity content as an update rather than a conflict.

Such a failure is about the verifier's conformance claim for the tested profile.

It does not rewrite the source artifact's own validity.

## 13. Chronicle exclusion

Challenge objects do not enter Chronicle.

Challenge findings do not become Chronicle entries.

Verifier failures do not rewrite existing Chronicle history.

A later separate provenance artifact may record that a conformance run occurred, but that would require its own gate and remains outside this draft.

## 14. Determinism and byte identity

Determinism is central to the future challenge set.

The challenge system should eventually provide:

- raw Git/index or package-byte identities;
- canonical source subject identity;
- deterministic challenge derivation;
- sorted challenge references;
- manifest pinning;
- cross-platform runner;
- LF/CRLF-safe hashing;
- no hidden network dependency for frozen replay;
- explicit documentation of live-environment vectors.

This draft also separates three future vector families:

- frozen offline vectors;
- externally captured live vectors;
- environment-dependent demonstrations.

A saved capture file alone is not treated here as sufficient reproducible evidence unless the surrounding derivation, identity, and environment assumptions are also declared.

At the same time, this design draft does not freeze any vector bytes or challenge identities yet.

The repository's existing byte-pinning discipline is relevant here, especially around Git-index-byte verification and manifest-bound artifact integrity. But this draft does not define a manifest or package format for the future challenge set.

### 14.1 Normative `audit_timestamp` metadata boundary

The following repository boundary is normative for any Counterfactual artifact
or review manifest that permits an `audit_timestamp`, even though this document
does not otherwise freeze a challenge schema, manifest format, or identity
formula:

`audit_timestamp` is non-semantic audit metadata.

It MUST be outside the semantic artifact object. It MUST NOT participate in
canonical semantic bytes, artifact identity, digest or external-reference
derivation, equality or conformance comparison, mutation semantics,
challenge-set semantics, or verifier-profile semantics. Its presence, absence,
or value MUST NOT change the semantic artifact reference or conformance result
of the artifact it accompanies.

A validator MUST reject, before any future profile-defined canonicalization,
any semantic artifact object that contains a property named `audit_timestamp`
at any depth. It MUST NOT silently strip that property from an object already
presented as semantic input. Enforcement constructs a fresh strict-JSON
snapshot by descriptor inspection, deterministic key traversal, and exactly
one capture of each accepted data-property value. No downstream operation may
reread the caller-owned input. Review or packaging tooling keeps the enclosing
manifest and its audit metadata outside the semantic snapshot.

This exclusion does not make timestamp-bearing manifest files byte-stable. If
the serialized bytes of a review or packaging manifest include
`audit_timestamp`, those exact file bytes include its key and value. Changing or
removing it may therefore change that manifest file's byte hash and any package
inventory entry that honestly hashes the file. Such a byte-hash change does not
change the semantic identity of the artifact described by the manifest.

The reusable enforcement helpers are
`snapshotCounterfactualSemanticJson` and
`computeCounterfactualManifestFileSha256` in
`src/receiptos/challenge/counterfactual-audit-boundary.ts`. A manifest string is
encoded as UTF-8 exactly once before file-byte hashing; a `Uint8Array` is hashed
as the exact supplied bytes.

This repository rule freezes only the reserved-field exclusion boundary, the
strict JSON snapshot boundary used to enforce that exclusion, and the exact
raw manifest-byte hashing rule. It does not define or freeze challenge
canonicalization, semantic artifact identity, `subject_bundle_root`,
verifier-profile identity, or challenge-set identity. Any digest used only by
tests to witness the exclusion behavior is non-normative execution evidence,
not a Counterfactual artifact reference.

## 15. Initial challenge registry

The future challenge set is likely to begin with a small registry aligned with the strongest current seams in the repository.

### Candidate mandatory core

#### `observed_not_validated`
- source facts: observation exists without independent recomputation;
- controlled mutation or omission: preserve observed state while removing recomputed validation basis;
- prohibited elevation: observed -> valid;
- expected verifier behavior: preserve observation while refusing semantic promotion;
- source validity effect: source validity remains unchanged until recomputed;
- Chronicle effect: no Chronicle inclusion from observation alone;
- current repository precedent: `docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`, `docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`.

#### `timing_not_validity`
- source facts: timing state such as late, overdue, pending, or stale;
- controlled mutation or omission: preserve timing facts without contradictory validity evidence;
- prohibited elevation: timing -> validity or invalidity by itself;
- expected verifier behavior: preserve timing as its own dimension;
- source validity effect: source validity remains separately evaluated;
- Chronicle effect: no timing-only inclusion or rejection semantics;
- current repository precedent: `docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`, witness vectors.

#### `source_report_not_recomputed_result`
- source facts: producer or source verifier report exists;
- controlled mutation or omission: preserve report while removing independent recomputation basis;
- prohibited elevation: source report -> recomputed verifier result;
- expected verifier behavior: report remains evidence, not truth;
- source validity effect: source validity is not established by the report alone;
- Chronicle effect: no Chronicle admission from report alone;
- current repository precedent: `docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`, `README.md`.

#### `locally_valid_not_admitted`
- source facts: local recomputation succeeds;
- controlled mutation or omission: remove or withhold gate evidence required for admission;
- prohibited elevation: local validity -> admission;
- expected verifier behavior: preserve local validity while withholding admitted state;
- source validity effect: source validity unchanged;
- Chronicle effect: no admission-only inclusion;
- current repository precedent: `docs/ASYNC_DECISION_WRITE_V0.md`, `docs/CHRONICLE.md`.

#### `admitted_not_persisted`
- source facts: admission outcome exists;
- controlled mutation or omission: remove write binding or persistence evidence;
- prohibited elevation: admission -> persistence;
- expected verifier behavior: preserve admitted state while withholding written state;
- source validity effect: source admission unchanged;
- Chronicle effect: no persistence-derived history claim;
- current repository precedent: `docs/ASYNC_DECISION_WRITE_V0.md`.

#### `unavailable_not_contradictory`
- source facts: challenge-relevant evidence is unavailable;
- controlled mutation or omission: omit evidence without introducing contradictory evidence;
- prohibited elevation: unavailability -> contradiction;
- expected verifier behavior: preserve absence as unavailable or unresolved rather than contradictory;
- source validity effect: source validity remains distinct from contradiction;
- Chronicle effect: no contradiction-only admission outcome;
- current repository precedent: `docs/ASYNC_DECISION_WRITE_V0.md`, `docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`.

#### `not_observed_not_non_occurrence`
- source facts: no observation has been made;
- controlled mutation or omission: preserve bounded non-observation without global negative proof;
- prohibited elevation: not observed -> non-occurrence;
- expected verifier behavior: preserve the seam unless explicit coverage proof closes it;
- source validity effect: source validity unchanged;
- Chronicle effect: no negative history inference;
- current repository precedent: witness timing and coverage logic.

#### `same_identity_nonidentical_content_conflict`
- source facts: same identity reused for non-identical canonical content;
- controlled mutation or omission: substitute non-identical content under the same identity;
- prohibited elevation: same identity -> update, merge, or replacement;
- expected verifier behavior: preserve explicit conflict;
- source validity effect: source artifact validity unchanged; write-side seam fails;
- Chronicle effect: no silent overwrite or replacement in downstream history;
- current repository precedent: `docs/ASYNC_DECISION_WRITE_V0.md`.

#### `later_completion_preserves_overdue_history`
- source facts: historical overdue interval already proven, later completion observed;
- controlled mutation or omission: add late completion after preserved overdue interval;
- prohibited elevation: later timing state -> erasure of historical overdue finding;
- expected verifier behavior: preserve both historical overdue and later late state;
- source validity effect: source validity unchanged;
- Chronicle effect: no retrospective history rewrite;
- current repository precedent: `docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`, `tests/blind-diff/README.md`.

#### `signed_not_promoted`
- source facts: signature exists on the source artifact;
- controlled mutation or omission: preserve signature while withholding any separate evidence-class promotion rule;
- prohibited elevation: signature -> higher evidence class;
- expected verifier behavior: treat signature as one fact, not a semantic promotion;
- source validity effect: source validity unchanged unless other proof basis exists;
- Chronicle effect: no promoted inclusion meaning from signature alone;
- current repository precedent: proof-first and recomputation framing across `README.md` and `docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`.

### Candidate extensions

#### `authorized_not_executed`
- source facts: authorization evidence exists;
- controlled mutation or omission: preserve authorization while withholding execution evidence;
- prohibited elevation: authorization -> execution;
- expected verifier behavior: preserve the seam rather than inferring execution;
- source validity effect: source validity unchanged;
- Chronicle effect: no execution-derived history effect;
- current repository precedent: conceptual execution pipeline in `README.md`.

#### `executed_not_settled`
- source facts: execution evidence exists;
- controlled mutation or omission: preserve execution while withholding settlement evidence;
- prohibited elevation: execution -> settlement;
- expected verifier behavior: preserve the seam rather than inferring settlement;
- source validity effect: source validity unchanged;
- Chronicle effect: no settlement-derived historical implication;
- current repository precedent: future seam, not current repository implementation.

#### `settled_not_historically_admitted`
- source facts: settlement claim exists;
- controlled mutation or omission: preserve settlement while withholding historical admission bridge;
- prohibited elevation: settlement -> historical admission;
- expected verifier behavior: preserve the seam rather than inferring historical admission;
- source validity effect: source validity unchanged;
- Chronicle effect: no automatic Chronicle inclusion;
- current repository precedent: future seam, not current repository implementation.

#### `attested_not_judgment_correct`
- source facts: attestation evidence exists;
- controlled mutation or omission: preserve attestation while withholding independent semantic correctness basis;
- prohibited elevation: attestation -> judgment correctness;
- expected verifier behavior: preserve attestation as one claim, not output correctness;
- source validity effect: source validity unchanged;
- Chronicle effect: no promoted history effect from attestation alone;
- current repository precedent: future seam, not current repository implementation.

#### `persisted_not_aggregate_comparable`
- source facts: persisted entries exist;
- controlled mutation or omission: preserve persisted entries while withholding explicit comparability and fold rules;
- prohibited elevation: persistence -> aggregate comparability;
- expected verifier behavior: preserve breakdown rather than infer a safe aggregate judgment;
- source validity effect: source validity unchanged;
- Chronicle effect: no policy-neutral aggregate conclusion;
- current repository precedent: downstream aggregate seam identified in the non-elevation working record.

#### `equivalent_representation_preserves_semantics`
- source facts: declared representation transformation preserves semantics under an explicit transformation profile;
- controlled mutation or omission: apply only the declared equivalence-preserving transformation;
- prohibited elevation: byte difference -> semantic difference by default;
- expected verifier behavior: preserve semantics under the declared profile while still respecting byte-exact artifact contracts where they apply;
- source validity effect: source validity unchanged under the declared profile;
- Chronicle effect: no Chronicle effect unless a separate history rule applies;
- current repository precedent: Git-index byte-pinning discipline and explicit separation between semantic equivalence and byte identity.

This is a positive control even though its registry placement remains an extension.

## 16. TEE ⊕ recompute profile

This section records the first planned composition case rather than a current repository contract.

TEE attests execution.
Independent recomputation judges correctness.

The prohibited elevation is:

valid TEE attestation  
-≯  
correct model output or correct semantic judgment

A future real capture should preserve:

- exact request bytes;
- exact response bytes;
- raw TEE or dstack attestation evidence;
- independent attestation verification result;
- provider identifier;
- model identifier;
- SDK package and exact version;
- dependency-lock identity;
- runtime chain ID from `eth_chainId`;
- ledger transaction or reference;
- SHA-256 identities of captured raw artifacts.

It should explicitly exclude:

- private keys;
- auth tokens;
- wallet signing material;
- session secrets.

`teeml-sample.json` is an external pending capture and is not yet part of the repository or any frozen challenge corpus.

This draft does not imply that 0G, dstack, Merlini, Fede, or Baby Blue Viper endorse the complete Challenge Set design.

## 17. Security and privacy boundaries

A future challenge set would need its own security and privacy boundary review.

The future corpus should preserve at least these exclusions and boundaries:

- no secrets in fixtures;
- no wallet material;
- no live credentials;
- no unredacted provider tokens;
- no hidden remote fetch in frozen runners;
- no provider response treated as trusted merely because it was captured;
- no source receipt mutation;
- no automatic Chronicle inclusion;
- no challenge result used as score or reputation;
- no treating TEE attestation as output correctness;
- no treating successful challenge execution as global verifier correctness.

This draft does not answer those questions yet. It only marks them as necessary design boundaries.

## 18. Non-goals

This design draft is not trying to do the following:

- define a current ReceiptOS verifier conformance standard;
- freeze challenge schemas;
- freeze vector bytes;
- freeze challenge identities;
- allocate reason-code enums;
- mutate source receipt validity;
- create Chronicle objects;
- produce scores;
- produce ranks;
- produce certificates;
- produce verifier badges;
- produce trust tiers;
- create a global reputation system;
- treat blind-diff harnesses as the already completed challenge set;
- make production claims;
- make reference implementation claims;
- treat positive controls as semantic license to ignore byte-identity contracts.

## 19. Open questions

Open questions for later work include:

1. What is the exact `subject_bundle_root` formula?
2. How should challenge objects be canonicalized?
3. Should source-validity snapshots be embedded or referenced?
4. How should finding-vocabulary governance work?
5. What level of implementation identity is required?
6. What is the policy for replaying live vectors?
7. How portable can TEE attestation verification become across environments?
8. How should positive-control equivalence profiles be declared?
9. Does the mandatory core require two independent verifier implementations before promotion?
10. Can a challenge-set version add vectors without changing identity semantics?
11. How should partial runs be represented without scoring?

## 20. Promotion criteria

A future normative profile or frozen challenge package should only emerge after several gates are met.

At minimum, that future promotion would likely need:

- two independent verifier implementations;
- frozen mandatory negative core;
- frozen positive controls;
- deterministic bundle identity;
- cross-platform runner;
- independently recomputable artifact identities;
- explicit source-validity preservation tests;
- explicit Chronicle exclusion tests;
- no scores, ranks, certification, badges, or trust tiers;
- documented environment-dependent vectors;
- reviewed finding vocabulary;
- preserved disagreement and unexpected outputs.

Until those conditions are met, the safer posture is to keep this artifact as a non-normative working design draft.
