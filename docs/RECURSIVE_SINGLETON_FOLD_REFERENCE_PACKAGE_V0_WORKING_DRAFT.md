# Recursive Singleton Fold Reference Package v0 — Working Draft

## 1. Status and purpose

This is a **non-normative working draft**. It is internally reviewed and
byte-pinned only as a working-draft artifact. It is **not frozen**, it is
**not a conformance standard**, it is **not a ReceiptOS validity rule**, it is
**not a Chronicle schema change**, and it is **not** a scoring, ranking,
reputation, certification, or trust-tier mechanism.

One narrow exception is adopted and normative: the positions 18–28 closure
in §12, including its stage input, four schemas, 33-code single-evaluation
vocabulary, first-finding order, byte domains, and fixture package. This
exception freezes an implementation contract but does not itself implement an
evaluator or promote any source/admission/status label to carrier validity.

Outside the adopted §12 positions 18–28 closure, this working draft creates no
schema, validator, evaluator, fixture, vector, manifest, runner, independent
implementation, or conformance claim. The adopted exception adds only the
four schemas, normative fixture package, two independent expected-value
programs, and data-integrity tests named in §12.1; it adds no evaluator.

Its purpose is narrow: pin, in one coherent document, the reference-package
contract needed before any executable reference implementation of the
Recursive Singleton Fold Profile v0 (RSF) can begin —

1. an exact, independently recomputable **source-admission bundle**, so a
   claimed `chronicle_entry.v0` can be reconstructed and admitted without
   trusting any producer-supplied verdict;
2. an exact, closed **evaluation-input artifact** and **Chronicle
   construction-options adapter**, so a single evaluation's canonical input
   bytes are unambiguous;
3. an exact **evaluator envelope** for a single RSF evaluation, distinguishing
   acceptance, rejection, unverifiability, and malformed input, without
   placing evaluator findings inside the aggregate object or its identity;
   and
4. a structurally separate **pairwise conflict artifact**, so a
   same-identity/non-identical-content conflict between two already-valid
   aggregates is never confused with a single-object fold failure.

## 2. Parent artifacts and inherited invariants

This document is downstream of, and does not modify:

- `docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md` — the current
  byte-pinned, internally reviewed, non-normative RSF working profile this
  package evaluates against, including its §11.5 `profile_local_notes`
  contract, its §12.1 aggregate-identity seed, and its §17 transition rule.
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
  same-identity/non-identical-content conflict rule reused in §15 below.
- `docs/CHRONICLE.md` — source of the Chronicle admission invariants this
  package independently re-executes rather than trusts, including invariant
  1 ("no partial, weighted, or probationary admission"), invariant 2
  ("ternary at the check, binary at the door"), and the rule that a
  `chronicle_entry.v0` "never carries a verdict field. Existence *is* the
  verdict."
- `docs/RECEIPTOS_VERIFIER_CHALLENGE_SET_V0_WORKING_DRAFT.md` — source of the
  discipline that a profile-local finding vocabulary must not be casually
  merged with ReceiptOS reason codes (its §11).
- `docs/analysis/ruleset-version-pinned-input.md` — source of the repository's
  existing pinned-input discipline: exact literals matter, exact declaration
  bytes matter, exact commitment recomputation matters, and package identity
  must not depend on mutable runtime repository state.

Every invariant already pinned in those documents is inherited unchanged.
Where this document states a field or check, it is naming and packaging an
already-pinned profile requirement, not inventing new profile semantics.

## 3. Scope and non-goals

In scope:

- the exact shape of a source-admission bundle sufficient to independently
  reconstruct and admit a claimed `chronicle_entry.v0`;
- the exact shape of a closed evaluation-input artifact and the Chronicle
  construction-options adapter it carries;
- the exact shape of a single-object RSF evaluation envelope, its
  four-state model, its finding schema, and its closed finding vocabulary;
- the exact, single, 28-position evaluation order;
- the exact SF-V1, SF-V1B package contracts (materials, not bytes);
- a separate exact pairwise conflict-evaluation artifact for SF-C1;
- candidate (non-canonical) future file-layout and manifest mechanics;
- the promotion gates that must hold before any of this becomes canonical.

Out of scope, explicitly:

- any schema file, TypeScript type, validator, evaluator, fixture, vector, or
  manifest implementation;
- any change to the RSF profile text or its formulas;
- any change to Chronicle schemas or admission semantics;
- any change to the existing `receiptos-chronicle-admission-v0` package or
  its pinned identity;
- any decision about a future shared admission v1;
- Counterfactual Conformance work of any kind;
- opening or merging a pull request;
- freezing package bytes or making a conformance claim.

## 4. Exact reference-package surfaces

A future reference package for RSF v0 consists of exactly three evaluator
surfaces, and nothing else:

1. **Source-admission recomputation** — takes a source-admission bundle,
   independently re-derives and re-admits the claimed `chronicle_entry.v0`,
   and either proceeds or fails closed (§5–§6).
2. **Single-object fold evaluation** — takes one closed evaluation-input
   artifact (§7), including the admitted source entry and the declaration
   objects it carries, and produces one evaluation envelope (§10–§12).
3. **Pairwise conflict evaluation** — takes two independently valid, complete
   `recursive_singleton_aggregate.v0` objects and produces one pairwise
   conflict artifact (§15).

These three surfaces are evaluated by three separate operations. A
single-object fold evaluation accepts one evaluation input only and never
accepts two aggregates. A pairwise conflict evaluation accepts two already
complete and independently validated aggregates; it never re-runs source
admission or singleton-fold evaluation. Findings from any surface remain
outside aggregate identity and aggregate commitments, and the pairwise
surface uses a finding vocabulary (§15.1) that is separate from the
single-evaluation vocabulary (§11).

## 5. Exact source-admission bundle

### 5.1 Purpose

The RSF profile consumes "a source object that already satisfied the
existing Chronicle entry admission gate," but by design
(`docs/CHRONICLE.md`, invariants 1–2 and the rule at line 87) a
`chronicle_entry.v0` "never carries a verdict field. Existence *is* the
verdict." A reference evaluator therefore cannot admit a claimed entry by
inspecting the entry alone — it must independently re-execute the existing
admission gate from the entry's own precursor materials.

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

Exactly eight closed top-level fields are required, and no unknown field may
appear: `schema`, `bundle_version`, `admission_profile_id`,
`admission_fixture_set_sha256`, `source_evidence`, `source_proof_object`,
`source_entry_construction_options`, `claimed_source_entry`.

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
alone — several output fields fall back to computed defaults only when the
corresponding constructor option is absent. Byte-exact reconstruction (§6)
requires the exact options used, not just their defaults. The bundle's JSON
representation of this object is **not** passed verbatim into the
constructor call; §8 defines the exact closed shape and the exact
deterministic adapter that maps it onto the constructor's actual TypeScript
parameter types. That adapter is defined exactly once, in §8, and is not
restated here.

`claimed_source_entry` is the complete `chronicle_entry.v0` object the bundle
asserts is validly admitted. It is never trusted directly — §6 defines how it
is independently re-derived and byte-compared. `entry_id` alone is never
treated as proof of admission; a producer-supplied admission verdict does not
exist anywhere in this bundle, and none is added to `chronicle_entry.v0`.

### 5.3 Field-level pinning

