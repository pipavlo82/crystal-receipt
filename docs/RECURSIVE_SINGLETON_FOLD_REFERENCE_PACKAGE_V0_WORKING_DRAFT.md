# Recursive Singleton Fold Reference Package v0 — Working Draft

## 1. Status and purpose

This is a **non-normative working draft**. It does not freeze package bytes.
It does not create a ReceiptOS validity rule. It does not alter Chronicle
history. It does not create scoring, ranking, reputation, certification, or
trust tiers.

Its purpose is narrow: close the two remaining package-level blockers
identified before any reference implementation of the Recursive Singleton
Fold Profile v0 (RSF) can begin —

1. an exact, independently recomputable **source-admission bundle**, so a
   claimed `chronicle_entry.v0` can be reconstructed and admitted without
   trusting any producer-supplied verdict; and
2. an exact **evaluator envelope** for a single RSF evaluation, distinguishing
   acceptance, rejection, unverifiability, and malformed input, without
   placing evaluator findings inside the aggregate object or its identity.

This document defines packaging and evaluator **boundaries** only. It is
documentation, not code. No schema file, TypeScript type, evaluator, fixture,
vector, or manifest is created by this pass.

## 2. Parent artifacts and inherited invariants

This document is downstream of, and does not modify:

- `docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md` — the current
  byte-pinned, internally reviewed, non-normative RSF working profile this
  package evaluates against, including its §11.5 `profile_local_notes`
  contract, its §12 aggregate-identity formula, and its §17 transition rule.
  The RSF profile is **not yet frozen** and is not yet a conformance
  standard; it is byte-pinned working-draft text, reviewed and stable enough
  to build against, not a frozen specification.
- `docs/RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md` — the parent
  boundary document. RAB-V2 (aggregate-of-aggregates) remains deferred.
  RAB-A1 (entry-as-fold-raw-input) is a separate, mutually exclusive
  representation fork. Neither RAB-V2 nor RAB-A1 is adopted by this
  reference-package draft.
- `docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md` and
  `docs/ASYNC_DECISION_WRITE_V0.md` — source of the
  same-identity/non-identical-content conflict rule reused in §12 below.
- `docs/CHRONICLE.md` — source of the Chronicle admission invariants this
  package independently re-executes rather than trusts.
- `docs/RECEIPTOS_VERIFIER_CHALLENGE_SET_V0_WORKING_DRAFT.md` — source of the
  discipline that a profile-local finding vocabulary must not be casually
  merged with ReceiptOS reason codes (its §11).

Every invariant already pinned in those documents is inherited unchanged.
Where this document states a field or check, it is naming and packaging an
already-pinned profile requirement, not inventing new profile semantics.

## 3. Scope and non-goals

In scope:

- the exact shape of a source-admission bundle sufficient to independently
  reconstruct and admit a claimed `chronicle_entry.v0`;
- the exact shape of a single-object RSF evaluation envelope;
- the exact profile-local finding vocabulary and evaluation order;
- the exact SF-V1, SF-V1B package contracts (materials, not bytes);
- a separate exact pairwise conflict-evaluation artifact for SF-C1;
- candidate (non-canonical) future file-layout and manifest mechanics.

Out of scope, explicitly:

- any schema file, TypeScript type, validator, evaluator, fixture, vector, or
  manifest implementation;
- any change to the RSF profile text or its formulas;
- any change to Chronicle schemas or admission semantics;
- any change to the existing `receiptos-chronicle-admission-v0` package;
- any decision about a future shared admission v1;
- Counterfactual Conformance work of any kind;
- opening or merging a pull request.

## 4. Exact reference-package boundary

A future reference package for RSF v0 consists of exactly three evaluator
surfaces, and nothing else:

1. **Source-admission recomputation** — takes a source-admission bundle,
   independently re-derives and re-admits the claimed `chronicle_entry.v0`,
   and either proceeds or fails closed (§5–§6).
2. **Single-object fold evaluation** — takes one admitted source entry plus
   declaration objects, and produces one evaluation envelope (§7–§10).
3. **Pairwise conflict evaluation** — takes two independently valid complete
   `recursive_singleton_aggregate.v0` objects and produces one pairwise
   conflict artifact (§12).

These three surfaces are evaluated by three separate operations. A
single-object fold evaluation never accepts two aggregates, and a pairwise
conflict evaluation never re-runs source admission or singleton-fold
evaluation — it consumes two already-complete, already-valid aggregates.

## 5. Exact source-admission bundle

### 5.1 Purpose

The RSF profile (§4–§5) consumes "a source object that already satisfied the
existing Chronicle entry admission gate," but by design (`docs/CHRONICLE.md`
lines 87–89) a `chronicle_entry.v0` "never carries a verdict field. Existence
*is* the verdict." A reference evaluator therefore cannot admit a claimed
entry by inspecting the entry alone — it must independently re-execute the
existing admission gate from the entry's own precursor materials.

### 5.2 Exact bundle object

Schema identifier: `recursive_singleton_fold_source_admission_bundle.v0` —
this follows the repository's existing bare dotted `snake_case.v0` naming
convention and the RSF profile's own `recursive_singleton_*` prefix.

