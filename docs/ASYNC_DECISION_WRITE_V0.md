# Async Decision Write v0

## 1. Status and scope

Async Decision Write v0 defines the protocol boundary for recording a decision when parsing, evidence resolution, independent recomputation, admission, observation, and persistence may occur at different times.

This document is **normative**.

This document is **documentation-only** in the current repository state. It defines required semantics and evaluation order for a future async write boundary. It does **not** claim that a dedicated Async Decision Write wire artifact, schema field set, enum set, result object, persistence layer, or implementation entrypoint already exists in this repository.

This document composes with the existing Chronicle admission seam represented by `receiptos-chronicle-admission-v0`. It does **not** modify or reinterpret:

- `chronicle_entry.v0`
- `receiptos.portable_proof_object.v0`
- `receiptos.evidence_capsule.v0`
- `receiptos.provenance_summary.v0`
- the `receiptos-chronicle-admission-v0` fixture package
- existing schema ids, vectors, manifests, or expected outcomes

This layer defines gates and protocol conformance for recording a decision asynchronously. It does **not** define scores, reputation, legal findings, ownership, certification, settlement, or completeness claims beyond what the referenced profile independently proves.

## 2. Problem statement

The current repository already defines a strict Chronicle admission seam:

`original evidence + portable proof object -> independent receipt-root recomputation -> consistency and identity checks -> chronicle_entry.v0 or deterministic rejection`.

That seam is synchronous in meaning even when the surrounding system is operationally asynchronous. In practice, however, the following may happen at different times:

- the original decision is produced;
- the referenced evidence becomes available;
- the receipt root is independently recomputed;
- admission under a declared profile is evaluated;
- external observation or liveness evidence becomes available;
- a writer attempts to persist a decision record;
- the same write is replayed later;
- a later write attempts to bind the same identity to different content.

Without a pinned async write boundary, implementations risk collapsing distinct semantic dimensions into one another. The repository already rejects that collapse elsewhere. In particular:

- malformed input is not the same as cryptographic mismatch;
- unavailable evidence is not the same as disagreement;
- `unverifiable` is not a weaker form of `invalid`;
- timing or observation states must not rewrite historical validity;
- producer-reported verifier state is evidence, not truth.

Async Decision Write v0 exists to preserve those distinctions when a decision is recorded later, replayed later, or observed later.

## 3. Normative invariants

The following invariants are normative.

1. **Normative evaluation order is load-bearing.** An implementation MUST evaluate Async Decision Write v0 in the following order:
   1. parse and establish structural conformance;
   2. resolve the original decision material and referenced evidence;
   3. independently recompute the receipt root and required admission checks under the declared profile;
   4. derive or verify decision identity;
   5. evaluate admission without collapsing timing or observation into validity;
   6. derive or verify the canonical write binding;
   7. inspect prior persisted writes under that identity;
   8. return idempotently for byte-equivalent canonical content;
   9. fail closed for non-identical content bound to the same identity;
   10. persist only after all required gates pass;
   11. return a result that distinguishes recomputed facts, observed facts, reported facts, timing state, admission state, and persistence state.

2. **Malformed input MUST remain distinct from cryptographically invalid or semantically rejected input.**

3. **Missing evidence MUST remain distinct from contradictory evidence.**

4. **A timing or observation state MUST NOT collapse into a validity state.**

5. **“Not yet written,” “not yet observed,” and “not yet admitted” MUST NOT be interpreted as invalid.**

6. **A gate action such as “not admitted” or “rejected from this write path” MUST NOT silently become a receipt-validity verdict.**

7. **A valid local decision MUST NOT automatically promote missing external admission evidence into an admitted state.**

8. **Admission MUST be independently recomputable from the referenced original evidence and the declared admission profile.**

9. **Producer-reported, writer-reported, or previously stored verifier state MUST remain evidence and MUST NOT replace independent recomputation.**

10. **Async write MUST NOT alter, upgrade, downgrade, reinterpret, or otherwise change the semantic result of the original decision.**