| Field | Required | Nullable | Empty permitted | Identity-bearing | Recomputed | Compared | Package-carried |
|---|---|---|---|---|---|---|---|
| `schema` | yes | no | no | no — bundle is evaluator input, outside aggregate identity | no (fixed literal) | byte-exactly, against the literal | yes |
| `bundle_version` | yes | no | no | no | no (fixed literal) | byte-exactly, against the literal | yes |
| `admission_profile_id` | yes | no | no | no | no | byte-exactly, against `"receiptos-chronicle-admission-v0"` | yes |
| `admission_fixture_set_sha256` | yes | no | no; exact lowercase 64-hex SHA-256 | no — outside aggregate identity and all RSF commitments | no | byte-exactly, against `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f` | yes |
| `source_evidence` | yes | no | no (must satisfy `HandoffEvidence`'s own required-field shape) | no | no — it is the recomputation input, not an output | not directly; it is the input to recomputation (§6) | yes |
| `source_proof_object` | yes | no | no | no | no — it is a recomputation input | not directly; cross-checked in §6 | yes |
| `source_entry_construction_options` | yes | no | see §8 for the exact closed shape and per-field pinning | no | no | not used verbatim — passed through the exact adapter in §8 before driving reconstruction (§6) | yes |
| `claimed_source_entry` | yes | no | no | no — the bundle's copy is never itself identity-bearing; only the independently reconstructed, verified entry feeds `source_entry_content_commitment` | no — this is the claim being checked, not a derived value | byte-exactly, against the reconstructed entry (§6) | yes |

No field in this bundle is a trusted producer-supplied admission verdict.
`chronicle_entry.v0` is not modified to add one. Dependency identifiers
(`admission_profile_id`, `admission_fixture_set_sha256`) are package-carried
literals, checked against the actual current shared admission v0 package
identity, not read from mutable runtime repository state at evaluation time.
All eight bundle fields remain outside aggregate identity and outside every
RSF commitment.

### 5.4 Relationship to shared admission v0 and unresolved v1

#### 5.4.1 Canonical adopted dependency definition

RSF adopts the ReceiptOS Chronicle admission v0 fixture package as an immutable
external dependency identity with the following exact provenance and derivation:

- immutable source commit:
  `7d9b67c96f2b472f5b4acfef3f95b669eb24de7b`
- package path:
  `tests/fixtures/receiptos-chronicle-admission-v0/`
- manifest path:
  `tests/fixtures/receiptos-chronicle-admission-v0/manifest.json`
- recipe path:
  `tests/fixtures/receiptos-chronicle-admission-v0/README.md`
- exact member count: `13`
- member SHA-256 recipe:
  `SHA-256(raw Git blob payload bytes)` for each manifest-listed member path at
  the pinned immutable source commit
- aggregate recipe:
  sorted package-relative path, TAB, lowercase member SHA-256, LF
- manifest self-exclusion:
  `manifest.json` is excluded from its own aggregate
- fixture-set SHA-256:
  `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f`
- classification:
  immutable external dependency identity adopted by RSF

For this adopted package, the member digest input is the exact raw Git blob
payload only. No checkout transformation, newline normalization, text decoding,
re-encoding, Unicode normalization, whitespace normalization, JSON parsing,
JSON re-serialization, canonical JSON transformation, clean/smudge filter,
`.gitattributes` checkout transformation, or generated-file regeneration is
applied before hashing.

The package-relative paths in this package are ASCII, so their bytewise order
and serialized bytes are unambiguous for this adopted aggregate recipe. This
section does not introduce a broader Unicode path canonicalization rule.

This digest is not an identity of the current mutable fixture directory on
`main`. Later edits to that package do not change this frozen RSF dependency.
Changing the dependency requires a deliberate new immutable commit pin and a
fresh recomputation under the same adopted recipe. The digest remains outside
aggregate identity and outside all RSF commitment computation; this section
defines provenance and derivation only and does not alter RSF evaluation
semantics.

- The existing `tests/fixtures/receiptos-chronicle-admission-v0/` package —
  its manifest, its vectors, its `package_version` string
  `"receiptos-chronicle-admission-v0"`, and its adopted `fixture_set_sha256`
  dependency value `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f`
  — **remains unchanged** by this document.
- A bundle whose `admission_profile_id` and `admission_fixture_set_sha256` do
  not both match those exact package-contract literals is malformed at the
  package-identity boundary and MUST be rejected before any source evaluation
  begins (§6 step 1; §12 position 2).
- This reference package **may reuse** the shared admission package's
  semantics and source materials — §6's independent recomputation procedure
  is, by design, a restatement of exactly what that package's verifier already
  checks against the same `createChronicleEntryV0` gate.
- The repository manifest is historical provenance for why these literals
  were selected, not mutable runtime authority; repository evolution MUST NOT
  silently change evaluation meaning, and there is no automatic upgrade to a
  future shared admission v1.
- This document does not define or adopt a shared admission v1, and does not
  decide whether a future v1 replaces v0 or runs beside it. Any v1 evolution
  of the shared admission seam remains a separate, unresolved shared-seam
  decision, out of scope here.

## 6. Independent Chronicle admission recomputation

Given a source-admission bundle, a conformant evaluator MUST perform, in
order:

1. Validate the complete evaluation input that carries this bundle (§7).
2. Validate the bundle shape and its dependency literals — reject if any
   required top-level field of
   `recursive_singleton_fold_source_admission_bundle.v0` is absent, of the
   wrong type, or if an unknown top-level field is present, and reject if
   `admission_profile_id` or `admission_fixture_set_sha256` do not match the
   exact literals pinned in §5.4.
3. Validate the bundle's nested source containers (`source_evidence`,
   `source_proof_object`, `source_entry_construction_options`,
   `claimed_source_entry`) are each present as objects.
4. Validate `source_entry_construction_options` against the exact closed
   shape pinned in §8. A malformed options object is rejected here, before
   evidence, proof object, or claimed entry are inspected.
5. Validate `source_evidence` against the exact current `HandoffEvidence`
   shape.
6. Validate `source_proof_object` against the exact current
   `PortableProofObjectV0` shape.
7. Validate `claimed_source_entry` against the exact current
   `chronicle_entry.v0` shape (RSF profile §6.2/§6.5).
8. Independently recompute the ReceiptOS receipt root from `source_evidence`,
   using the repository's existing recomputation path (`computeReceiptRoot`,
   `src/receiptos/canon/receipt-root.ts`) — the same function
   `createChronicleEntryV0` itself uses. This MUST NOT read
   `source_evidence.anchor.receipt_root` as ground truth; it is only the
   *claimed* stored root, checked against the recomputed root.
9. Compare the stored and recomputed receipt roots for equality.
10. Verify cross-object consistency between `source_evidence` and
    `source_proof_object` — every check `createChronicleEntryV0` currently
    performs (`chronicle-portfolio-v0.ts`, lines 87–121): stored vs.
    recomputed receipt root; `proofObject.receipt_root` vs. the verified
    root; `evidence_capsule.receipt_root.stored`/`.computed` vs. the
    verified/recomputed roots; `evidence_capsule.receipt_root.match`/
    `.status` internal consistency; `evidence_capsule.verifier_result`
    internal consistency.
11. Independently verify proof-object identity —
    `proofObject.proof_object_id` equals the canonical derivation of the
    verified receipt root (`deriveProofObjectId`,
    `src/receiptos/capsule/portable-proof-object-v0.ts`).
12. Independently verify the proof reference — `proofObject.proof_ref`
    equals the canonical derivation of `proof_object_id` (`deriveProofRef`,
    same module; both checks correspond to `chronicle-portfolio-v0.ts`,
    lines 126–132).
13. Apply the exact deterministic adapter from §8 to
    `source_entry_construction_options`, producing the actual constructor
    `options` argument used in the next step.
14. Invoke the existing, unmodified `createChronicleEntryV0(source_evidence,
    source_proof_object, <adapted options from step 13>)` admission path. The
    gate MUST receive only the exact adapter output from §8, never the
    bundle's raw `source_entry_construction_options` object. Steps 8–12
    above are restatements of what this call already independently performs;
    a reference evaluator MAY implement steps 8–12 by calling this function
    directly rather than re-implementing its checks, but MUST NOT skip them
    or trust any field of `source_proof_object` or `claimed_source_entry` in
    their place.
15. Canonicalize the reconstructed entry — the exact return value of step 14
    when it succeeds — using the repository's `canonicalize()`
    (`src/receiptos/canon/canonicalize.ts`).
16. Canonicalize `claimed_source_entry` using the same `canonicalize()`.
17. Compare the two canonical UTF-8 JSON byte strings for exact equality.
18. Fail closed on any mismatch in steps 2–17 — no partial, probationary, or
    weighted admission exists, consistent with `docs/CHRONICLE.md`
    invariant 1.

This procedure never adds a verdict field to `chronicle_entry.v0`, and it
never treats `claimed_source_entry.entry_id` alone as proof of admission —
the comparison in steps 15–17 is over the complete canonical entry, not any
single field of it. Any exception this call throws is mapped to a §11
finding code by the check that produced it; an unrecognized host-language
exception is an implementation failure, not canonical evaluator output — it
is never surfaced as exception text in canonical evaluator output.

## 7. Exact evaluation-input artifact

The canonical parse target for one singleton-fold evaluation is the closed
package-local input artifact `recursive_singleton_fold_evaluation_input.v0`.
It is distinct from the nested source-admission bundle (§5), the evaluation
output envelope (§10), and the final aggregate object.

### 7.0 Runtime input boundary

The RSF core evaluation operation MUST begin with an immutable, or
equivalently snapshotted, JSON-domain value tree. That tree consists only of:

- `null`;
- booleans;
- finite IEEE-754 binary64 numeric values;
- strings that are finite sequences of Unicode scalar values;
- dense ordered arrays whose members are JSON-domain values; and
- objects whose member names are unique Unicode-scalar strings and whose
  member values are JSON-domain values.

Object member order and host object identity are not part of this abstract
value. The tree MUST be acyclic, MUST NOT expose shared-reference aliases, and
MUST NOT mutate during evaluation. No Unicode normalization is performed, so
canonically equivalent but distinct scalar sequences, including NFC and NFD
forms, remain distinct. Negative zero has no distinct RSF abstract meaning
from zero.

Host-language-only constructs are outside this domain. These include absent-
value sentinels distinct from `null`; functions or callable values; symbols or
non-string object keys; arbitrary-precision native integers unless represented
according to a field-specific JSON encoding; NaN and positive or negative
infinity; sparse arrays or holes; prototypes, classes, accessors, proxies,
maps, sets, dates, or equivalent host objects as protocol-visible constructs;
cycles; observable shared-reference identity; and mutation during validation.
A host implementation MUST either reject such a value or materialize an
equivalent immutable JSON-domain value tree before invoking the core.
Accidental acceptance of an exotic language-native value is not RSF core
conformance.