```json
{
  "schema": "recursive_singleton_fold_source_admission_bundle.v0",
  "bundle_version": "recursive-singleton-fold-source-admission-bundle-v0",
  "admission_profile_id": "receiptos-chronicle-admission-v0",
  "admission_fixture_set_sha256": "ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f",
  "source_evidence": { "...": "complete HandoffEvidence object" },
  "source_proof_object": { "...": "complete PortableProofObjectV0 object" },
  "source_entry_construction_options": {
    "entry_id": null,
    "evidence_capsule_ref": null,
    "provenance_summary_ref": null,
    "created_from": null,
    "labels": [],
    "notes": null
  },
  "claimed_source_entry": { "...": "complete chronicle_entry.v0 object" }
}
```

`admission_fixture_set_sha256` binds the bundle to the exact current shared
admission v0 package identity — the `fixture_set_sha256` value presently
recorded in `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json`
(`package_version: "receiptos-chronicle-admission-v0"`). A bundle whose
`admission_profile_id` and `admission_fixture_set_sha256` do not both match
the shared admission package's actual current identity is malformed at the
package-identity boundary and MUST be rejected before any source evaluation
begins — see §6.1 and §12 position 1.

`source_evidence` and `source_proof_object` use the **exact current
repository object shapes** — `HandoffEvidence`
(`src/receiptos/schema/types.ts`, lines 37–87) and `PortableProofObjectV0`
(`src/receiptos/capsule/portable-proof-object-v0.ts`, lines 11–37) — verbatim,
field for field. This document does not invent a new producer evidence
model.

`source_entry_construction_options` carries, field for field, the exact
package-level representation of the optional-parameter shape accepted by the
existing `createChronicleEntryV0` constructor
(`src/receiptos/capsule/chronicle-portfolio-v0.ts`, lines 71–82: `entryId`,
`evidenceCapsuleRef`, `provenanceSummaryRef`, `createdFrom`, `labels`,
`notes`). It is carried explicitly, rather than omitted, because
`createChronicleEntryV0` is not a pure function of `(evidence, proofObject)`
alone — several output fields (`entry_id`, `evidence_capsule_ref`,
`provenance_summary_ref`, `created_from`, `labels`, `notes`) fall back to
computed defaults only when the corresponding constructor option is absent.
Byte-exact reconstruction (§6) requires the exact options used, not just
their defaults. The bundle's JSON representation of this object is **not**
passed verbatim into the constructor call — §5.4 defines its exact closed
shape and the exact deterministic adapter that maps it onto the
constructor's actual TypeScript parameter types.

`claimed_source_entry` is the complete `chronicle_entry.v0` object the bundle
asserts is validly admitted. It is never trusted directly — §6 defines how it
is independently re-derived and byte-compared.

### 5.3 Field-level pinning