11. **Async write MAY record later observations about the decision, but those observations MUST remain distinct from the decision result itself.**

12. **Repeated writes of the same canonical decision and the same canonical write binding MUST be idempotent.**

13. **The same identity bound to non-identical canonical decision or write content MUST be treated as an explicit identity conflict, not as an update, merge, refresh, replacement, or silent deduplication.**

14. **Conflicting writes MUST fail closed and expose an explicit deterministic failure classification or reason.**

15. **Absence of external observation MUST be neither compliance nor violation.**

16. **This layer MUST preserve the ReceiptOS principle: “Don’t trust. Recompute.”**

17. **Admission and persistence are separate semantic dimensions.** An admitted decision MAY still be unwritten; a write attempt MAY still be rejected by the write boundary even if the underlying decision is locally valid.

## 4. Relationship to receiptos-chronicle-admission-v0

Async Decision Write v0 composes with the existing `receiptos-chronicle-admission-v0` seam. It does not replace, revise, weaken, or reinterpret that seam.

The existing fixture package is an already pinned artifact. Implementations and future schemas MUST treat the following as immutable inputs to this design:

- `tests/fixtures/receiptos-chronicle-admission-v0/README.md`
- `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json`
- `tests/fixtures/receiptos-chronicle-admission-v0/receiptos-chronicle-admission-vector-v0.schema.json`
- all vectors under `tests/fixtures/receiptos-chronicle-admission-v0/vectors/`
- the package `fixture_set_sha256`

Async Decision Write v0 therefore inherits the existing admission distinctions already represented in this repository:

- `malformed_input`
- `unverifiable`
- `evidence_mismatch`
- `cross_object_inconsistency`
- `reported_state_inconsistency`
- `identity_inconsistency`

It also inherits the existing Chronicle admission reason-code meanings where they already exactly match the same seam, including:

- `evidence_root_missing`
- `evidence_root_mismatch`
- `proof_root_mismatch`
- `capsule_stored_mismatch`
- `capsule_computed_mismatch`
- `capsule_label_inconsistent`
- `verifier_result_inconsistent`
- `proof_object_id_invalid`
- `proof_ref_invalid`

Async Decision Write v0 MUST preserve the distinction among:

- a decision being locally valid or invalid under independent recomputation;
- a decision being admitted or not admitted under a declared gate/profile;
- a decision being written, not yet written, or rejected by a write boundary.

Note: This document does not decide whether a future shared admission v1 replaces `receiptos-chronicle-admission-v0` or runs in parallel. That policy remains unresolved and out of scope.

## 5. Decision identity and referenced inputs

A conformant async writer MUST operate over explicitly referenced original decision material and referenced evidence sufficient for independent recomputation under the declared profile.

At minimum, the write boundary MUST be able to identify:

- the original decision material to be evaluated or recorded;
- the original evidence required for independent recomputation;
- the declared admission profile or equivalent declared evaluation basis;
- the persistence attempt’s own canonical write binding;
- any historical reference point required by the declared profile.

Where the repository already provides canonical identity derivations, implementations MUST reuse them rather than invent parallel identity rules. In particular:

- if the boundary composes through `receipt_root`, that root MUST be independently recomputed from canonicalized, anchor-stripped evidence using the same repository semantics;
- if the boundary composes through `proof_object_id`, that identity MUST remain the canonical derivation from the verified `receipt_root`;
- if the boundary composes through `proof_ref`, that reference MUST remain the canonical derivation from `proof_object_id`.

Where a broader “decision identity” is needed beyond current repository fields, this document defines the semantic requirement only: the identity MUST bind the same original decision meaning under the same declared recomputation basis. This repository does **not** currently expose a canonical dedicated wire field for that broader identity.

A future schema MAY introduce a field name for that identity, but any such field name is non-normative until separately pinned by schema and vectors.

## 6. Observation time, evaluation time, admission time, and write time

Async Decision Write v0 distinguishes at least four times or time scopes:

- **observation time**: when external or local evidence was observed or resolved;
- **evaluation time**: when the implementation independently recomputed the decision and required checks;
- **admission time**: when the declared gate condition was satisfied or classified for the relevant scope;
- **write time**: when a persistence attempt was made or accepted.

These times MUST NOT be assumed equal.

A conformant implementation MUST preserve, at minimum in semantics and result reporting, the distinction between:

- facts independently recomputed at evaluation time;
- facts only observed later;
- facts only reported by a producer or prior writer;
- facts about whether the decision was admitted under the declared profile;
- facts about whether the write attempt was persisted.

If a declared profile requires historical scope, the writer MUST evaluate against that declared scope rather than silently substituting the current state. This follows the same historical discipline already stated elsewhere in the repository for `as_of`-bound evaluation.

Note: This document does not introduce a new canonical repository field for these times. It defines the semantic separation that future wire formats MUST preserve.

## 7. Validity versus timing/observation state

A conformant implementation MUST keep validity semantics orthogonal to timing and observation semantics.

Specifically:

- `pending` is a timing state;
- `unavailable` is an evidence-access or observation state;
- `stale` is a statement about evaluation or observation relative to a declared reference point;
- `superseded` is a relationship between decision records;
- `rejected` identifies rejection by a specific gate or procedure;
- none of the above is an unqualified synonym for `invalid`.

A decision MAY be locally valid while observation remains pending.

A decision MAY be locally valid while external evidence required for admission is unavailable.

A decision MAY be not admitted for the current write path without being receipt-invalid.

A decision MAY be admitted and still not yet written.

A later observation MAY change a timing or observation classification without mutating the semantic result of the original decision.

If an implementation stores both verdict-like fields and timing/observation fields, it MUST ensure that a reader can distinguish them without inference from side effects.

## 8. Idempotency and duplicate-write handling

Idempotency is defined over two canonical components together:

- the canonical decision content; and
- the canonical write binding.

If a repeated write presents the same canonical decision content and the same canonical write binding as a previously persisted write under the same identity, the implementation MUST return idempotently.

An idempotent return:

- MUST NOT create a second semantically distinct persisted record;
- MUST NOT reinterpret the original decision;
- MUST preserve the same semantic outcome as the already persisted write;
- MAY report that an equivalent write already exists.

If the same identity is presented with non-identical canonical decision content or non-identical canonical write content, the implementation MUST treat that as an explicit conflict, not as an update.

A conformant implementation MUST NOT silently:

- merge;
- refresh in place;
- replace prior content;
- promote the newer version as authoritative;
- deduplicate unlike content under the same identity.

## 9. Stale, superseded, rejected, pending, and unavailable states

Async Decision Write v0 requires the following semantic distinctions.

### 9.1 Stale

`stale` is a statement about evaluation or observation relative to a declared reference point.

A stale result means the evaluation or observation basis is no longer the declared current reference point for the question being asked. It does **not** by itself mean the earlier decision was invalid when made.

A stale classification MUST identify the reference point against which staleness is determined.

### 9.2 Superseded

`superseded` is a relationship between decision records.

A later decision record MAY supersede an earlier decision record for a later workflow question. That relationship MUST NOT retroactively mutate the historical validity of the earlier decision.

A superseded record therefore remains historically what it was when independently evaluated under its own declared basis.

### 9.3 Rejected

`rejected` identifies what gate or procedure rejected the input.

A conformant implementation MUST be able to distinguish at least:

- rejected because input was malformed;
- rejected because required evidence was unavailable;
- rejected because independent recomputation found contradiction or mismatch;
- rejected because admission did not pass;
- rejected because write identity conflicted with already persisted non-identical content.

`rejected` MUST NOT be used as an unqualified synonym for `invalid`.

### 9.4 Pending

`pending` is a timing state.

It means the relevant event, observation, or gate result has not yet occurred or has not yet been established. It MUST NOT be promoted to `invalid` merely because the state is incomplete.

### 9.5 Unavailable

`unavailable` is an evidence-access or observation state.

It means required evidence or observation was not available for evaluation at the relevant point. It MUST remain distinct from contradiction or mismatch.