Raw bytes and JSON text are not RSF core inputs. UTF-8 decoding and JSON
parsing occur outside the core. A byte/text adapter owns decoding, parsing,
and duplicate-member detection and MUST reject duplicate object member names
rather than applying first-wins or last-wins resolution. It MUST also reject
ill-formed Unicode before core invocation; consequently, lone surrogates
cannot enter the core. JSON escape spelling is not part of an abstract string:
escaped and literal representations that denote the same Unicode scalar
sequence produce the same core value. Malformed bytes or text do not invoke
the core. A transport failure does not map to any current RSF finding code or
check position, and in particular does not insert a parser failure before
position 1. Only a separately versioned transport specification could define
a transport result; such a result would not be a core RSF finding under this
version. Transport-adapter conformance and RSF core conformance are separate
claims. This document defines no transport error envelope or adapter API.

This boundary does not change the seven top-level fields, their schema or
profile literals, the 32 finding codes, or the 28-position order. Positions
1–4 remain the only implemented and wired structural machine-consumer
positions; positions 5–17 are implemented as isolated, non-chaining
primitives (§12) that are not integrated into this structural validator, and
valid already-materialized JSON-domain inputs retain their current structural
meaning. No schema version change is introduced.

### 7.1 Exact top-level shape

```json
{
  "schema": "recursive_singleton_fold_evaluation_input.v0",
  "profile_id": "recursive-singleton-fold-profile-v0",
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

### 7.2 Required fields and pinned literals

All seven top-level fields are required, and no unknown top-level field may
appear: `schema`, `profile_id`, `source_admission_bundle`,
`fold_policy_declaration`, `comparability_class_declaration`,
`transition_rule_declaration`, `profile_local_notes`.

Pinned exact literals:

- `schema` MUST equal exactly `recursive_singleton_fold_evaluation_input.v0`.
- `profile_id` MUST equal exactly `recursive-singleton-fold-profile-v0`.
- `profile_id` identifies the selected logical RSF profile. This version does
  not define any cryptographic profile identity field. A cryptographic profile
  identity remains undefined unless and until a later specification
  normatively adopts an exact artifact, an immutable source commit, a
  byte-domain rule, and a deterministic derivation recipe. No removed digest is
  historical, current, canonical, frozen, implied, or reserved in this version.

### 7.3 Requiredness and nullability

`profile_local_notes` is required and MUST be exactly `null` or a JSON
string; an empty string is permitted and is distinct from `null`. All other
top-level fields are required and non-null. Unknown fields inside embedded
declarations or bundles are handled by the exact validation rules of those
embedded artifacts; they are not silently ignored by the package contract.

### 7.4 Canonicalization boundary

The canonicalization boundary for one evaluator invocation is the complete
validated `recursive_singleton_fold_evaluation_input.v0` object. Validation
occurs before canonicalization, which receives only values within the runtime
input domain defined by §7.0. Canonicalization uses the repository's
`canonicalize()`. Input canonical bytes are UTF-8 canonical JSON bytes; no
Unicode normalization is applied. No timestamp, runtime, host, path, or UI
metadata is permitted anywhere in this object.

### 7.5 Declaration closure

The declaration objects inside the evaluation input are the exact complete
objects pinned by the RSF profile: `recursive_singleton_fold_policy.v0`
(profile §8.1), `recursive_singleton_comparability_class.v0` (profile §9.1),
and `recursive_singleton_transition_rule.v0` (profile §10.1). They are not
shorthand labels and are not replaceable by loose, separate function
arguments. A frozen fixture package and an independent implementation both
require this one closed evaluation-input artifact as the normative
reproduction surface; separate function arguments may still exist inside a
host implementation, but they are not a sufficient canonical package
contract for frozen fixture bytes or independent reproduction.

## 8. Chronicle construction-options adapter

The evaluation input's source-admission bundle carries
`source_entry_construction_options`, which is passed into the Chronicle
entry constructor during recomputation (§6 step 13). The real
`createChronicleEntryV0` constructor's `options` parameter
(`chronicle-portfolio-v0.ts`, lines 71–82) is typed as an object whose
sub-fields are optional TypeScript parameters — most of type `string`, not
`string | null`. A bundle is JSON, which has no `undefined`, so this section
pins the exact closed JSON shape and the exact deterministic adapter used to
drive the constructor from it. This adapter is the single, exclusive
definition of this mapping in this document; §5 does not restate it.

### 8.1 Exact closed JSON shape

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

All six fields are REQUIRED to be present (though each may take its
documented default). No unknown field may appear. `undefined` MUST NOT
appear anywhere in this object. Every member of `labels` MUST be a JSON
string, in the exact order supplied; a non-string label member is malformed
at the package-validation boundary in §6 step 4, prior to construction. JSON
`null` and an empty string (`""`) remain distinct package-level inputs and
MUST NOT be treated as equivalent; empty strings are permitted for every
nullable string field.

### 8.2 `entry_id`

- string: pass the exact string as `entryId`.
- `null`: omit `entryId`; the constructor default path applies (fallback to
  `entry-${proofObject.proof_object_id}`).
- empty string: preserved exactly, because an empty string is non-nullish.

### 8.3 `evidence_capsule_ref`

- string: pass the exact string as `evidenceCapsuleRef`.
- `null`: omit `evidenceCapsuleRef`; the constructor default path applies.
- empty string: preserved exactly, because an empty string is non-nullish.

### 8.4 `provenance_summary_ref`

- string: pass the exact string as `provenanceSummaryRef`.
- `null`: omit `provenanceSummaryRef`; the constructor default path applies.
- empty string: preserved exactly, because an empty string is non-nullish.

### 8.5 `created_from`

The actual constructor semantics are:

```ts
created_from: options?.createdFrom ?? proofObject.source_evidence_ref ?? null
```

- string: pass the exact string as `createdFrom`.
- `null`: this field's constructor type already accepts `string | null`
  directly, so `null` is passed through the adapter without an omission
  step; the constructor itself then applies its own fallback semantics,
  yielding `proofObject.source_evidence_ref ?? null` as the resulting
  Chronicle field.

Therefore, in v0: package `created_from: null` and omission of the field's
effect are equivalent in outcome, because both drive the same constructor
fallback; package `created_from: null` does **not** force the output field
to `null` — when `proofObject.source_evidence_ref` is non-null, the
constructor fallback produces that non-null value instead. When
`proofObject.source_evidence_ref` is non-null, v0 has no force-null
representation for `created_from`; a future tagged fallback, force-null, or
exact-string-only mode would be a new profile or package revision and is not
introduced here.

### 8.6 `labels`

`labels` is an array of exact string members. The evaluator passes a fresh
array copy into construction. Exact string members and exact array order
are preserved. No normalization, deduplication, or sorting is performed by
this package contract.

### 8.7 `notes`

- string, including empty string: preserved exactly as `notes`.
- `null`: this field's constructor type already accepts `string | null`
  directly; `null` is passed through unchanged and produces output `null`.
- omission is package-invalid — `notes` is a required bundle field (§8.1)
  and MUST be present as either a string or `null`; where a host
  implementation's own internal call omits the option entirely, the
  constructor's own type-guard (`typeof options?.notes === "string" ?
  options.notes : null`) produces the same `null` result as explicit `null`.

### 8.8 Nullish-semantics summary

For the three constructor fields whose TypeScript contract is
`string | undefined` (`entryId`, `evidenceCapsuleRef`,
`provenanceSummaryRef`), bundle `null` is the package-level representation
of an *omitted* constructor option, and the adapter converts it to omission
before the call. For the two fields whose TypeScript contract already
accepts `string | null` (`createdFrom`, `notes`), bundle `null` is passed
straight through unchanged, and each field's own fallback or type-guard
behavior (§8.5, §8.7) determines the resulting output. This mapping is
deterministic, applies identically to every conformant implementation, and
is part of the package contract, not an implementation detail left open by
it.

A `source_entry_construction_options` object that violates any rule in this
section is malformed and MUST be rejected by §12 position 4, before this
adapter runs and before `source_evidence`, `source_proof_object`, or
`claimed_source_entry` are even inspected.

## 9. Notes application order

The package pins notes application exactly as follows:

1. construct and independently verify the deterministic aggregate with
   `profile_local_notes` fixed to `null`;
2. derive every commitment and the `aggregate_id` from that
   `profile_local_notes: null` construction;
3. apply the evaluation input's final `profile_local_notes` value (§7) to the
   aggregate;
4. independently validate the complete final aggregate, including the
   applied `profile_local_notes`, as the terminal check (§12 position 28).

`profile_local_notes` remains excluded from every commitment and from
aggregate identity (RSF profile §11.5, §12.3), but it is included in the
complete final canonical aggregate bytes.

Pinned future vector notes:

- SF-V1 input notes: `null`.
- SF-V1B input notes, both A and B: `null`.
- SF-C1 Object A notes: `null`.
- SF-C1 Object B notes: `"sf-c1"`.

## 10. Exact evaluation envelope and four-state model

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

### 10.1 Closed state model

Exactly four `(evaluation_state, profile_verdict, aggregate, finding)`
combinations are legal; no other combination is a conformant envelope:

| `evaluation_state` | `profile_verdict` | `aggregate` | `finding` |
|---|---|---|---|
| `"evaluated"` | `"accepted"` | complete aggregate object | `null` |
| `"evaluated"` | `"rejected"` | `null` | exactly one finding |
| `"unverifiable"` | `null` | `null` | exactly one finding |
| `"malformed"` | `null` | `null` | exactly one finding |

These four states are orthogonal by construction: `evaluated` always carries
a non-null `profile_verdict`; `unverifiable` and `malformed` never do.
`aggregate` and `finding` are never simultaneously non-null, and never
simultaneously null. There is no partial, provisional, or failure-shaped
aggregate anywhere in this package — an aggregate either is a complete,
fully valid object, or it does not exist in the envelope at all.

The envelope, its `finding`, and its `evaluation_state`/`profile_verdict`
fields exist entirely **outside** `recursive_singleton_aggregate.v0` — none
of them is included in the aggregate object, the aggregate identity seed
(RSF profile §12.1), or any aggregate commitment. This preserves the
profile's own §11.4 prohibition on absorbing render/runtime metadata into
aggregate identity, extended here to evaluator metadata generally. Forbidden
in the envelope, unconditionally: `generated_at`, wall-clock time, hostname,
process ID, runtime duration, UI metadata, repository-local absolute paths.

### 10.2 Exact accepted contract

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

`aggregate` is present and is a **complete** `recursive_singleton_aggregate.v0`
— every field of RSF profile §11.1, including `profile_local_notes` applied
per §9 above. `finding` is `null`. Every commitment and derived field in
`aggregate` independently verifies (recomputed and compared, not merely
copied from an input). The complete aggregate validates per RSF profile
§17.4–§17.6. No timestamp or runtime metadata is included anywhere in the
envelope or the aggregate.

### 10.3 Exact rejected contract

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "evaluated",
  "profile_verdict": "rejected",
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "source_receipt_root_mismatch",
    "check_position": 8
  }
}
```