| Field | Required | Nullable | Empty permitted | Identity-bearing | Recomputed | Compared byte-exactly | Package-carried |
|---|---|---|---|---|---|---|---|
| `schema` | yes | no | no | no (bundle is evaluator input, outside aggregate identity) | no (fixed literal) | yes, against literal | yes |
| `bundle_version` | yes | no | no | no | no (fixed literal) | yes, against literal | yes |
| `admission_profile_id` | yes | no | no | no | no | yes, against `"receiptos-chronicle-admission-v0"`, the actual current shared admission package's `package_version` (§20) | yes |
| `admission_fixture_set_sha256` | yes | no | no; exact lowercase 64-hex SHA-256 string | no — outside aggregate identity and all RSF commitments | no | yes, against the actual current `fixture_set_sha256` recorded in `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json` | yes |
| `source_evidence` | yes | no | no (must satisfy `HandoffEvidence`'s own required-field shape) | no | no — it is the recomputation input, not an output | not directly; it is the input to recomputation (§6) | yes |
| `source_proof_object` | yes | no | no | no | no — it is a recomputation input | not directly; cross-checked in §6 | yes |
| `source_entry_construction_options` | yes | no | see §5.4 for the exact closed shape and per-sub-field pinning | no | no | not used verbatim — passed through the exact null-to-omitted adapter in §5.4 before driving reconstruction (§6) | yes |
| `claimed_source_entry` | yes | no | no | no (the bundle's copy is never itself identity-bearing; only the independently reconstructed, verified entry feeds `source_entry_content_commitment`) | no — this is the claim being checked, not a derived value | yes, against the reconstructed entry (§6) | yes |

No field in this bundle is a "trusted producer-supplied admission verdict."
`chronicle_entry.v0` is not modified to add one, and `entry_id` alone is
never treated as proof of admission — §6 step 8 explicitly requires
byte-exact comparison of the *entire* reconstructed entry, not merely its
`entry_id`.

### 5.4 Exact `source_entry_construction_options` shape and adapter

The real `createChronicleEntryV0` constructor's `options` parameter
(`chronicle-portfolio-v0.ts` lines 71–82) is typed as an object whose
sub-fields are optional TypeScript parameters — most of type `string`, not
`string | null`. A bundle is JSON, which has no `undefined`, so this
subsection pins the exact closed JSON shape carried in the bundle and the
exact deterministic adapter used to drive the constructor from it. The
bundle's `source_entry_construction_options` object is never passed
verbatim into the constructor call.

**Exact closed JSON shape:**

```json
{
  "entry_id": null,
  "evidence_capsule_ref": null,
  "provenance_summary_ref": null,
  "created_from": null,
  "labels": [],
  "notes": null
}
```

**Exact per-field types:**

| Field | JSON type | Empty permitted |
|---|---|---|
| `entry_id` | string or `null` | empty string permitted |
| `evidence_capsule_ref` | string or `null` | empty string permitted |
| `provenance_summary_ref` | string or `null` | empty string permitted |
| `created_from` | string or `null` | empty string permitted |
| `labels` | array containing only strings | empty array permitted |
| `notes` | string or `null` | empty string permitted |

All six fields are REQUIRED to be present in the bundle (though each may
take its documented default). No unknown field may appear in
`source_entry_construction_options`. `undefined` MUST NOT appear anywhere in
this object. Every member of `labels` MUST be a JSON string; a non-string
label member is malformed. Array order in `labels` is preserved exactly.
Empty strings are permitted for every nullable string field because the
current constructor does not itself prohibit them. JSON `null` and an empty
string (`""`) remain distinct package-level inputs and MUST NOT be treated
as equivalent.

**Exact deterministic adapter into `createChronicleEntryV0`'s `options`
parameter:**

| Bundle field | Adapter rule |
|---|---|
| `entry_id` | omit `entryId` from the constructor call when `entry_id` is `null`; otherwise pass the exact string as `entryId` |
| `evidence_capsule_ref` | omit `evidenceCapsuleRef` when `evidence_capsule_ref` is `null`; otherwise pass the exact string as `evidenceCapsuleRef` |
| `provenance_summary_ref` | omit `provenanceSummaryRef` when `provenance_summary_ref` is `null`; otherwise pass the exact string as `provenanceSummaryRef` |
| `created_from` | pass `created_from` exactly as `createdFrom`, including `null` — this field's constructor type already accepts `string \| null` directly, so no omission adapter applies |
| `labels` | pass a fresh array containing the exact ordered string members as `labels` |
| `notes` | pass `notes` exactly as `notes`, including `null` — this field's constructor type already accepts `string \| null` directly, so no omission adapter applies |

Bundle JSON `null` is therefore **not** passed verbatim into constructor
fields whose TypeScript contract is `string | undefined` (`entryId`,
`evidenceCapsuleRef`, `provenanceSummaryRef`): for those three fields, `null`
is the package-level representation of an omitted constructor option, and
the adapter above converts it to omission before the call. For the two
fields whose TypeScript contract already accepts `string | null`
(`createdFrom`, `notes`), `null` is passed straight through unchanged. This
mapping is deterministic, applies identically to every conformant
implementation, and is part of the package contract, not an implementation
detail left open by it.

A `source_entry_construction_options` object that violates any rule in this
subsection is malformed and MUST be rejected by §12 position 3 before the
adapter runs and before `source_evidence`, `source_proof_object`, or
`claimed_source_entry` are even inspected.

## 6. Independent Chronicle admission recomputation

Given a source-admission bundle, a conformant evaluator MUST perform, in
order:

1. **Validate the bundle header and exact v0 package identity.** Reject if
   any required top-level field of
   `recursive_singleton_fold_source_admission_bundle.v0` is absent, of the
   wrong type, or if an unknown top-level field is present; and reject if
   `admission_profile_id` does not equal `"receiptos-chronicle-admission-v0"`
   or `admission_fixture_set_sha256` does not equal the actual current
   `fixture_set_sha256` recorded in
   `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json`.
2. **Validate the `source_entry_construction_options` object** against the
   exact closed shape pinned in §5.4. A malformed options object is rejected
   here, before evidence, proof object, or claimed entry are inspected.
3. **Apply the exact null-to-omitted adapter** from §5.4 to produce the
   actual constructor `options` argument used in step 5.
4. **Validate `source_evidence`, `source_proof_object`, and
   `claimed_source_entry` shapes** against their exact current repository
   types.
5. **Independently recompute the ReceiptOS receipt root** from
   `source_evidence`, using the repository's existing recomputation path
   (`computeReceiptRoot`, `src/receiptos/canon/receipt-root.ts`) — the same
   function `createChronicleEntryV0` itself uses. This MUST NOT read
   `source_evidence.anchor.receipt_root` as ground truth; it is only the
   *claimed* stored root, checked against the recomputed root in the next
   step.
6. **Verify cross-object consistency** between `source_evidence` and
   `source_proof_object` — every check `createChronicleEntryV0` currently
   performs (`chronicle-portfolio-v0.ts` lines 87–121): stored vs. recomputed
   receipt root; `proofObject.receipt_root` vs. the verified root;
   `evidence_capsule.receipt_root.stored`/`.computed` vs. the verified/
   recomputed roots; `evidence_capsule.receipt_root.match`/`.status`
   internal consistency; `evidence_capsule.verifier_result` internal
   consistency.
7. **Verify proof-object identity and proof reference** —
   `proofObject.proof_object_id` equals the canonical derivation of the
   verified receipt root, and `proofObject.proof_ref` equals the canonical
   derivation of `proof_object_id` (`chronicle-portfolio-v0.ts` lines
   126–132).
8. **Independently execute the current Chronicle admission gate** — call the
   existing, unmodified `createChronicleEntryV0(source_evidence,
   source_proof_object, <adapted options from step 3>)`. The gate MUST
   receive only the exact deterministic adapter output pinned in §5.4, never
   the bundle's raw `source_entry_construction_options` object. Steps 5–7
   above are restatements of what this call already independently performs;
   a reference evaluator MAY implement steps 5–7 by calling this function
   directly rather than re-implementing its checks, but MUST NOT skip them or
   trust any field of `source_proof_object` or `claimed_source_entry` in
   their place. Any exception this call throws is mapped to a §11 finding
   code by the check that produced it (§6 steps 5–7); the host-language
   exception text itself is never canonical output.
9. **Canonicalize the reconstructed and claimed entries** — the
   reconstructed entry is exactly the return value of step 8 when it
   succeeds; canonicalize it, and canonicalize `claimed_source_entry`, both
   using the repository's `canonicalize()`
   (`src/receiptos/canon/canonicalize.ts`).
10. **Compare their canonical UTF-8 JSON bytes exactly** — require the two
    canonical byte strings to be identical.
11. **Fail closed on any mismatch** — any failure in steps 1–10 fails closed;
    no partial, probationary, or weighted admission exists, consistent with
    `docs/CHRONICLE.md` invariant 1 (lines 27–30).

This procedure never adds a verdict field to `chronicle_entry.v0`, and it
never treats `claimed_source_entry.entry_id` alone as proof of admission —
the comparison in steps 9–10 is over the complete canonical entry, not any
single field of it.

## 7. Exact singleton-fold evaluation envelope

Schema identifier: `recursive_singleton_fold_evaluation.v0`.

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "evaluated",
  "profile_verdict": "accepted",
  "aggregate": { "...": "complete recursive_singleton_aggregate.v0, or null" },
  "finding": { "...": "recursive_singleton_fold_finding.v0, or null" }
}
```

### 7.1 Closed state model

Exactly four `(evaluation_state, profile_verdict)` combinations are legal;
no other combination is a conformant envelope:

| `evaluation_state` | `profile_verdict` | `aggregate` | `finding` |
|---|---|---|---|
| `"evaluated"` | `"accepted"` | complete aggregate object | `null` |
| `"evaluated"` | `"rejected"` | `null` | exactly one finding |
| `"unverifiable"` | `null` | `null` | exactly one finding |
| `"malformed"` | `null` | `null` | exactly one finding |

These four states are orthogonal by construction: `evaluated` always carries
a non-null `profile_verdict`; `unverifiable` and `malformed` never do.
`aggregate` and `finding` are never simultaneously non-null, and never
simultaneously null.

The envelope, its `finding`, and its `evaluation_state`/`profile_verdict`
fields exist entirely **outside** `recursive_singleton_aggregate.v0` — none
of them is included in the aggregate object, the aggregate identity seed
(§12.1 of the profile), or any aggregate commitment. This preserves the
profile's own §11.4 prohibition on absorbing render/runtime metadata into
aggregate identity, extended here to evaluator metadata generally.

Forbidden in the envelope, unconditionally: `generated_at`, wall-clock time,
hostname, process ID, runtime duration, UI metadata, repository-local
absolute paths.

### 7.2 `finding` field shape

```json
{
  "schema": "recursive_singleton_fold_finding.v0",
  "code": "<one value from the §11 closed enum>",
  "check_position": 7
}
```

`check_position` is the 1-based integer position, per the exact evaluation
order in §10, at which the finding was raised. It exists so that finding
identity is derived from check order, not host-language exception order or
free text. Explanatory text is **forbidden** from canonical evaluator output;
implementation exception strings are **forbidden** from canonical evaluator
output. A finding is exactly `{schema, code, check_position}` — nothing else.

## 8. Exact successful evaluation contract

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "evaluated",
  "profile_verdict": "accepted",
  "aggregate": {
    "schema": "recursive_singleton_aggregate.v0",
    "...": "complete object per RSF profile §11.1"
  },
  "finding": null
}
```

Requirements:

- `evaluation_state` is `"evaluated"`; `profile_verdict` is `"accepted"`.
- `aggregate` is present and is a **complete** `recursive_singleton_aggregate.v0`
  — every field of RSF profile §11.1, including `profile_local_notes` fixed
  to `null` per RSF §11.5's deterministic-construction rule.
- `finding` is `null`.
- Every commitment and derived field in `aggregate` independently verifies
  (recomputed and compared, not merely copied from an input).
- The complete aggregate validates per RSF §17.4–§17.6.
- No timestamp or runtime metadata is included anywhere in the envelope or
  the aggregate.

## 9. Exact rejected evaluation contract

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "evaluated",
  "profile_verdict": "rejected",
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "source_receipt_root_mismatch",
    "check_position": 7
  }
}
```

Requirements:

- `evaluation_state` is `"evaluated"`; `profile_verdict` is `"rejected"`.
- `aggregate` is `null`. No failed, partial, or provisional aggregate object
  is ever emitted — an aggregate either is a complete, fully valid object, or
  it does not exist in the envelope at all.
- Exactly one deterministic profile-local `finding` is present, whose `code`
  is the first-failing check's code per the fixed order in §12.

## 10. Exact malformed and unverifiable contracts

### 10.1 Unverifiable

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "unverifiable",
  "profile_verdict": null,
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "source_admission_prerequisite_unavailable",
    "check_position": 7
  }
}
```