### 9.6 Transition discipline

None of these states MAY be promoted into another semantic dimension without an explicit independently evaluable transition rule.

## 10. Fail-closed behavior

Async Decision Write v0 is fail-closed.

A conformant implementation MUST refuse persistence when any required prerequisite for the claimed write outcome is not satisfied.

At minimum, the implementation MUST fail closed when:

- input is malformed for the claimed write path;
- referenced decision material cannot be resolved;
- referenced evidence required for recomputation cannot be resolved;
- independent recomputation contradicts stored or reported receipt-root claims required by the path;
- required admission checks cannot be satisfied for the claimed admitted-write path;
- the write identity conflicts with already persisted non-identical canonical content.

Fail-closed behavior MUST still preserve semantic distinctions. In particular:

- malformed is not the same as mismatch;
- unavailable is not the same as invalid;
- not admitted is not the same as receipt invalid;
- write conflict is not the same as recomputation failure.

## 11. Required recomputation by the writer or verifier

The writer or verifier MUST independently recompute the parts of the decision boundary that this repository already treats as load-bearing.

At minimum, when the path depends on ReceiptOS/Chronicle semantics, the writer or verifier MUST independently recompute:

- the `receipt_root` from canonicalized, anchor-stripped evidence;
- any required canonical identity derivations already pinned by the repository, including `proof_object_id` and `proof_ref` when those identities are used;
- any admission checks required by the declared profile;
- any cross-object consistency checks that the claimed write path depends on.

Producer-reported verifier state, writer-reported verifier state, or previously stored verifier state MAY be retained as evidence. None of them MAY replace independent recomputation.

If the implementation cannot perform the recomputation required for the claimed write path, it MUST NOT overstate the result.

## 12. Canonical write procedure

The canonical write procedure for Async Decision Write v0 is normative.

1. **Input parsing and structural conformance.**
   The implementation MUST parse the input and determine whether it is structurally conformant for the claimed write path.

2. **Resolution of referenced evidence and decision material.**
   The implementation MUST resolve the original decision material and all referenced evidence required for independent recomputation under the declared profile.

3. **Independent recomputation under the declared profile.**
   The implementation MUST independently recompute the `receipt_root` and all required admission checks under the declared profile. This step MUST use the repository’s canonicalization and anchor-stripping semantics where ReceiptOS evidence is involved.

4. **Decision-identity derivation or verification.**
   The implementation MUST derive or verify decision identity using the canonical derivations already pinned by the repository where applicable. Where broader decision identity is required beyond current wire fields, the implementation MUST still bind identity to the same canonical decision meaning and declared basis.

5. **Evaluation of admission state.**
   The implementation MUST determine whether the decision is admitted, not admitted, pending, unavailable, stale, superseded, or otherwise classified for the declared profile without collapsing timing or observation into validity.

6. **Write-binding derivation or verification.**
   The implementation MUST derive or verify the canonical write binding.

7. **Prior-write lookup and conflict evaluation.**
   The implementation MUST inspect prior persisted writes under that identity and evaluate any identity or canonical-content conflict.

8. **Idempotent return for an identical canonical write.**
   If prior persisted content under that identity is byte-equivalent in canonical decision content and canonical write binding, the implementation MUST return idempotently.

9. **Fail-closed conflict result for non-identical content under the same identity.**
   If prior persisted content under that identity is not byte-equivalent, the implementation MUST fail closed with an explicit deterministic conflict classification or reason.

10. **Persistence only after all required gates pass.**
    The implementation MUST persist only after all prerequisites for the claimed write path have passed.

11. **Result production without overstatement.**
    The implementation MUST produce a result that preserves the evidence basis and does not overstate what was recomputed, observed, or merely reported.

## 13. Deterministic conflict handling

Conflict handling MUST be deterministic.

For any fixed canonical input set and fixed prior persisted state, repeated evaluation MUST produce the same conflict or non-conflict outcome.

A conflict exists when the same identity is bound to non-identical canonical decision content or non-identical canonical write content.

When conflict exists, the implementation MUST:

- fail closed;
- preserve the already persisted content unchanged; Async Decision Write v0 defines no replacement protocol for conflicting writes under the same identity.
- expose an explicit deterministic conflict classification or reason;
- avoid silent update, merge, replacement, or deduplication.

Note: The current repository does **not** yet define a dedicated async-write conflict reason-code enum or schema. This document therefore defines the semantic requirement only. Schema/code assignment remains future work.

## 14. Reason-code behavior

Async Decision Write v0 MUST reuse an existing reason code only when the current repository semantics exactly match the same condition.

Accordingly:

- existing Chronicle admission reason codes MAY be reused for the same underlying Chronicle admission conditions;
- existing Chronicle admission reason codes MUST NOT be overloaded with new async-write meanings;
- malformed input MUST NOT automatically receive a receipt-level reason code merely because admission failed;
- absence of evidence MUST NOT be relabeled as contradiction;
- write conflict MUST NOT be mislabeled as receipt mismatch unless the underlying condition actually is a receipt mismatch.

Where deterministic async-write conflicts require a future code that does not yet exist in the repository, this document defines the required semantic distinction but does **not** present a new code as implemented.

At minimum, future async-write code assignment will need distinct semantics for:

- same identity + identical canonical content -> idempotent return;
- same identity + non-identical canonical decision content -> explicit conflict;
- same identity + non-identical canonical write binding -> explicit conflict;
- not admitted for this write path without underlying receipt invalidity;
- pending or unavailable observation state that blocks admission without proving invalidity.

These distinctions are normative even where a repository-wide code has not yet been assigned.

## 15. Security and trust boundaries

Async Decision Write v0 inherits the repository’s trust boundary discipline.

Implementations MUST assume:

- producer claims are evidence;
- writer claims are evidence;
- stored verifier state is evidence;
- prior persisted state is evidence about history, not a substitute for recomputation;
- external observation MAY matter for some profiles, but its absence is not self-proving disagreement.

The trust boundary is therefore:

- do not trust reported `receipt_root` alone;
- do not trust reported verifier success alone;
- do not trust a stored admission label alone;
- do not trust a persistence record alone;
- recompute what the profile requires from the original referenced evidence.

If original referenced evidence is unavailable, the implementation MUST not silently upgrade a reported state into an independently established state.

## 16. Conformance requirements

An implementation is conformant to Async Decision Write v0 only if it satisfies all of the following:

1. It preserves the normative evaluation order in section 3 and section 12.
2. It preserves the semantic distinctions in sections 3, 7, 8, 9, 10, and 14.
3. It independently recomputes receipt-root and admission requirements instead of trusting reported state.
4. It treats identical replay as idempotent return.
5. It treats same-identity/non-identical-content as explicit fail-closed conflict.
6. It does not mutate the semantic result of the original decision when recording later observations or later writes.
7. It does not claim implementation support for wire fields, enums, or result objects that are not actually pinned in schema and vectors.
8. It remains compatible with the current `receiptos-chronicle-admission-v0` artifact package without revising its schema, vectors, expected outcomes, or manifest hash discipline.

A future independent implementation SHOULD be validated against pinned vectors once async-write schemas and vectors exist.

## 17. Non-goals

Async Decision Write v0 does **not** define:

- a score or ranking system;
- reputation aggregation;
- ownership resolution;
- legal adjudication;
- certification;
- settlement;
- completeness claims not independently proven by the declared profile;
- mutation of Chronicle v0 artifact semantics;
- a replacement policy for `receiptos-chronicle-admission-v0`;
- a deployed write-service API;
- a canonical repository-wide async-write storage schema;
- permission to persist unlike content under one identity as an update.

## 18. Minimal normative examples

These examples are semantic and non-exhaustive. They do not define new wire fields.

### 18.1 Clean recompute, admitted, first write

- Original evidence resolves.
- `receipt_root` independently recomputes.
- Declared admission checks pass.
- Decision identity and canonical write binding verify.
- No prior persisted write exists under that identity.

Result:

- underlying decision validity MAY be classified as valid if the declared profile so concludes;
- the decision is admitted under the declared profile;
- the write is accepted for persistence;
- the write is persisted.

### 18.2 Clean recompute, identical replay later

- Original evidence resolves.
- Recomputed decision meaning and canonical write binding are byte-equivalent to an already persisted write under the same identity.

Result:

- the return MUST be idempotent;
- the implementation MUST NOT create a semantically distinct second write;
- the original decision meaning MUST remain unchanged.

### 18.3 Missing required evidence

- Original decision material is present.
- Required referenced evidence for independent recomputation is unavailable.

Result:

- this is unavailable or unverifiable, depending on the declared profile semantics;
- this MUST NOT be labeled contradictory or invalid merely because evaluation could not complete;
- persistence for a path requiring that recomputation MUST fail closed.

### 18.4 Stored or reported state contradicts recomputation

- A producer-reported or stored `receipt_root` claim disagrees with independent recomputation.

Result:

- contradiction or mismatch is established;
- this MUST remain distinct from malformed input and from missing evidence;
- persistence for any path depending on successful recomputation MUST fail closed.

### 18.5 Valid local decision but external admission evidence not yet observed

- Local recomputation succeeds.
- Required external admission evidence is not yet observed or is unavailable at the declared scope.

Result:

- the local decision MAY remain locally valid;
- admission MUST remain not yet admitted, pending, unavailable, or unverifiable according to the declared profile;
- the implementation MUST NOT silently promote the decision into admitted.

### 18.6 Same identity, different canonical content

- A prior persisted write already exists under the same identity.
- The newly presented canonical decision content or canonical write binding is not byte-equivalent.

Result:

- explicit fail-closed conflict;
- no silent update or merge;
- no reinterpretation of the original persisted decision.

## 19. Future implementation and test obligations

The following work is required before Async Decision Write v0 can be claimed as implemented rather than specified.

### 19.1 Schema obligations

Future work MUST pin dedicated schema artifacts for at least:

- an async decision write input boundary, or equivalent canonical write request artifact;
- an async decision write result boundary that preserves the semantic distinctions required here;
- a canonical persisted-write identity or binding artifact if the design chooses an explicit object boundary;
- deterministic conflict result representation;
- any explicit time/reference scope object required for historical evaluation.

Any future field names for decision identity, write identity, timing-state reporting, or persistence-state reporting are non-normative until pinned by schema.

### 19.2 Reason-code obligations

Future work MUST assign repository-wide deterministic codes for async-write-specific conflicts and gate outcomes that are not already covered by existing Chronicle admission codes.

Those future codes MUST preserve distinct meanings for at least:

- malformed input;
- unavailable or unverifiable required evidence;
- contradictory recomputation evidence;
- not admitted for the current write path;
- idempotent replay;
- same-identity/non-identical-content conflict.

### 19.3 Vector obligations

Future work MUST pin normative vectors for at least:

- clean admitted first write;
- identical replay idempotent return;
- missing evidence distinct from contradictory evidence;
- valid local decision but admission pending/unavailable;
- same identity with different canonical decision content;
- same identity with different canonical write binding;
- stale evaluation distinct from invalidity;
- superseded decision record distinct from retroactive invalidity;
- malformed input distinct from cryptographic mismatch;
- producer-reported success contradicted by independent recomputation.

Vectors MUST test exact deterministic classification and MUST ensure that timing/observation states are not collapsed into validity or persistence states.

### 19.4 Implementation obligations

Future code MUST:

- preserve the evaluation order pinned here;
- reuse existing repository canonicalization and anchor-stripping behavior;
- reuse existing repository identity derivations where applicable;
- compose with `receiptos-chronicle-admission-v0` without rewriting it;
- expose idempotent return and explicit conflict behavior as first-class outcomes.

### 19.5 Independent implementation obligation

After schemas and vectors are pinned, an independent implementation SHOULD be built and checked against those pinned artifacts rather than trusting the first implementation.

Note: Until those schemas, vectors, and implementations exist, this document is the normative semantic contract only.