`aggregate` is `null`. Exactly one deterministic profile-local `finding` is
present, whose `code` is the first-failing check's code per the fixed order
in §12. Use `evaluated`/`rejected` for structurally valid, evaluable input
that fails integrity recomputation, cross-object consistency, commitment
equality, eligibility, transition, no-elevation, identity derivation, or
final complete-aggregate validation.

### 10.4 Exact unverifiable contract

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "unverifiable",
  "profile_verdict": null,
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "source_admission_prerequisite_unavailable",
    "check_position": 8
  }
}
```

Use `unverifiable` only when the complete evaluation input is structurally
valid and the receipt-root admission prerequisite is unavailable —
currently only the case where `source_evidence.anchor.receipt_root` is
absent, so §6 step 8 cannot even be compared — and no validity or
eligibility judgment can be made. `profile_verdict` is `null`: unverifiable
is not a synonym for invalid. Absence of evaluation evidence MUST NOT become
invalidity — the evaluator reports that a determination could not be made,
not that the subject failed. This mirrors `docs/CHRONICLE.md` invariant 2,
applied one layer up to fold evaluation. `aggregate` is `null`. Exactly one
`finding` names the unavailable prerequisite.

### 10.5 Exact malformed contract

```json
{
  "schema": "recursive_singleton_fold_evaluation.v0",
  "evaluation_state": "malformed",
  "profile_verdict": null,
  "aggregate": null,
  "finding": {
    "schema": "recursive_singleton_fold_finding.v0",
    "code": "malformed_evaluation_input",
    "check_position": 1
  }
}
```

Use `malformed` only for structural or literal-contract failures occurring
before a well-typed evaluation candidate exists: malformed evaluation input;
wrong schema/profile literals; missing or unknown fields; malformed
source-admission bundle; wrong pinned shared-admission dependency literals;
malformed construction options; malformed evidence, proof object, source
entry, or declarations. `profile_verdict` is `null`. `aggregate` is `null`.
Exactly one `finding` identifies the first malformed boundary encountered,
per §12's fixed order.

### 10.6 Envelope consequences

Pinned consequences, exhaustively: `evaluated`/`accepted` implies aggregate
non-null and finding null; every other state implies aggregate null and
exactly one finding; host-language exceptions never choose canonical state
or canonical finding code; no partial aggregate is ever emitted.

## 11. Exact single-evaluation finding schema and closed vocabulary

Schema identifier: `recursive_singleton_fold_finding.v0`.

```json
{
  "schema": "recursive_singleton_fold_finding.v0",
  "code": "<one value from the closed enum below>",
  "check_position": 8
}
```

Exactly three closed fields are required, and no unknown field may appear:
`schema`, `code`, `check_position`. `check_position` is the 1-based integer
position, 1–28, per the exact evaluation order in §12, at which the finding
was raised. It exists so that finding identity is derived from check order,
not host-language exception order or free text. Explanatory text, stack
traces, and host exception strings are **forbidden** from canonical
evaluator output. Findings remain outside aggregate identity and every
aggregate commitment.

All codes below are **PROFILE-LOCAL — NOT A RECEIPTOS REASON CODE**,
consistent with the convention already used in the RSF profile and in
`docs/RECEIPTOS_VERIFIER_CHALLENGE_SET_V0_WORKING_DRAFT.md` §11's caution
against casually creating a second competing ReceiptOS vocabulary. None of
these codes reuses or aliases any `receiptos-chronicle-admission-v0`
`failure_class`/`reason_code` value or any Unanchored Issuance Witness
`reasonCode` enum value. The SF-C1 same-identity/non-identical-content
conflict is **not** in this enum — it is evaluated by a structurally
separate operation (§15) with its own closed vocabulary (§15.1), consuming
two already-valid aggregates, never a candidate still being validated for a
single fold.

Closed v0 enum: exactly **33** values.

### malformed — 10 codes

- `malformed_evaluation_input`
- `malformed_source_admission_bundle`
- `malformed_source_entry_construction_options`
- `malformed_source_entry`
- `malformed_source_evidence`
- `malformed_portable_proof_object`
- `malformed_fold_policy_declaration`
- `malformed_comparability_class_declaration`
- `malformed_transition_rule_declaration`
- `malformed_rsf_stage_input`

### unverifiable — 1 code

- `source_admission_prerequisite_unavailable`

### evaluated / rejected — 22 codes

- `source_receipt_root_mismatch`
- `cross_object_consistency_mismatch`
- `proof_object_identity_mismatch`
- `proof_reference_mismatch`
- `reconstructed_source_entry_mismatch`
- `source_entry_content_commitment_mismatch`
- `fold_policy_commitment_mismatch`
- `singleton_policy_ineligible`
- `comparability_class_commitment_mismatch`
- `singleton_class_ineligible`
- `transition_rule_commitment_mismatch`
- `semantic_statement_mismatch`
- `semantic_result_commitment_mismatch`
- `inclusion_set_mismatch`
- `inclusion_set_commitment_mismatch`
- `forbidden_source_identity_reuse`
- `transition_result_mismatch`
- `no_elevation_invariant_mismatch`
- `breakdown_mismatch`
- `breakdown_commitment_mismatch`
- `aggregate_id_mismatch`
- `complete_aggregate_validation_mismatch`

Totals: 9 + 1 + 22 = **32**. `malformed_evaluation_input` is legal only under
`evaluation_state: "malformed"`. `complete_aggregate_validation_mismatch` is
legal only under `evaluation_state: "evaluated"` and
`profile_verdict: "rejected"`.

This is a **single deterministic primary finding** vocabulary, not an
unordered multi-finding surface — RSF v0's strictly sequential,
single-source-object pipeline needs at most one terminal finding per
evaluation, never an array requiring a total order over co-occurring
findings.

## 12. Exact 28-position evaluation order

There is exactly one operative evaluation-order definition in this document.
It contains exactly 28 positions, grounded in RSF profile §17.4's
construction order and the existing Chronicle admission gate's exact check
sequence (`chronicle-portfolio-v0.ts`, lines 87–132). The first failed check
determines the single finding; host-language exception order MUST NOT define
semantics — a conformant evaluator MUST perform these checks in this fixed
order regardless of implementation language or control-flow structure.

| # | Check | On failure |
|---|---|---|
| 1 | Evaluation-input shape, unknown-field policy, and `schema`/`profile_id`/`profile_local_notes`-type literals (§7) | `malformed_evaluation_input` |
| 2 | Source-admission bundle shape and its exact pinned admission dependency literals (§5, §5.4) | `malformed_source_admission_bundle` |
| 3 | Nested source-admission containers present as objects (§6 step 3) | `malformed_source_admission_bundle` |
| 4 | Construction-options shape (§8) | `malformed_source_entry_construction_options` |
| 5 | Source evidence shape (`HandoffEvidence`) | `malformed_source_evidence` |
| 6 | Portable Proof Object shape (`PortableProofObjectV0`) | `malformed_portable_proof_object` |
| 7 | Claimed source-entry shape (`chronicle_entry.v0`) | `malformed_source_entry` |
| 8 | Receipt-root prerequisite and independent recomputation (§6 steps 8–9) | `source_admission_prerequisite_unavailable` if the prerequisite is absent; otherwise `source_receipt_root_mismatch` |
| 9 | Cross-object consistency (§6 step 10) | `cross_object_consistency_mismatch` |
| 10 | Proof-object identity (§6 step 11) | `proof_object_identity_mismatch` |
| 11 | Proof reference (§6 step 12) | `proof_reference_mismatch` |
| 12 | Chronicle admission gate call succeeds as a whole, receiving only the exact adapted options from §8 (§6 step 14) | no distinct code — every recognized failure here already maps to positions 8–11; an unrecognized implementation exception is an implementation failure, not canonical evaluator output |
| 13 | Reconstructed source-entry canonical-byte equality (§6 steps 15–17) | `reconstructed_source_entry_mismatch` |
| 14 | Source-entry content commitment derivation and retention — no equality comparison occurs at this position | No distinct code at this position; the derived value is later subject to position-28 preservation verification (`source_entry_content_commitment_mismatch`) |
| 15 | Fold-policy declaration shape, then commitment recomputation and equality | `malformed_fold_policy_declaration`, then `fold_policy_commitment_mismatch` |
| 16 | Comparability-class declaration shape, then commitment recomputation and equality | `malformed_comparability_class_declaration`, then `comparability_class_commitment_mismatch` |
| 17 | Transition-rule declaration shape, then commitment recomputation and equality | `malformed_transition_rule_declaration`, then `transition_rule_commitment_mismatch` |
| 18 | Stage input closed claim shape is validated and independently snapshotted; then singleton policy eligibility is derived from the verified policy and claimed cardinality | `malformed_rsf_stage_input`, then `singleton_policy_ineligible` |
| 19 | Singleton comparability eligibility is derived from the verified class and proof that the sole claimed member is the independently admitted prefix source | `singleton_class_ineligible` |
| 20 | Claimed input semantic statement is compared with a fresh local statement; then the claimed input commitment is compared with a fresh digest | `semantic_statement_mismatch`, then `semantic_result_commitment_mismatch` |
| 21 | Claimed canonical inclusion set is compared with a fresh singleton set; then its claimed commitment is compared with a fresh digest | `inclusion_set_mismatch`, then `inclusion_set_commitment_mismatch` |
| 22 | Transition construction: source identity is not reused as aggregate identity | `forbidden_source_identity_reuse` |
| 23 | Claimed output semantic statement is compared with a fresh local statement, its stored commitment is freshly verified, and output commitment is required to equal the position-20 input commitment | `semantic_result_commitment_mismatch` |
| 24 | Fresh input/output semantic-class descriptors are compared under the closed no-promotion predicate; only then is the candidate boolean compared | `no_elevation_invariant_mismatch` |
| 25 | `transition_result` is freshly derived from verified positions 22–24 and compared with the candidate object | `transition_result_mismatch` |
| 26 | `pre_aggregation_breakdown` constructed, then its commitment recomputed and equal | `breakdown_mismatch`, then `breakdown_commitment_mismatch` |
| 27 | `aggregate_id` recomputes from the exact RSF profile §12.1 seed | `aggregate_id_mismatch` |
| 28 | Final complete-aggregate validation: (a) both the prefix position-14 commitment and candidate stored commitment are compared against a fresh recomputation from the verified source; then (b) the frozen remaining 19 fields below are revalidated in order | (a) `source_entry_content_commitment_mismatch`; otherwise (b) `complete_aggregate_validation_mismatch`; success here alone yields the `accepted` envelope |

### 12.1 Adopted positions 18–28 stage boundary

The caller supplies a separate closed `recursive_singleton_fold_stage_input.v0`
with exactly `schema`, `claimed_input_semantic_statement`,
`claimed_input_semantic_result_commitment`, and `candidate_aggregate`. The
candidate is a complete 20-field claim, not an accepted aggregate. Position 18
validates field inventory, JSON types, and digest syntax only; semantic truth,
cardinality, and cross-field equality remain owned by their later positions.

The prefix continuation and stage input MUST each be independently copied once
into fresh strict-JSON-domain trees. Later reads use only those snapshots.
Caller mutation, insertion order, timing, admission labels, status literals,
and runtime metadata cannot establish carrier validity. Missing local proof is
never success. Recognized outcomes use the four-state envelope; impossible
host/programmer invariants throw outside it. No intermediate surface may emit
`accepted` or an equivalent verdict.

Position 22 uses candidate `aggregate_id` only as an untrusted operand and
requires it to differ from source `entry_id`; position 27 independently checks
that same candidate value against the exact profile §12.1 derivation.
Position 24 constructs fresh closed input/output semantic-class descriptors
and proves descriptor equality, preserved semantic commitment, source-ID
nonreuse, exact rule literals, absence of candidate promotion fields, and local
policy/class eligibility without reading the candidate boolean.

Position 28(b) checks exactly this remaining order after 28(a): `schema`,
`profile_version`, `aggregate_id`, `source_entry_ref`, `semantic_statement`,
`semantic_result_commitment`, `canonical_inclusion_set`,
`inclusion_set_commitment`, `fold_policy_declaration`,
`fold_policy_commitment`, `comparability_class_declaration`,
`comparability_class_commitment`, `transition_rule_declaration`,
`transition_rule_commitment`, `pre_aggregation_breakdown`,
`pre_aggregation_breakdown_commitment`, `transition_result`,
`no_stronger_semantic_class_created`, `profile_local_notes`. Generic unordered
deep equality is not the position-28 algorithm.

Semantic commitments hash repository-canonicalized strict JSON UTF-8 bytes.
Fixture manifests instead hash exact LF UTF-8 Git-index blob bytes. Checkout
materialization bytes never substitute for either domain. The adopted schemas
are the four `src/receiptos/schemas/recursive-singleton-*.schema.json` files;
the 34-vector package and two independent expected-value implementations are
under `tests/fixtures/recursive-singleton-fold-v0` and
`conformance/recursive-singleton-fold-v0`.

For every compound position: subchecks execute left-to-right exactly as
written; the first failing subcheck determines the one finding; shape
validation precedes commitment recomputation; semantic-statement,
inclusion-set, and breakdown object construction each precede their own
commitment verification. `semantic_result_commitment_mismatch` may occur at
position 20 (input-side derivation) or position 23 (output-side
preservation) — the position at which it is raised distinguishes a
derivation failure from a preservation failure. Position distinguishes these
two occurrences; the code alone does not.

#### Position 14 and position 28: derivation versus preservation verification

Position 14 produces and retains `source_entry_content_commitment`.
Position 28 exclusively owns the executable trigger for
`source_entry_content_commitment_mismatch`, through its named
preservation-verification subcheck. This subsection states how, without
changing the 28-position count. Adoption of the stage boundary adds exactly
one single-evaluation code, `malformed_rsf_stage_input`, making the vocabulary
33 codes.

Position 14 derives and retains `source_entry_content_commitment`: it
canonicalizes the complete position-13-verified `chronicle_entry.v0` object
with the repository `canonicalize()` and computes SHA-256 over the
resulting UTF-8 canonical bytes, per RSF profile §6.3, then carries the
result forward, unchanged, for reuse at position 20's semantic statement
(RSF profile §7.3), the assembled aggregate object (RSF profile §11.1), the
aggregate identity seed (RSF profile §12.1, position 27), the canonical
inclusion-set member (RSF profile §13.1), and the pre-aggregation breakdown
(RSF profile §14.3). No equality comparison occurs at position 14, and
position 14 carries no distinct finding code, mirroring the existing
position-12 convention of a position that performs a real operation
without owning a code of its own.

Position 28's subcheck (a) is where `source_entry_content_commitment` is
verified. Per §9's already-pinned notes application order, final
`profile_local_notes` is applied before position 28 begins (§9 steps 3–4);
position 28 does not apply notes itself and does not defer notes
application until after subcheck (a). Position 28 operates on the
complete final aggregate — notes already included — and, within that
single terminal validation, first compares the `source_entry_content_commitment`
value stored in that complete final aggregate against a fresh, independent
recomputation performed at position 28 from the same complete verified
source entry. This is the same
"stored-versus-freshly-recomputed" pattern already normative for every
other identity-bearing commitment in this profile (RSF profile §7.6, §8.4,
§9.4, §10.4, §13.4, §14.5: "consumers MUST NOT trust the stored commitment
without recomputation"); position 28 is simply where this profile's
existing pattern applies to `source_entry_content_commitment` specifically,
because — unlike the other identity-bearing commitments (declarations at
positions 15–17, `semantic_result_commitment` at positions 18/23,
`inclusion_set_commitment` at position 19, `pre_aggregation_breakdown_commitment`
at position 26) — no earlier position performs an equality comparison for
`source_entry_content_commitment` before position 28. Position 28 does not
retroactively make position 14 a comparison: the two-operand equality
exists only at position 28, where both a stored copy and a fresh
recomputation are genuinely and independently available; position 14
remains derivation-only.

Ownership after this clarification: `source_entry_content_commitment_mismatch`
remains one of the closed 33 finding codes, unchanged in name; its trigger
is position 28's named subcheck (a), not position 14. Within position 28,
first-finding semantics (the paragraph above) applies to its own ordered
subchecks exactly as it already applies to every other compound position in
this table: subcheck (a) executes before subcheck (b), and the first
failing subcheck determines the one finding for the entire evaluation.

This clarification changes none of: the seven evaluation-input fields
(§7.2); the source-admission bundle shape (§5); the `chronicle_entry.v0`
shape (RSF profile §6.2); the `recursive_singleton_aggregate.v0` shape (RSF
profile §11.1); the closed 33-code finding vocabulary (§11); the 28-position
count (§12) — still exactly 28 rows;
first-finding semantics; the existing `canonicalize()`; the current
implementation boundary (positions 1–17 implemented and wired into the ordered prefix
evaluator `evaluateRsfPrefixThroughPosition17` — a prefix evaluator only, not the complete
positions 1–28 evaluator; positions 18–28 remain unimplemented); package identity; or
Chronicle behavior. It introduces no new
carrier, no `profile_sha256`, no package digest, and no runtime
configuration.

### 12.1 Authoritative declaration commitments

Positions 15–17 recompute a commitment and compare it for equality, but this
document has not previously stated where the expected value comes from. This
subsection pins that source. It does not implement positions 15–17.

#### Immutable reference-package pins

This reference package normatively pins exactly three expected SHA-256
commitments, one for each declaration field checked at positions 15–17. Each
pin is a normative constant of the exact committed reference-package
revision in which this subsection appears, not of any evaluation input.

| Position | Declaration field | Canonicalization rule | Digest algorithm | Expected commitment (lowercase hex SHA-256) |
|---|---|---|---|---|
| 15 | `fold_policy_declaration` | repository `canonicalize()` (§7.4) over the complete declaration object (RSF profile §8.1) | SHA-256 over the resulting UTF-8 canonical bytes | `9c9617921b764cbdea0d2674e397a8a687e28a4a8f25ea4056515a1175b5455f` |
| 16 | `comparability_class_declaration` | repository `canonicalize()` (§7.4) over the complete declaration object (RSF profile §9.1) | SHA-256 over the resulting UTF-8 canonical bytes | `7a11e0f99232c5a0c41823551ca43064becd870b8f6abb941fc8820b57f088ed` |
| 17 | `transition_rule_declaration` | repository `canonicalize()` (§7.4) over the complete declaration object (RSF profile §10.1) | SHA-256 over the resulting UTF-8 canonical bytes | `d5fa45fb6ab73c58d14a635d3ba7b899d653a73a133360b8e7ca7e530cfee25c` |

Each pinned value was independently recomputed from the complete canonical
inline declaration object at RSF profile §8.1, §9.1, and §10.1 respectively;
none is asserted without a recomputable derivation.

#### Commitment subject

The subject of each pin is the complete declaration value, not its source
formatting. Precisely:

- the subject is the complete `fold_policy_declaration`,
  `comparability_class_declaration`, or `transition_rule_declaration` value,
  taken as a whole;
- the value MUST first satisfy the already-defined closed singleton shape for
  that declaration before its commitment is meaningful;
- canonicalization uses the existing repository `canonicalize()` (§7.4), the
  same canonicalizer already normative for this evaluation input;
- hashing is SHA-256 over the resulting UTF-8 canonical bytes;
- Markdown formatting, source whitespace, Git blob line endings, host object
  identity, and object member insertion order are not commitment inputs — the
  commitment subject is the abstract JSON-domain value, not any particular
  serialization of it.

#### Authority and lifecycle

- These three pins are normative constants of the exact committed
  reference-package revision containing this subsection. They are package
  constants, not evaluator-supplied assertions, and are never read from the
  evaluation input itself.
- An implementation claiming conformance to these pins MUST identify and use
  that exact committed revision. During the working-draft phase, this
  committed Git revision is the publication locator for the pin set; this
  document does not yet define a permanent reference-package version
  identifier or whole-package commitment.
- Git commit identity, so used, is external publication metadata: it is not
  part of the seven-field RSF evaluation input (§7.2), not a profile digest,
  not a package digest, not an RSF finding, and not an evaluation position.
  It does not alter the seven-field input in any way.
- Local configuration, network registries, mutable profile lookup, Chronicle
  state, environment variables, and hidden constructor options are not
  authoritative sources for these pins.
- A future revision that changes any pinned declaration value MUST publish a
  distinct committed revision; a pin MUST NOT change silently within the same
  committed revision.
- This clarification does not define a new package digest and does not
  restore, rename, imply, or reserve the removed `profile_sha256` field
  (§7.2). The three pins above are declaration-level commitments, not a
  whole-package or whole-profile digest.
- This clarification does not define the permanent package-versioning or
  freeze mechanism. Future frozen/package-version identity remains governed
  by the existing §21 promotion-gate discipline, which already states that
  the whole package is not frozen today and carries no whole-package SHA-256.
  This does not unset the narrower §12.1 normative fixture-set hash.

#### Evaluation relationship

- After the already-defined structural prerequisite for a position succeeds,
  positions 15–17 recompute the corresponding declaration's commitment from
  its complete canonical inline value.
- The recomputed value is compared against the package pin for that
  position, from the table above.
- Ownership of a mismatch remains with the already-defined finding and
  position (§11, §12): `fold_policy_commitment_mismatch` at position 15,
  `comparability_class_commitment_mismatch` at position 16,
  `transition_rule_commitment_mismatch` at position 17.
- This clarification does not implement positions 15–17. It pins the
  expected-commitment values those positions will compare against once
  implemented; it introduces no new finding code, no new check position, and
  no new result envelope.
- Semantic support for a declaration — whether its content is fit for a
  particular evaluation — remains a distinct and later question from
  structural closure (the position-15/16/17 shape checks) and commitment
  equality (the position-15/16/17 hash checks). A structurally closed,
  commitment-matching declaration is not thereby asserted to be semantically
  supported.

#### Missing-package behavior

- An implementation cannot claim conformance to these pins unless it has
  identified and holds the exact committed reference-package revision
  described above.
- Absence of the identified committed revision, or an implementation's
  inability to resolve it, is an evaluator/package setup failure that occurs
  before RSF evaluation begins. It is not a new RSF finding and not a new
  position.
- This clarification inserts no parser, package-resolution, or
  missing-carrier finding before position 1, and defines no transport or API
  error envelope (§7.0).

#### Commitment-mismatch reachability in v0

This subsection clarifies the reachability of the three position-15/16/17
commitment-mismatch findings from conforming, shape-valid external input in
v0. It changes no field, pin, finding, or position; it names an already-true
consequence of the closed exact-literal declaration domains defined by RSF
profile §8.1, §9.1, and §10.1.

**Evaluation order.** For each of positions 15, 16, and 17, an evaluator
MUST, in order: (1) validate the complete declaration against its
position-owned exact closed declaration object; (2) on shape failure, emit
the position-owned malformed-declaration finding
(`malformed_fold_policy_declaration`, `malformed_comparability_class_declaration`,
or `malformed_transition_rule_declaration`) and stop; (3) only after shape
success, canonicalize the complete declaration value with the repository
`canonicalize()` (§7.4); (4) compute SHA-256 over the resulting UTF-8
canonical bytes; (5) compare the digest against the corresponding package
pin from the table in this section; (6) on inequality, emit the
position-owned commitment-mismatch finding (`fold_policy_commitment_mismatch`,
`comparability_class_commitment_mismatch`, or
`transition_rule_commitment_mismatch`). Shape validation gates commitment
recomputation; commitment recomputation never runs before shape success, and
never runs on a value shape validation has already rejected.

**Closed exact-literal domain.** In v0, every member of
`fold_policy_declaration`, `comparability_class_declaration`, and
`transition_rule_declaration` is fixed by RSF profile §8.1, §9.1, or §10.1
respectively to one normative literal value — this includes, without
exception, `member_cardinality` (exact literal `1`), `admission_required`
(exact literal `true`), and `fail_closed_on_malformed_or_unknown_input`
(exact literal `true`), as well as every string-valued member of all three
declarations. A value alteration to any member, of any type, is not a
shape-valid alternative policy, class, or rule. It is malformed at the same
position, under the position-owned malformed-declaration finding.

**Reachability.** Because shape success at positions 15, 16, or 17 proves
the supplied declaration is, member for member, identical to the exact
declaration object pinned by RSF profile §8.1, §9.1, or §10.1, a conforming
shape-valid external input has no alternative abstract JSON-domain value
that could legitimately differ from the corresponding package pin in this
section. Consequently, `fold_policy_commitment_mismatch`,
`comparability_class_commitment_mismatch`, and
`transition_rule_commitment_mismatch` are not expected to be reachable from
conforming, shape-valid external input in v0. This statement is scoped to
external input reaching a correctly functioning implementation; it does not
address internal implementation corruption, which is covered below.

**Integrity role.** The commitment comparison at each of positions 15, 16,
and 17 remains mandatory and MUST NOT be skipped, weakened, or treated as
optional on the basis of the reachability statement above. If shape
validation succeeds but the recomputed commitment differs from the
normative pin, the evaluator MUST still fail closed with the position-owned
commitment-mismatch finding. Such an outcome is an integrity/invariant
inconsistency involving at least one of: the embedded declaration value as
actually supplied at runtime, the normative package pin used by the
implementation, canonicalization, UTF-8 encoding, SHA-256 computation, or
implementation behavior. This clarification does not prescribe which
component is defective in that event; it only establishes that the
comparison exists to catch exactly this class of inconsistency, and that
the resulting finding remains a legitimate, fail-closed evaluator outcome
rather than a defect in the finding's definition.

**Conformance vectors.** A conforming test suite for positions 15, 16, and
17 MUST test exact-declaration success, MUST test malformed-declaration
ownership for every altered key or value, and MUST independently verify
canonical bytes and the pinned hashes against the repository's
`canonicalize()` and synchronous SHA-256 helper. A conforming test suite
MUST NOT weaken exact-literal shape semantics merely to manufacture a
commitment-mismatch witness, and is not required to produce a shape-valid
external-input witness for an invariant-only mismatch outcome.

**Contract preservation.** This clarification changes none of: the seven
evaluation-input fields (§7.2); the `fold_policy_declaration`,
`comparability_class_declaration`, and `transition_rule_declaration`
objects (RSF profile §8.1, §9.1, §10.1); the three package pins in this
section; the closed 33-code finding vocabulary (§11); the 28-position
evaluation order (§12); first-finding semantics; the existing
`canonicalize()`; package identity; or the current public-evaluator
implementation boundary. Positions 1–17 are wired into the ordered prefix evaluator
`evaluateRsfPrefixThroughPosition17` — a prefix evaluator only: success through
position 17 does not mean the complete RSF evaluation is accepted, no aggregate is
constructed or returned, and the prefix evaluator emits no
`recursive_singleton_fold_evaluation.v0`, `evaluation_state`, `profile_verdict`, or other
final four-state outcome. Positions 18–28 remain unimplemented, the complete
positions 1–28 evaluator does not yet exist, and positions 18–28 are not represented as
passed by this clarification or by positions 1–17.

## 13. Exact SF-V1 package contract

Package materials required for the one deterministic valid singleton fold are
represented by the adopted §12.1 fixture bytes. Their presence does not claim
that a production evaluator exists:

- one complete `recursive_singleton_fold_evaluation_input.v0` (§7), with
  `profile_local_notes: null`, whose bundle is sufficient to pass §12
  positions 1–13;
- the exact `fold_policy_declaration`, `comparability_class_declaration`, and
  `transition_rule_declaration` objects (RSF profile §8.1, §9.1, §10.1
  literals, used verbatim), carried inside the evaluation input, not as
  separate loose arguments;
- the expected **accepted** evaluation envelope (§10.2), whose `aggregate` is
  the complete expected aggregate with `profile_local_notes: null`;
- every commitment listed in RSF profile §11.2 and the §12.1 identity seed,
  each independently derivable by a second implementation from the same
  evaluation input;
- an `aggregate_id` distinct from `claimed_source_entry.entry_id` (§12
  position 22);
- the recomputed `transition_result` (§12 position 24) and
  `no_stronger_semantic_class_created` result (§12 position 25);
- no timestamps or generated metadata anywhere in the evaluation input,
  envelope, or aggregate.

## 14. Exact SF-V1B replay contract

SF-V1B uses two separate files, not one file reused twice:

- `vectors/sf-v1b/input-a.json`
- `vectors/sf-v1b/input-b.json`
- `vectors/sf-v1b/expected-a.json`
- `vectors/sf-v1b/expected-b.json`

Pinned requirements:

- `input-a.json` and `input-b.json` are byte-identical, and their manifest
  SHA-256 values are identical;
- both are separately read and independently parsed from their own file
  bytes — not one object instance reused, not a shared parse result;
- each complete evaluation input carries its own complete nested source
  bundle and declarations;
- both use `profile_local_notes: null`;
- two separate reference-evaluator invocations are mandatory, each
  independently producing a complete accepted evaluation envelope;
- `expected-a.json` and `expected-b.json` are byte-identical accepted
  envelopes.

Required equality between the two invocations' results: complete accepted
evaluation envelopes (§10.2), byte-for-byte; complete canonical aggregate
bytes; every commitment; every derived field; `aggregate_id`;
`transition_result`; the no-elevation result.

Not required by SF-V1B: separate operating systems; separate programming
languages; the independent second implementation (§20) — that is a separate,
later promotion-gate concern, not a component of replay-determinism itself.

SF-V1B proves replay idempotency only. It is not the independent second
implementation.

## 15. Exact SF-C1 pairwise contract

### 15.1 A separate artifact, not an overload of §10's envelope

SF-C1 is evaluated by a structurally distinct operation from §10's
single-object fold evaluation. The pairwise evaluator's input is two
independently valid, complete `recursive_singleton_aggregate.v0` objects,
carried inside an ordered pairwise input artifact, not a source-admission
bundle, and its output is a separate schema.

Exact pairwise input schema: `recursive_singleton_fold_pairwise_input.v0`.

```json
{
  "schema": "recursive_singleton_fold_pairwise_input.v0",
  "object_a": {
    "...": "complete recursive_singleton_aggregate.v0"
  },
  "object_b": {
    "...": "complete recursive_singleton_aggregate.v0"
  }
}
```

All three fields (`schema`, `object_a`, `object_b`) are required; no unknown
field may appear. This is an ordered pair: `object_a` is validated before
`object_b`, no symmetric normalization occurs in v0, and swapping A and B
creates a distinct deterministic input whose output preserves the supplied
A/B order.

Exact pairwise finding schema: `recursive_singleton_fold_pairwise_finding.v0`.

```json
{
  "schema": "recursive_singleton_fold_pairwise_finding.v0",
  "code": "malformed_object_a"
}
```

Closed pairwise malformed codes — exactly 3:

- `malformed_pairwise_input`
- `malformed_object_a`
- `malformed_object_b`

These codes are distinct from, and never reused with, the §11
single-evaluation malformed codes; the pairwise finding remains
profile-local and outside both aggregate identities.

Validation order: (1) outer pairwise-input shape; (2) `object_a` complete
aggregate validation; (3) `object_b` complete aggregate validation; (4)
pairwise conflict comparison. If both A and B are invalid,
`malformed_object_a` wins, because A is validated first.

### 15.2 Exact pairwise conflict output

Exact output schema: `recursive_singleton_fold_pairwise_conflict.v0`.

**Malformed form:**

```json
{
  "schema": "recursive_singleton_fold_pairwise_conflict.v0",
  "conflict_state": "malformed",
  "conflict_verdict": null,
  "object_a_aggregate_id": null,
  "object_b_aggregate_id": null,
  "finding": {
    "schema": "recursive_singleton_fold_pairwise_finding.v0",
    "code": "malformed_object_a"
  }
}
```

`conflict_state` is `"malformed"`; `conflict_verdict` is `null`; both
aggregate-id fields are `null`; exactly one pairwise finding is present,
using one of the 3 codes in §15.1.

**Evaluated form:**

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

`conflict_state` is `"evaluated"` only once both objects independently
validate as complete aggregates (§12, positions 1–28, run once per object as
an ordinary accepted single-object evaluation, prior to pairwise
comparison). `conflict_verdict` is exactly one of
`"same_identity_nonidentical_content_conflict"` or `"no_conflict"`; the
aggregate-id fields preserve A/B order; `finding` is `null`.

- `same_identity_nonidentical_content_conflict`: both aggregates
  independently validate, share `aggregate_id`, and have non-identical
  complete canonical bytes.
- `no_conflict`: both aggregates independently validate, and either their
  `aggregate_id`s differ, or their complete canonical bytes are identical.

The pairwise conflict result — the whole
`recursive_singleton_fold_pairwise_conflict.v0` object — remains **outside
both aggregate objects and outside their identities**, exactly as the
single-object evaluation envelope (§10) remains outside the aggregate it
wraps.

### 15.3 Exact pinned future pair

- Object A: `profile_local_notes: null`.
- Object B: `profile_local_notes: "sf-c1"`.

Both objects must: independently pass complete validation (§12) as their own
complete aggregates before the pairwise evaluator ever compares them; share
every identity-bearing field (RSF profile §11.2); share every independently
recomputed commitment; therefore share the same `aggregate_id`; differ only
in complete canonical aggregate bytes, via `profile_local_notes` (RSF
profile §11.5 and profile §20).

Required resulting semantics: `conflict_state: "evaluated"`,
`conflict_verdict: "same_identity_nonidentical_content_conflict"`; no
update; no merge; no replacement; no reinterpretation; no silent
deduplication. Changing `profile_local_notes` from `null` to `"sf-c1"` does
not require changing or recomputing any identity-bearing value.

### 15.4 Separation from adjacent cases

This conflict is distinguished from, and must not be conflated with:

- a **structure-to-commitment mismatch** (RSF profile §20.1) — an internally
  invalid aggregate whose inline structure was changed while its stored
  commitment was not; this fails closed as `malformed` in the *single-object*
  evaluation (§10) and never reaches the pairwise evaluator as valid input;
- **policy mismatch**, **class mismatch**, **non-comparability**, and
  **fold ineligibility** — all single-object rejection outcomes (§10.3,
  codes `singleton_policy_ineligible`, `singleton_class_ineligible`, and
  related commitment-mismatch codes), never pairwise outcomes;
- **malformed pairwise input** generally — caught by `conflict_state:
  "malformed"` (§15.2), distinct from a genuine same-identity conflict
  between two individually-valid objects.

## 16. Aggregate validation and conflict separation

`recursive_singleton_aggregate.v0` is used here exactly as pinned by the RSF
profile — this document does not silently alter the RSF profile's formulas
or invariants. To summarize the boundary drawn across §10–§15: a
`recursive_singleton_aggregate.v0` object is either **completely valid**
(every commitment, derived field, and `aggregate_id` independently
recomputes and matches, confirmed at §12 position 28) or it does not exist
as an output at all — there is no partially-valid or failure-shaped
aggregate anywhere in this package (§10.3's rejected envelope has
`aggregate: null`, never an aggregate-shaped object carrying a failure
status).

Given that binary validity boundary, exactly one further question can be
asked of two already-valid aggregates: do they conflict per §15? That
question is answered by a separate artifact precisely because it presupposes
both inputs already cleared the single-object validity bar — it is not a
third possible outcome of single-object evaluation. A pairwise malformed
result is not the same thing as a valid same-identity non-identical-content
conflict. A single-evaluation malformed code is not reused as a pairwise
malformed code (§15.1). A malformed aggregate is not accepted merely because
it carries a claimed aggregate identity.

## 17. Manifest and fixture-set identity mechanics

Candidate future package mechanics, defined here without creating any file:

- **Path ordering**: every manifest lists package-relative paths in sorted
  (unsigned UTF-8 byte-wise) order — the convention already used by
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
- **`manifest.json` is package-carried but self-excluded**: it MUST NOT be
  listed in its own `files` array, and it MUST NOT contribute to its own
  `fixture_set_sha256` — no circular self-hash exists. Every other
  identity-bearing package file appears exactly once in `files`.
- **Fixture-set identity**: `fixture_set_sha256` is the SHA-256 over the
  exact UTF-8 concatenation of `<path><TAB><lowercase-sha256><LF>` for every
  entry of the sorted `files` array — the exact convention already used by
  both existing fixture packages.
- **README inclusion**: a package README, when package-carried, is listed in
  `files` and contributes to `fixture_set_sha256` — matching the actual
  shared-admission precedent, where the README is included through
  `manifest.files` while the manifest itself is not.
- **Manifest completeness**: no unknown path may appear in a manifest that
  does not correspond to a real package file, and no normative package file
  may be absent from its package's manifest.

Future artifacts that MUST enter such a manifest, once they exist: the
frozen profile text's own hash record; all 8 schema files (§18); all
fixture/vector JSON for SF-V1, SF-V1B, SF-C1; all expected-output JSON; the
manifest itself (hashed into its own `package_version`/`files` metadata, but
excluded from the `fixture_set_sha256` it lists).

Excluded from any such manifest: implementation source files (evaluator,
validators, TypeScript types), test runner files, and any diagnostic or
research-only tooling — mirroring the existing exclusion of
`tests/blind-diff/` from the Unanchored Witness package's manifest.

## 18. Candidate implementation and package paths

Every path below is a **candidate, not canonical**, chosen to match existing
repository layout conventions observed in `src/receiptos/schemas/`,
`src/receiptos/capsule/`, `tests/fixtures/`, `tests/receiptos/`, and
`conformance/`. No file at any of these paths is created by this pass.

### 18.1 Exactly 8 runtime schema candidates

- `src/receiptos/schemas/recursive-singleton-fold-source-admission-bundle-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-evaluation-input-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-evaluation-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-finding-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-pairwise-input-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-pairwise-conflict-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-fold-pairwise-finding-v0.schema.json`
- `src/receiptos/schemas/recursive-singleton-aggregate-v0.schema.json`

### 18.2 Vector-material candidates

- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1/input.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1/expected.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/input-a.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/input-b.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/expected-a.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-v1b/expected-b.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-c1/input.json`
- `tests/fixtures/recursive-singleton-fold-v0/vectors/sf-c1/expected.json`