`evaluation_state` is `"unverifiable"` exactly when the input was well-formed
enough to run every prior check, but a prerequisite the evaluator does not
control could not be established — currently only the case where
`source_evidence.anchor.receipt_root` is absent (§6 step 5 cannot even be
compared). `profile_verdict` is `null`: unverifiable is not a synonym for
invalid. Absence of evaluation evidence MUST NOT become invalidity — the
evaluator reports that a determination could not be made, not that the
subject failed. This mirrors `docs/CHRONICLE.md` invariant 2 ("Ternary at the
check — binary at the door"), applied one layer up to fold evaluation. `aggregate`
is `null`. Exactly one `finding` names the unavailable prerequisite.

### 10.2 Malformed

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "malformed",
  "profile_verdict": null,
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "malformed_source_admission_bundle",
    "check_position": 1
  }
}
```

`evaluation_state` is `"malformed"` exactly when a structural/shape check
fails — the input did not even reach the point of being a well-typed
candidate to evaluate for admission or transition validity. `profile_verdict`
is `null`. `aggregate` is `null`. Exactly one `finding` identifies the first
malformed boundary encountered, per §12's fixed order.

## 11. Exact profile-local finding vocabulary

All codes below are **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**,
consistent with the convention already used in the RSF profile (its lines
724, 947, 1074) and in `docs/RECEIPTOS_VERIFIER_CHALLENGE_SET_V0_WORKING_DRAFT.md`
§11's caution against casually creating a second competing ReceiptOS
vocabulary. None of these codes reuses or aliases any
`receiptos-chronicle-admission-v0` `failure_class`/`reason_code` value or any
Unanchored Issuance Witness `reasonCode` enum value.

Closed v0 enum (30 values), grouped by the `evaluation_state` each can appear
under:

**`malformed`** (8 codes):
`malformed_source_admission_bundle`, `malformed_source_entry_construction_options`,
`malformed_source_entry`, `malformed_source_evidence`,
`malformed_portable_proof_object`, `malformed_fold_policy_declaration`,
`malformed_comparability_class_declaration`, `malformed_transition_rule_declaration`.

**`unverifiable`** (1 code):
`source_admission_prerequisite_unavailable`.

**`evaluated` / `rejected`** (21 codes):
`source_receipt_root_mismatch`, `cross_object_consistency_mismatch`,
`proof_object_identity_mismatch`, `proof_reference_mismatch`,
`reconstructed_source_entry_mismatch`, `source_entry_content_commitment_mismatch`,
`fold_policy_commitment_mismatch`, `singleton_policy_ineligible`,
`comparability_class_commitment_mismatch`, `singleton_class_ineligible`,
`transition_rule_commitment_mismatch`, `semantic_statement_mismatch`,
`semantic_result_commitment_mismatch`, `inclusion_set_mismatch`,
`inclusion_set_commitment_mismatch`, `forbidden_source_identity_reuse`,
`transition_result_mismatch`, `no_elevation_invariant_mismatch`,
`breakdown_mismatch`, `breakdown_commitment_mismatch`, `aggregate_id_mismatch`.

This is a **single deterministic primary finding** vocabulary, not an
unordered multi-finding surface — see §10's rationale for why RSF v0's
strictly sequential, single-source-object pipeline (unlike the Unanchored
Witness package's genuinely concurrent multi-artifact surface) needs at most
one terminal finding per evaluation, never an array requiring a total order
over co-occurring findings.

The SF-C1 same-identity/non-identical-content conflict is **not** in this
enum. §12 shows why: it is evaluated by a structurally separate operation
(the pairwise conflict evaluator), consuming two already-valid aggregates,
never a candidate still being validated for a single fold. Overloading this
enum with it would conflate two different operations' failure surfaces.

## 12. Exact evaluation order

Grounded directly in RSF profile §17.4's 16-point construction order and the
existing Chronicle admission gate's exact check sequence
(`chronicle-portfolio-v0.ts` lines 87–132). The first failed check determines
the single finding; host-language exception order MUST NOT define semantics
— a conformant evaluator MUST perform these checks in this fixed order
regardless of implementation language or control-flow structure.

| # | Check | On failure |
|---|---|---|
| 1 | Outer evaluation input is shaped as a `recursive_singleton_fold_source_admission_bundle.v0` (required top-level keys present, correctly typed) and its `admission_profile_id`/`admission_fixture_set_sha256` match the actual current shared admission v0 package identity (§5.2, §6 step 1) | `malformed_source_admission_bundle` |
| 2 | Bundle's nested containers (`source_evidence`, `source_proof_object`, `source_entry_construction_options`, `claimed_source_entry`) are each present as objects | `malformed_source_admission_bundle` |
| 3 | `source_entry_construction_options` matches the exact closed shape and field types pinned in §5.4 | `malformed_source_entry_construction_options` |
| 4 | `source_evidence` matches the exact `HandoffEvidence` shape | `malformed_source_evidence` |
| 5 | `source_proof_object` matches the exact `PortableProofObjectV0` shape | `malformed_portable_proof_object` |
| 6 | `claimed_source_entry` matches the exact `chronicle_entry.v0` shape (RSF profile §6.2/§6.5) | `malformed_source_entry` |
| 7 | Independent receipt-root recomputation (§6 step 5): prerequisite present, then recomputed vs. stored equality | `source_admission_prerequisite_unavailable` if the prerequisite is absent; `source_receipt_root_mismatch` if present but unequal |
| 8 | Cross-object consistency (§6 step 6; gate checks 3–7) | `cross_object_consistency_mismatch` |
| 9 | Proof-object identity (§6 step 7; gate check 8) | `proof_object_identity_mismatch` |
| 10 | Proof reference (§6 step 7; gate check 9) | `proof_reference_mismatch` |
| 11 | Chronicle admission gate call succeeds as a whole, receiving only the exact adapted options from §5.4 (§6 step 8) | (no distinct code — any failure here was already caught at 7–10) |
| 12 | Reconstructed entry equals claimed entry byte-exactly (§6 steps 9–10) | `reconstructed_source_entry_mismatch` |
| 13 | `source_entry_content_commitment` recomputes | `source_entry_content_commitment_mismatch` |
| 14 | `fold_policy_declaration` shape, then `fold_policy_commitment` recomputes | `malformed_fold_policy_declaration`, then `fold_policy_commitment_mismatch` |
| 15 | `comparability_class_declaration` shape, then `comparability_class_commitment` recomputes | `malformed_comparability_class_declaration`, then `comparability_class_commitment_mismatch` |
| 16 | `transition_rule_declaration` shape, then `transition_rule_commitment` recomputes | `malformed_transition_rule_declaration`, then `transition_rule_commitment_mismatch` |
| 17 | Input semantic statement constructed, then input `semantic_result_commitment` recomputes | `semantic_statement_mismatch`, then `semantic_result_commitment_mismatch` |
| 18 | Canonical inclusion set constructed, then `inclusion_set_commitment` recomputes | `inclusion_set_mismatch`, then `inclusion_set_commitment_mismatch` |
| 19 | Singleton policy eligibility evaluates true | `singleton_policy_ineligible` |
| 20 | Singleton comparability eligibility evaluates true | `singleton_class_ineligible` |
| 21 | Transition construction: source identity is not reused as aggregate identity | `forbidden_source_identity_reuse` |
| 22 | Output semantic statement constructed; output `semantic_result_commitment` equals input `semantic_result_commitment` (RSF §17.5) | `semantic_result_commitment_mismatch` |
| 23 | `transition_result` derives to the single pinned success object (RSF §15.1) | `transition_result_mismatch` |
| 24 | `no_stronger_semantic_class_created` recomputes true | `no_elevation_invariant_mismatch` |
| 25 | `pre_aggregation_breakdown` constructed, then its commitment recomputes | `breakdown_mismatch`, then `breakdown_commitment_mismatch` |
| 26 | `aggregate_id` recomputes from the exact §12.1 seed | `aggregate_id_mismatch` |
| 27 | Complete aggregate object independently re-validates in full (every stored value equals every recomputed value) | (terminal checkpoint; success here yields the `accepted` envelope) |

## 13. Exact SF-V1 package contract

Package materials required for the one deterministic valid singleton fold
(this pass creates no fixture bytes):

- one exact source-admission bundle (§5.2), sufficient to pass all of §12's
  checks 1–12;
- exact `fold_policy_declaration`, `comparability_class_declaration`,
  `transition_rule_declaration` objects (RSF profile §8.1, §9.1, §10.1
  literals, used verbatim);
- the expected **accepted** evaluation envelope (§8), whose `aggregate` is
  the complete expected aggregate with `profile_local_notes: null`;
- every commitment listed in RSF profile §11.2 and §12.1's seed, each
  independently derivable by a second implementation from the same bundle
  and declarations;
- a distinct `aggregate_id` (distinct from `claimed_source_entry.entry_id`,
  per §12's check 21);
- the recomputed `no_stronger_semantic_class_created` result;
- no timestamps or generated metadata anywhere in the bundle, declarations,
  envelope, or aggregate.

## 14. Exact SF-V1B package contract

SF-V1B uses:

- two separately parsed, byte-equivalent source-admission bundles (not one
  bundle object reused twice in memory);
- two separately parsed, byte-equivalent declaration sets;
- two separate reference-evaluator invocations, each independently producing
  a complete accepted evaluation envelope.

Required equality between the two invocations' results:

- complete accepted evaluation envelopes (§8), byte-for-byte;
- complete canonical aggregate bytes;
- every commitment;
- every derived field;
- `aggregate_id`;
- `transition_result`;
- the no-elevation result.

Not required by SF-V1B: separate operating systems; separate programming
languages; the independent second implementation (§16) — that is a
separate, later promotion-gate concern, not a component of replay-determinism
itself. This vector MUST NOT be satisfied by comparing one object instance
with itself; the two invocations must be genuinely separate evaluator calls
over separately parsed input bytes.

## 15. Exact SF-C1 pairwise-conflict contract

### 15.1 A separate artifact, not an overload of §7's envelope

SF-C1 is evaluated by a structurally distinct operation from §7's
single-object fold evaluation. The pairwise evaluator's input is **two
independently valid, complete `recursive_singleton_aggregate.v0` objects**,
not a source-admission bundle, and its output is a separate schema:

Schema identifier: `recursive_singleton_fold_pairwise_conflict.v0`.

```json
{
  "schema": "recursive_singleton_fold_pairwise_conflict.v0",
  "conflict_state": "evaluated",
  "conflict_verdict": "same_identity_nonidentical_content_conflict",
  "object_a_aggregate_id": "sha256:<...>",
  "object_b_aggregate_id": "sha256:<...>",
  "finding": null
}
```

### 15.2 Closed state model

| `conflict_state` | `conflict_verdict` | Meaning |
|---|---|---|
| `"malformed"` | `null` | either input object is not itself a completely valid `recursive_singleton_aggregate.v0` (a `finding` of `malformed_source_entry`-equivalent shape names which object and why; this reuses §11's `malformed_*` codes as appropriate to the failing sub-object) |
| `"evaluated"` | `"same_identity_nonidentical_content_conflict"` | both objects independently validate, share `aggregate_id`, and have non-identical complete canonical bytes |
| `"evaluated"` | `"no_conflict"` | both objects independently validate, and either their `aggregate_id`s differ, or their complete canonical bytes are identical |

The pairwise conflict result — the whole `recursive_singleton_fold_pairwise_conflict.v0`
object — remains **outside both aggregate objects and outside their
identities**, exactly as the single-object evaluation envelope in §7 remains
outside the aggregate it wraps.

### 15.3 Exact pinned future pair

- Object A: `"profile_local_notes": null`
- Object B: `"profile_local_notes": "sf-c1"`

Both objects must:

- independently pass complete validation (§12, checks 1–27, run once per
  object as an ordinary accepted single-object evaluation, prior to pairwise
  comparison);
- share every identity-bearing field (RSF profile §11.2);
- share every independently recomputed commitment;
- therefore share the same `aggregate_id`;
- differ only in complete canonical aggregate bytes (via `profile_local_notes`,
  per RSF profile §11.5 and §20).

Required resulting semantics: `conflict_state: "evaluated"`,
`conflict_verdict: "same_identity_nonidentical_content_conflict"`; no update;
no merge; no replacement; no reinterpretation; no silent deduplication.
Changing `profile_local_notes` from `null` to `"sf-c1"` does not require
changing or recomputing any identity-bearing value, but Object B must still
independently pass full validation as its own complete aggregate before the
pairwise evaluator ever compares it to Object A.

### 15.4 Separation from adjacent cases

This conflict is distinguished from, and must not be conflated with:

- a **structure-to-commitment mismatch** (RSF profile §20.1) — an internally
  invalid aggregate whose inline structure was changed while its stored
  commitment was not; this fails closed as `malformed` in the *single-object*
  evaluation (§7–§10) and never reaches the pairwise evaluator as a valid
  input;
- **policy mismatch**, **class mismatch**, **non-comparability**, and **fold
  ineligibility** — all single-object rejection outcomes (§9, codes
  `singleton_policy_ineligible`, `singleton_class_ineligible`, and related
  commitment-mismatch codes), never pairwise outcomes;
- **malformed input** generally — caught by `conflict_state: "malformed"` in
  §15.2, distinct from a genuine same-identity conflict between two
  individually-valid objects.

## 16. Aggregate validation and conflict separation

To summarize the boundary drawn across §7–§15: a `recursive_singleton_aggregate.v0`
object is either **completely valid** (every commitment, derived field, and
`aggregate_id` independently recomputes and matches) or it does not exist as
an output at all — there is no partially-valid or failure-shaped aggregate
anywhere in this package (§9's rejected envelope has `aggregate: null`, never
an aggregate-shaped object carrying a failure status). Given that binary
validity boundary, exactly one further question can be asked of two
already-valid aggregates: do they conflict per §15? That question is answered
by a separate artifact precisely because it presupposes both inputs already
cleared the single-object validity bar — it is not a third possible outcome
of single-object evaluation.

## 17. Manifest and byte-integrity contract

Candidate future package mechanics, defined here without creating any file:

- **Path ordering**: every manifest lists package-relative paths in sorted
  (lexicographic, byte-wise) order — the convention already used by
  `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json` and
  `tests/fixtures/unanchored-issuance-witness-v0/manifest.json`.
- **Hashing**: SHA-256 computed over exact Git-index bytes (via the existing
  `readGitIndexBytes`/`readGitIndexJson` helpers,
  `tests/receiptos/helpers/git-index-bytes.ts`), never normalized
  working-tree bytes.
- **Text encoding**: UTF-8 where text is required; LF-only; no BOM; exactly
  one final LF for text artifacts.
- **JSON parsing**: strict; no duplicate keys permitted in any package JSON
  file.
- **Manifest completeness**: no unknown path may appear in a manifest that
  does not correspond to a real package file, and no normative package file
  may be absent from its package's manifest.
- **Aggregate fixture-set identity**: SHA-256 over UTF-8 lines of
  `<sorted package-relative path><TAB><lowercase file SHA-256><LF>`, with the
  manifest file and any README excluded from their own aggregate hash — the
  exact convention already used by both existing fixture packages.

Future artifacts that MUST enter such a manifest, once they exist: the frozen
profile text's own hash record; all schema files (§18); all fixture/vector
JSON for SF-V1, SF-V1B, SF-C1; all expected-output JSON; the manifest itself
(hashed into its own package_version/files metadata, but excluded from the
aggregate it lists, per the existing convention).

Excluded from any such manifest: implementation source files (evaluator,
validators, TypeScript types), test runner files, and any diagnostic or
research-only tooling (mirroring the existing exclusion of
`tests/blind-diff/` from the Unanchored Witness package's manifest).

## 18. Reference implementation boundary

Candidate future repository paths — every path below is a **candidate, not
canonical** — chosen to match existing repository layout conventions
observed in `src/receiptos/schemas/`, `src/receiptos/capsule/`,
`tests/fixtures/`, `tests/receiptos/`, and `conformance/`:

- source-admission bundle schema:
  `src/receiptos/schemas/recursive-singleton-fold-source-admission-bundle-v0.schema.json`
- evaluation-envelope schema:
  `src/receiptos/schemas/recursive-singleton-fold-evaluation-v0.schema.json`
- finding schema:
  `src/receiptos/schemas/recursive-singleton-fold-finding-v0.schema.json`
- pairwise conflict-result schema:
  `src/receiptos/schemas/recursive-singleton-fold-pairwise-conflict-v0.schema.json`
- aggregate schema:
  `src/receiptos/schemas/recursive-singleton-aggregate-v0.schema.json`
- TypeScript types and validators:
  `src/receiptos/capsule/recursive-singleton-fold-v0.ts`
- reference evaluator (source-admission recomputation + single-object fold):
  `src/receiptos/capsule/recursive-singleton-fold-v0.ts` (same module, or a
  sibling `recursive-singleton-fold-evaluator-v0.ts`)
- pairwise conflict evaluator:
  `src/receiptos/capsule/recursive-singleton-fold-pairwise-conflict-v0.ts`
- SF-V1 fixture: `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1.json`
- SF-V1B fixture: `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b.json`
- SF-C1 fixture: `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-c1.json`
- expected outputs: co-located with each fixture, per the existing
  `expected` convention in `receiptos-chronicle-admission-v0` vectors
- manifest: `tests/fixtures/recursive-singleton-fold-v0/manifest.json`
- package-integrity tests:
  `tests/receiptos/recursive-singleton-fold-vectors.test.ts`
- focused semantic tests:
  `tests/receiptos/recursive-singleton-fold-v0.test.ts`
- independent-second-implementation comparison artifacts (mirroring the
  existing `conformance/chronicle-checkpoint-continuity-v0/` precedent):
  `conformance/recursive-singleton-fold-v0/`

No new repository is introduced. No file at any of these paths is created by
this pass.

## 19. Independent second-implementation boundary

The later, separate second implementation of this reference package must:

- be separately authored;
- use a separate language or a genuinely separate code path from the
  TypeScript reference evaluator;
- consume the frozen profile and the frozen version of this package contract
  — not a working draft of either;
- not import reference evaluator helpers (canonicalization, commitment
  derivation, or check-ordering logic must be independently implemented, not
  shared via library import);
- independently implement canonicalization and every commitment derivation;
- independently produce SF-V1, SF-V1B, and SF-C1 results;
- freeze implementation identity before expected outputs are revealed, where
  practical;
- preserve and classify any disagreement with the reference evaluator's
  outputs, rather than silently discarding it;
- not patch its outputs merely to match the reference evaluator when a
  disagreement is found — a genuine disagreement must be investigated and
  classified, not papered over.

This document does not begin that implementation, and does not decide its
language or repository location beyond the candidate note in §18.

## 20. Relationship to shared admission v0 and unresolved v1

- The existing `tests/fixtures/receiptos-chronicle-admission-v0/` package —
  its manifest, its vectors, its `package_version` string
  `"receiptos-chronicle-admission-v0"`, and its pinned `fixture_set_sha256` —
  **remains unchanged** by this document.
- Its current pinned identity **remains unchanged**.
- This reference package **may reuse** its semantics and source materials —
  §5–§6's independent recomputation procedure is, by design, a restatement
  of exactly what that package's `execute()` runner
  (`tests/receiptos/shared-chronicle-admission-vectors.test.ts`, lines
  58–90) already does against the same `createChronicleEntryV0` gate.
- This document **does not define or adopt** a shared admission v1.
- This document **does not decide** whether a future v1 replaces v0 or runs
  beside it.
- Any v1 evolution of the shared admission seam remains a separate,
  unresolved shared-seam decision, out of scope here.

## 21. Promotion gates

Before any file described in §18 as a candidate path may be created as real,
canonical package content, the following must hold, mirroring the RSF
profile's own §23 promotion-gate discipline:

- both the RSF profile itself and this package contract must be separately
  reviewed and frozen in the future, each with its own pinned SHA-256, before
  executable promotion; neither is frozen today — the RSF profile remains a
  byte-pinned, internally reviewed, non-normative working profile, and this
  document remains a working draft;
- the source-admission bundle shape (§5), the evaluation envelope shape
  (§7–§10), the finding vocabulary (§11), the evaluation order (§12), and the
  pairwise conflict artifact (§15) must all be stable across that review with
  no open semantic questions;
- SF-V1, SF-V1B, and SF-C1 expected outputs must be generated and reviewed
  before being treated as frozen fixtures;
- an independent second implementation (§19) must exist and its outputs
  compared, with any disagreement classified, before this package is treated
  as promotion-ready;
- LF-only/no-BOM/Git-index-byte integrity checks (§17) must pass for every
  package file.

None of these gates is satisfied by this pass. This document only removes
the two packaging/evaluator-contract blockers that stood before any of this
work could begin.

## 22. Summary formulation

This working draft pins, without freezing, exactly two things: (1) a
`recursive_singleton_fold_source_admission_bundle.v0` object, bound to the
exact current shared admission v0 package identity
(`admission_profile_id`/`admission_fixture_set_sha256`), with an exact closed
`source_entry_construction_options` shape and deterministic null-to-omitted
adapter, sufficient for any conformant implementation to independently
reconstruct and admit a claimed `chronicle_entry.v0` without trusting a
producer-supplied verdict or `entry_id` alone, and (2) a
`recursive_singleton_fold_evaluation.v0` envelope with a closed four-state
model (accepted / rejected / unverifiable / malformed), a single
deterministic profile-local finding per failed evaluation, and a fixed
27-step evaluation order — plus a structurally separate
`recursive_singleton_fold_pairwise_conflict.v0` artifact for SF-C1, so that
same-identity/non-identical-content conflicts are never confused with
single-object fold failures. No RSF profile formula, no Chronicle schema, and
no existing shared admission package is changed. No ReceiptOS reason code,
scoring mechanism, or reputation concept is introduced. The RSF profile
remains a byte-pinned, internally reviewed, non-normative working profile —
not yet frozen — and this document remains a working draft, creating no
package bytes.