### 18.3 Other candidate locations

- TypeScript types and validators:
  `src/receiptos/capsule/recursive-singleton-fold-v0.ts`
- reference evaluator (source-admission recomputation + single-object fold):
  the same module, or a sibling
  `src/receiptos/capsule/recursive-singleton-fold-evaluator-v0.ts`
- pairwise conflict evaluator:
  `src/receiptos/capsule/recursive-singleton-fold-pairwise-conflict-v0.ts`
- manifest: `tests/fixtures/recursive-singleton-fold-v0/manifest.json`
- README: `tests/fixtures/recursive-singleton-fold-v0/README.md`
- dependency-identity record: carried inside `manifest.json`'s own package
  metadata (`admission_profile_id`/`admission_fixture_set_sha256`), not a
  separate file
- package-integrity tests:
  `tests/receiptos/recursive-singleton-fold-vectors.test.ts`
- focused semantic tests: `tests/receiptos/recursive-singleton-fold-v0.test.ts`
- runner: the package-integrity test file above serves as the candidate
  runner entry point, mirroring `shared-chronicle-admission-vectors.test.ts`
- independent-second-implementation comparison artifacts (mirroring the
  existing `conformance/chronicle-checkpoint-continuity-v0/` precedent):
  `conformance/recursive-singleton-fold-v0/`

No new repository is introduced.

## 19. Reference implementation boundary

This working draft does not introduce and does not implement or change:
schemas; TypeScript types; validators; evaluators; fixtures; vectors;
manifests; runners; conformance tooling; RSF profile formulas; Chronicle
schemas; shared admission v0 bytes; or shared admission v1 status.

It does not freeze the package in this pass, and it does not make a
conformance claim.

## 20. Independent second-implementation boundary

The later, separate second implementation of this reference package must:

- be separately authored;
- use a separate language, or a genuinely independent code path from the
  reference evaluator;
- not import reference evaluator helpers — canonicalization, commitment
  derivation, and check-ordering logic must be independently implemented,
  not shared via library import;
- independently implement canonicalization and every commitment derivation;
- consume the frozen profile and the frozen version of this package
  contract, once both are frozen — not a working draft of either;
- independently produce SF-V1, SF-V1B, and SF-C1 results;
- freeze its own implementation identity before expected outputs are
  revealed, where practical;
- preserve and classify any disagreement with the reference evaluator's
  outputs, rather than silently discarding it;
- never patch its outputs merely to match the reference evaluator when a
  disagreement is found — a genuine disagreement must be investigated and
  classified, not papered over.

This document does not begin that implementation, and does not decide its
language or repository location beyond the candidate note in §18.3.

## 21. Promotion gates

Before any file described in §18 as a candidate path may be created as real,
canonical package content, the following must hold, mirroring the RSF
profile's own §23 promotion-gate discipline:

- both the RSF profile itself and this package contract must be separately
  reviewed and frozen in the future, each with its own pinned SHA-256,
  before whole-package executable promotion; neither whole document is frozen
  today. This gate does not reopen the expressly adopted §12.1 positions
  18–28 contract and fixtures;
- the source-admission bundle shape (§5), the evaluation-input artifact
  (§7), the construction-options adapter (§8), the evaluation envelope shape
  (§10), the finding vocabulary (§11), the 28-position evaluation order
  (§12), and the pairwise conflict artifact (§15) must all be stable across
  that review with no open semantic questions;
- schemas must be reviewed and package files must be reviewed;
- SF-V1, SF-V1B, and SF-C1 expected outputs must be generated and reviewed
  before being treated as frozen fixtures;
- a reference implementation must be complete;
- an independent second implementation (§20) must be complete, and its
  outputs compared, with any disagreement preserved and classified, before
  this package is treated as promotion-ready;
- LF-only/no-BOM/Git-index-byte integrity checks (§17) must pass for every
  package file, and semantic tests must pass.

This documentation correction satisfies none of those gates. It only pins
the packaging and evaluator-contract text that must exist before any of that
work could begin.

## 22. Summary

This working draft pins, without freezing, one coherent reference-package
contract for the Recursive Singleton Fold Profile v0:

1. a `recursive_singleton_fold_source_admission_bundle.v0` object, bound to
   the exact current shared admission v0 package identity, sufficient for
   any conformant implementation to independently reconstruct and admit a
   claimed `chronicle_entry.v0` without trusting a producer-supplied verdict
   or `entry_id` alone (§5–§6);
2. one closed `recursive_singleton_fold_evaluation_input.v0` artifact and its
   exact Chronicle construction-options adapter, so that constructor
   fallback semantics — including `created_from`'s
   `options?.createdFrom ?? proofObject.source_evidence_ref ?? null` — are
   never left ambiguous (§7–§9);
3. a `recursive_singleton_fold_evaluation.v0` envelope with a closed
   four-state model (accepted / rejected / unverifiable / malformed), a
   single deterministic profile-local finding per failed evaluation drawn
   from a closed 33-code vocabulary, and one fixed 28-position evaluation
   order (§10–§12);
4. exact SF-V1, SF-V1B, and SF-C1 package contracts, including a
   structurally separate `recursive_singleton_fold_pairwise_conflict.v0`
   artifact with its own closed 3-code malformed vocabulary, so that
   same-identity/non-identical-content conflicts are never confused with
   single-object fold failures (§13–§16);
5. non-circular manifest and fixture-set identity mechanics, a full
   candidate-path inventory including all 8 runtime schemas, and the
   promotion gates that must hold before any of it becomes canonical
   (§17–§21).

No RSF profile formula, Chronicle schema, existing shared-admission package,
ReceiptOS reason code, scoring mechanism, or reputation concept is changed.
The documents remain working drafts except for the expressly adopted
positions 18–28 normative closure in §12.1. Those package bytes are frozen as
an implementation-independent contract; no production evaluator is supplied.
