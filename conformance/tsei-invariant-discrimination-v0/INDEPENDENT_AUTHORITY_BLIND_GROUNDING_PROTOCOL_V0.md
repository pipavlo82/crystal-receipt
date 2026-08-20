# Independent Authority Blind Grounding Protocol v0

Methodology / protocol artifact after PR #201. This artifact does **not**
create Object A, blind cases, an internal oracle, a real commitment nonce,
or production grounding evidence. It **selects Rekor v1** as the frozen
provider for a later run. Dummy-gate PASS is eligibility only. This
artifact does **not** mint PROVEN grounding and does **not** create
Object A.

**Status:** `PROVIDER_POLICY_FROZEN_PRE_OBJECT_A`
**Originator:** Pavlo Tvardovskyi
**Authority for this proposed run:** Merlini
**Reference scaffold:** PR #201, TSEI independent-authority scaffold v0
**Runtime TSEI Specification:** unchanged
**Text rule:** LF only
**Important:** this document contains **no blind cases and no attribution
answers**.

Public independent-grounding statuses remain exactly:

```
UNPROVEN | DISAGREED | PROVEN
```

`SPECIFICATION_DEFECT` is not a status.

```
provider_selected = true
DECLARED_PROVIDER_SELECTION = rekor-v1
DECLARED_PRODUCTION_PROVIDER = rekor-v1
```

Generic provenance cannot mint `VALID_PROVENANCE`. Synthetic provenance
cannot become production-publishable.

## 1. Purpose

This protocol defines one bounded external-authority experiment for the
fifth TSEI conformance rung:

```
declared
→ discriminating
→ attribution-consistent
→ causally-supported
→ independently-grounded
```

The internal scaffold already proves that the final rung cannot be minted
by the same system that authored the mutant/harness/oracle.

This protocol therefore defines how a real external party may independently
derive an attribution result for a **new blind instance**, how that result
is frozen, how provenance is verified, and how agreement or disagreement
is reported without reconciliation.

The experiment is designed to preserve four principles:

> **Faithfulness before discrimination.**

> **No amount of work from inside closes a claim whose missing ingredient
> is an external second party.**

> **Non-arrival is not disagreement or failure.**

> **Disagreement remains observable; it is never silently reconciled.**

## 2. Claim boundary for this run

The proposed authority has prior exposure to the surrounding
protocol/research line. That relationship is declared **before any
instance exists**.

```
authority_relationship_class = EXTERNAL_PRIOR_PROTOCOL_EXPOSURE
external_controller = true
prior_protocol_exposure = true
prior_collaboration_on_related_protocol_work = true

required_for_trial:
prior_access_to_this_instance_answers = false
prior_access_to_internal_oracle_reveal = false
```

These relationship facts are protocol-side declarations. They are **not**
trusted merely because Object B claims them. Class:
`DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED`.

A successful run may therefore support the bounded claim:

```
externally derived attribution
under prior protocol exposure
with blind instance answers undisclosed before authority freeze
```

It must **not** be described as proving that the authority was unfamiliar
with the protocol or school of reasoning.

A stronger later publication claim may use a separate new blind instance
with another authority under a stricter relationship policy. Such a future
run must not reuse this instance.

```
authority_semantic_judgment = HUMAN_PRIMARY
authority_assistant_role    = MECHANICAL_ONLY
originator_semantic_judgment = HUMAN_PRIMARY
originator_assistant_role    = MECHANICAL_ONLY
class = DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED
```

`MECHANICAL_ONLY` is narrowly: serialization, byte-exactness, schema
validation, deterministic ordering, hashing, commitment
construction/checking, provider-proof verification, exact-set
comparison. It excludes deciding which invariant a blind mutation
violates.

These are **predeclared conditions of the experiment**. A later result is
bounded by them. They are **not** independently proven merely because they
appear in an artifact or result blob. They MUST NOT mint
`VALID_PROVENANCE`, satisfy external-controller provenance, satisfy
provider verification, create PROVEN by themselves, prove absence of AI
semantic assistance, or prove metaphysical independence.

If the condition changes during a real run, abandon the instance; do not
silently continue under the old claim boundary.

## 3. No retroactive blindness

PR #200's published instance is **permanently ineligible** for independent
grounding by a later blind run. There is no retroactive blindness: the
#200 cases, oracle, and attribution sets were authored in one authority
and are already public to this repository.

This protocol requires:

```
NEW instance_id
NEW Object A
NEW concrete cases
NEW internal oracle
NEW nonce / hiding commitment
NEW Object B
```

No previously disclosed answer-bearing fixture may be reused as the
blind trial. A future second-authority run requires another NEW Object A.
Reusing A, cases, oracle, nonce, or B from a prior instance is not a
blind run.

## 4. Roles

### 4.1 Originator

The Originator:

- constructs the new blind Object A;
- verifies Object A faithfulness;
- derives an internal oracle privately;
- commits to that oracle before the Authority freezes Object B;
- does not disclose the oracle before Object B is frozen;
- later reveals the oracle exactly;
- runs the provider-specific provenance verifier and exact comparison.

### 4.2 Authority

The Authority:

- receives the exact Object A bytes;
- receives no expected attribution answers;
- receives no evaluator outputs;
- receives no executable predicate implementation that computes the
  Originator's answer;
- derives the violated-invariant attribution set independently from the
  normative definitions and concrete values in A;
- freezes/publishes exact Object B bytes through the agreed provider path;
- does not receive the Originator's oracle reveal until Object B is frozen.

### 4.3 Witness / provenance provider

The provider is an external append-only or otherwise cryptographically
ordered witness selected **before Object A is created**.

The provider-specific verifier must establish the declared provenance
policy from provider-observed data, not from self-reported fields in
Object B.

This lane selects Rekor v1 (`https://rekor.sigstore.dev`, hashedrekord
`0.0.1`) as the frozen provider. Dummy-gate PASS is eligibility only and
does not create Object A or mint PROVEN.

## 5. Four-object model

### 5.1 Object A — Blind problem package

A is internally authored but authority-visible. It is **not created in
this lane**.

Allowed top-level fields:

```
schema
instance_id
evaluation_instruction
invariants
cases
```

Allowed invariant fields:

```
invariant_id
normative_definition
normative_definition_identity
```

Allowed case fields:

```
mutant_id
baseline
mutated
```

Object A must not contain:

```
expected attribution
expected-attribution digest
internal oracle
evaluator output
reference evaluator output
executable harness predicate
predicate source
serialized function
internal implementation import
implementation-derived answer
artifact_digest
```

`problem_package_sha256` is the SHA-256 of the exact Object A bytes,
computed **outside** A. A MUST NOT contain `artifact_digest`.

Natural-language semantic steganography is outside the claim. The protocol
minimizes answer-bearing structure but does not claim to prove that
arbitrary prose can never contain a hint.

### 5.2 Object B — Authority oracle payload

B is authored by the external Authority.

B contains only the Authority's independently derived exact attribution
result for the frozen A.

Normative conceptual shape:

```
schema
instance_id / problem-package binding
cases: each mutant_id with derived_attribution_set
```

Implementation truth of the #201 scaffold: `cases` is a map keyed by
`mutant_id`; the package digest field is `problem_package_digest`. A later
lane MUST keep exact-byte hashing of the frozen B that is actually
published.

Rules:

- every A case appears exactly once;
- no extra case is allowed;
- case identity must match A mutant IDs exactly;
- every attribution element must be an invariant ID declared by A;
- attribution sets contain no duplicates;
- attribution-set elements are serialized in ascending UTF-8 byte order;
- empty attribution set is represented as `[]`;
- B contains no field whose self-report can establish publisher identity
  or independence;
- the exact bytes actually published/frozen are the bytes later hashed
  and verified.

A later lane MAY add a machine-readable empty B template. This lane does
not create one.

Optional observational metadata on B is defined in section 18. It is not
a second attribution channel.

### 5.3 Object C — Externally verified provenance

C is not authored into truth by either A or B.

Production-valid C may be created only by a provider-specific verifier
that independently retrieves/verifies the publication event and binds:

```
declared provider / trust root
provider log / shard / instance identity
expected external publisher/controller identity
exact Object B bytes
Object B SHA-256
Object A SHA-256 cited by B
event ordering
protocol/provider-policy identity
prohibited-controller rules
```

Generic caller-supplied provenance JSON cannot create `VALID_PROVENANCE`.

Object B cannot self-certify Object C.

Object C cannot self-certify its own externality.

This lane creates no production C.

### 5.4 Object D — Comparison result

D is the internal comparison result.

It compares the exact closed universe:

```
DECLARED_CASE_IDS
== PACKAGE_CASE_IDS
== AUTHORITY_CASE_IDS
== COMPARISON_CASE_IDS
```

For each case:

```
internal attribution set
== external derived attribution set
```

Comparison uses exact set equality.

No score, majority vote, fuzzy matching, manual reconciliation, or
"close enough" rule exists.

## 6. Protocol freeze comes before any blind case

No Object A may be created until all of the following are fixed:

```
protocol exact bytes/digest
authority relationship class
provider policy
provider trust root
expected authority identity selector
expected Originator identity selector
event ordering rule
Object B format
comparison rule
abort rules
```

If any of these changes after the first blind instance is created, that
instance is abandoned and a new `instance_id` must be created.

## 7. Event ordering

The experiment requires a verifiable order between three public witness
events. Dummy provider events `D0 < D1 < D2` (section 16) are **not**
the real instance sequence.

### 7.1 E0 — Originator commitment

Before A is sent to the Authority, the Originator publishes an externally
witnessed commitment record containing at least:

```
protocol_sha256
provider_policy_sha256
instance_id
problem_package_sha256
authority_relationship_class
oracle_commitment
```

E0 does **not** reveal the internal oracle or its nonce.

### 7.2 E1 — Authority freeze

After deriving the result, the Authority freezes/publishes Object B and
produces a witnessed record binding at least:

```
instance_id
problem_package_sha256
object_b_sha256
authority provider identity
```

The exact Object B bytes must be retrievable or otherwise independently
available for later verification.

### 7.3 E2 — Originator reveal

Only after E1 is confirmed under the provider policy does the Originator
reveal:

```
exact Object A bytes
exact internal oracle bytes
commitment nonce
```

and publishes an externally witnessed reveal record.

### 7.4 Required order

```
E0 = Originator hiding commitment
E1 = Authority freezes / publishes exact B
E2 = Originator reveals oracle + nonce
E0 < E1 < E2
```

under one declared, externally verifiable monotonic ordering domain
(one provider log / shard, unless an independently verified cross-domain
ordering bridge exists).

Do **not** reconstruct ordering from:

- chat timestamps
- filesystem timestamps
- editable prose
- self-reported JSON

If the selected provider cannot prove the required order under one
declared ordering domain/log/shard, that provider is ineligible for this
experiment.

## 8. Hiding commitment for the Originator oracle

The internal attribution oracle may have a small answer space.

Therefore publishing only `SHA256(oracle)` before E1 is insufficient as a
blindness mechanism because an observer could potentially enumerate
candidate attribution sets.

### 8.1 Nonce

```
nonce = exactly 32 cryptographically random bytes
nonce reuse forbidden
generation: cryptographically secure RNG
```

### 8.2 Internal oracle bytes

The internal oracle is serialized as exact UTF-8 JSON bytes under a
frozen schema. The schema and serialization rule are fixed before A is
created.

The frozen production schema identifier (codec name) is:

```
tsei-invariant-discrimination-v0.internal-oracle.v0
```

This is the Originator internal oracle. It is not Object A, not Object B,
not provider telemetry, and not a scaffold `{ schema, note }` example.
Object B uses `tsei-invariant-discrimination-v0.authority-oracle.v0` and
MUST NOT substitute for this artifact.

Byte rule: `encodeJsonUtf8Lf` (recursive sorted-key UTF-8 JSON + exactly
one trailing LF). No BOM. No CR. No NUL. No dummy-gate JCS. Arrays that
the schema requires to be ordered MUST already be in ascending UTF-8 byte
order before encode; the validator rejects unsorted arrays rather than
silently sorting attribution answers.

Required top-level fields, and no others:

```
schema
instance_id
problem_package_sha256
declared_invariant_ids
cases
```

Meanings and JSON types:

```
schema
  string, exactly tsei-invariant-discrimination-v0.internal-oracle.v0

instance_id
  string matching [a-z0-9._-]+
  binds the oracle bytes to one Object A instance

problem_package_sha256
  string, exactly 64 lowercase hex characters
  SHA-256 of the accepted Object A bytes for that instance

declared_invariant_ids
  JSON array of strings
  frozen universe for this lane: exactly ["I_A","I_B","I_C"]
  already in ascending UTF-8 byte order
  these are the only allowed attribution-set elements

cases
  JSON object (map), not an array
  closed case universe: keys exactly c01,c02,c03,c04,c05,c06,
  c07,c08,c09,c10,c11,c12
  encodeJsonUtf8Lf sorts object keys; the logical set must still
  equal that closed universe (no extra, missing, or unknown keys)
```

Each case object has exactly:

```
mutant_id
  string, equal to the map key

originator_attribution_set
  JSON array of strings
  subset of {I_A,I_B,I_C}
  no duplicates
  already in ascending UTF-8 byte order
  empty, singleton, and multi-ID sets are all legal grammar
```

`originator_attribution_set` is the Originator (internal) attribution
set. It is not `derived_attribution_set` (Object B / Authority). Exact
comparison later is internal originator_attribution_set == external
derived_attribution_set as set equality per mutant. This section does
not perform that comparison.

Forbidden on this artifact: `note`, `authority_observations`, `nonce`,
`expected_attribution`, `derived_attribution_set`, extra keys, and any
extension point.

Pre-E0 private filename and lifecycle:

```
filename = originator-oracle.private.json
lifecycle = PRIVATE_PRE_E0_NOT_E0
```

This private file is not Object A, not Object B, not the public E0
record, and not the post-E2 publication filename
`internal-oracle-reveal.json`. Materializing it does not constitute E0.
A later E0 lane hashes these exact oracle bytes with a 32-byte nonce,
`instance_id`, and `problem_package_sha256` via the §8.3 commitment.
This lane still does not mint E0, generate a nonce, or publish.

Attribution answers are HUMAN_PRIMARY. Serialization, schema validation,
deterministic ordering, and hashing are MECHANICAL_ONLY. Code MUST NOT
infer, compare, correct, or complete originator_attribution_set values.

### 8.3 Commitment

```
DOMAIN = ASCII("TSEI-IA-COMMIT-v0")
SEP    = single 0x00 byte

preimage =
    DOMAIN
 || SEP
 || ASCII(instance_id)
 || SEP
 || ASCII(problem_package_sha256_hex_lowercase)
 || SEP
 || nonce_32_bytes
 || SEP
 || exact_internal_oracle_bytes

oracle_commitment = SHA256(preimage)
```

Constraints:

```
instance_id matches: [a-z0-9._-]+
problem_package_sha256_hex_lowercase is exactly 64 lowercase hex characters
```

At E0 reveal **only** the commitment, not the nonce and not the oracle.
At E2 reveal the nonce and the exact oracle bytes so any verifier can
recompute the commitment.

Naked `SHA256(oracle)` is insufficient: the attribution answer space may
be enumerable. Binding a 32-byte nonce, the instance id, and the
problem-package digest under a domain-separated preimage makes that
search infeasible.

This lane does **not** mint a nonce or commitment for a real instance.
It specifies the construction a later lane MUST use.

## 9. Object A privacy before Authority freeze

To reduce contamination:

- before E1, exact A bytes are sent only to the Authority through the
  agreed transport;
- the public E0 record exposes A's digest but not its concrete cases;
- A is publicly released at E2, after Object B is frozen.

This prevents public third parties from solving the blind instance and
feeding answers back before Authority freeze.

The Authority may retain A after the experiment for reproducibility.

## 10. Faithfulness gate

Before E0, Object A must pass the existing faithfulness checks.

If A is not faithful:

```
status = UNPROVEN
reason = PROBLEM_PACKAGE_NOT_FAITHFUL
oracle_input_state = NOT_EVALUATED
semantic_relation = NOT_EVALUATED
```

No provenance or semantic comparison is attempted.

A failed A is not patched in place after commitment.

A new instance must be created.

## 11. Semantic clarification rule after A delivery

After the Authority receives A:

Allowed:

- transport questions;
- file corruption questions;
- schema/serialization questions already answered by this protocol.

Not allowed without aborting the instance:

- clarifying what an invariant "really means" beyond the frozen
  normative definition;
- explaining which field was intended to trigger a case;
- explaining expected attribution;
- supplying evaluator traces;
- supplying predicate source;
- supplying an example whose answer reveals the intended mapping.

If a substantive semantic clarification is necessary:

```
ABANDON CURRENT INSTANCE
```

Do not patch A in place. Improve the protocol or the normative
definitions if necessary. Create a NEW blind instance (new id, A, cases,
oracle, nonce, B).

## 12. Authority output must be independently derived

The Authority must not be asked to execute an Originator-supplied
predicate implementation.

The Authority receives:

```
normative invariant definitions
definition identities
baseline values
mutated values
evaluation instruction
```

The Authority independently determines which declared invariants the
mutation violates.

Executing harness-supplied predicate code would only transport the
Originator's implementation and does not qualify as independent semantic
derivation under this protocol.

## 13. No pre-freeze answer review by Originator

The Authority must not send substantive Object B contents to the
Originator for review before E1.

The Originator must not proofread or correct the Authority's attribution
answers before freeze.

After A is sent, Originator MUST NOT:

- see or proofread B answers before E1
- correct Authority attribution
- provide evaluator traces
- provide expected attribution
- provide predicate source
- provide answer-bearing examples

The Authority may use an empty B template and the frozen format rules to
avoid syntax ambiguity.

If the frozen B is malformed, incomplete, or semantically ambiguous, the
result is reported honestly under the applicable `UNPROVEN` reason.

A later retry must use a **new blind instance** if the retry could be
influenced by knowledge of the first instance's answers.

## 14. Provider eligibility

The provider policy is selected and frozen as Rekor v1 before A exists.

The provider must support all load-bearing properties below.

### 14.1 Required properties

```
P1  independently verifiable trust root
P2  append-only or cryptographically consistency-verifiable publication history
P3  inclusion proof or equivalent proof that the event is part of the witnessed history
P4  stable provider/log identity for the entire E0/E1/E2 run
P5  monotonic order that can prove E0 < E1 < E2
P6  publisher/controller identity binding sufficient for the declared policy
P7  exact digest binding for published records/artifacts
P8  independent retrieval by the verifier
P9  no reliance on artifact self-report for publisher identity
P10 provider-specific verification implementable in the repository
```

### 14.2 Transport is not necessarily the ordering witness

Object B may be stored on a convenient transport such as a repository or
artifact host.

That transport alone is **not accepted** as the ordering witness unless
it independently satisfies P1–P10.

The digest of B must be anchored in the selected monotonic witness at E1.

### 14.3 Same ordering domain

All three events must be comparable under one ordering domain.

If a transparency system rotates/shards logs, the run must pin one exact
log/shard/instance and complete E0/E1/E2 within that ordering domain, or
the provider policy must supply a separately verified cross-shard
ordering proof.

Absent such a proof, the run does not establish the ordering claim.

## 15. Provider-specific identity policy

Before A exists, the final provider policy must declare exact expected
identities.

```
originator_identity_selector = SAN email shtomko@gmail.com AND OIDC issuer https://github.com/login/oauth
authority_identity_selector  = SAN email 114340671+TMerlini@users.noreply.github.com AND OIDC issuer https://github.com/login/oauth
```

The verifier must bind the observed publication/signing identity to those
selectors.

A display name inside JSON, a chat handle typed into Object B, or a
self-reported `authority_account` field is not sufficient.

The relationship classification from Section 2 remains separately frozen
in the protocol/policy and is not inferred from Object B.

## 16. Dummy provider gate (D0 / D1 / D2), distinct from E0 / E1 / E2

```
PROVIDER_DRY_RUN_REQUIRED_BEFORE_OBJECT_A = true
```

```
MODEL_DRY_RUN_TESTS_PASS
  !=
REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS
```

Only `REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS` can later satisfy the pre-A
provider gate. Model / synthetic dummy runs in this repository are
**insufficient** for Object A and **insufficient** for PROVEN grounding.

Dummy events (throwaway; not a real instance):

```
D0 = dummy Originator commitment
D1 = dummy Authority publication / freeze
D2 = dummy Originator reveal
D0 < D1 < D2
```

under one frozen provider ordering policy.

Before any Object A exists, a **real** throwaway provider run must verify:

- exact provider / trust root
- exact shard / log identity
- Originator identity
- Authority identity
- artifact / digest binding
- checkpoint / inclusion proof
- monotonic D0 < D1 < D2

Negative controls (prove the check can fail before trusting it to pass):

1. wrong ordering → reject
2. wrong Originator identity → reject
3. wrong Authority identity → reject
4. corrupted digest → reject
5. corrupted proof / checkpoint / inclusion material → reject
6. wrong provider / log identity → reject
7. cross-shard ordering without an independently verified bridge → reject

This lane records an external dummy gate. `evaluateProviderDryRun` remains
an **in-memory model** of dummy event shape. Caller-supplied strings are
**not** verified proofs. Caller-supplied
`independently_verified_cross_log_bridge = true` does **not** establish a
bridge. A model result is never a selected-provider pass.

```
evaluateProviderDryRun.provider_policy_freezable = false
MODEL_DRY_RUN_TESTS_PASS != REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS
sufficient_for_real_object_a = false
sufficient_for_proven_grounding = false
```

The production Rekor v1 verifier plus exact
`provider-policy.rekor-v1.json` bytes freeze provider policy. Dummy PASS
is eligibility only: it does not create Object A and does not mint PROVEN.

Object A codec remains sorted-key JSON UTF-8 with exactly one trailing LF
(`encodeJsonUtf8Lf`). Dummy-gate JCS used compact JSON with **no** trailing
newline. Those codecs must not be mixed.

## 17. Rekor v1 — selected frozen provider

```
provider_selected = true
DECLARED_PROVIDER_SELECTION = rekor-v1
DECLARED_PRODUCTION_PROVIDER = rekor-v1
CANDIDATE_NOT_SELECTED = rekor-v2-candidate-not-selected
```

Frozen policy file: `provider-policy.rekor-v1.json`.
SHA-256 of those exact bytes is computed **outside** the file.

Selected mechanics:

- Endpoint `https://rekor.sigstore.dev`.
- Rekor v1 log ID `c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d`.
- Write path hashedrekord `0.0.1` only.
- Use **top-level** `logIndex` for monotonic order.
- Ignore `inclusionProof.logIndex` when deciding global order.
- `integratedTime` is **not** trusted wall-clock time.
- Capture `tree_id` at E0; require E1 and E2 on the **same** tree. Do not
  hard-pin the dummy-run tree for production.
- Search by artifact SHA-256; zero or multiple matches fail closed.
- Verify the Rekor `signedEntryTimestamp` against the pinned Rekor v1 TUF key
  before trusting `body`, `logID`, top-level `logIndex`, or `integratedTime`.
- Verify the signed checkpoint note against that pinned Rekor key, then verify
  the RFC6962 inclusion proof against its authenticated root.
- Verify the artifact signature and the leaf certificate chain against pinned
  Sigstore TUF Fulcio intermediate/root certificates. Read the OIDC issuer only
  from exact Fulcio extension OIDs `1.3.6.1.4.1.57264.1.1` and
  `1.3.6.1.4.1.57264.1.8`; a matching substring elsewhere is not evidence.
- SigningConfig / TUF: use `signing_config.v0.2.json`; forbid
  `signing_config_rekor_v2.v0.2.json`.

Dummy run `tsei-ia-provider-dry-run-v0-20260819` is
`REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS` with class
`ELIGIBILITY_ONLY_NOT_OBJECT_A_NOT_PROVEN`.

```
CO_SIGNED_CHECKPOINT_TIME = NOT_YET_QUALIFIED
```

```
RFC3161 remains required only for a wall-clock claim
```

Event order does not require RFC3161. This lane does **not** claim
co-signed checkpoint time is currently qualified.

The experiment's primary ordering requirement is event order, not
human-readable wall-clock time.

Sources:

- https://docs.sigstore.dev/logging/overview/
- https://github.com/sigstore/rekor
- https://docs.sigstore.dev/quickstart/quickstart-cosign/
- https://docs.sigstore.dev/about/security/

## 18. Observational metadata on Object B

### 18.1 Definition-ambiguity observation

Each B case MAY carry, frozen by Authority **before** Originator reveal:

```
definition_ambiguity_observation:
  observed: boolean
  invariant_ids: string[]
  note?: string
  readings_considered?: number
```

Observational metadata, not a second attribution channel.

- MUST NOT alter `derived_attribution_set`.
- MUST NOT alter exact-set comparison.
- MUST NOT turn DISAGREED into PROVEN or PROVEN into DISAGREED.
- MUST NOT itself prove `SPECIFICATION_DEFECT` (that status does not exist).
- MUST NOT mint `VALID_PROVENANCE` or production grounding.
- MUST NOT reconcile disagreement.
- MUST survive into the evaluation result with both PROVEN and DISAGREED.

Validation: `invariant_ids` refer only to invariants declared by A; no
duplicates; result serialization sorts IDs lexicographically.
`readings_considered` is telemetry only.

Object B observational metadata is **runtime-untrusted** even when a
TypeScript type asserts otherwise. Before any observation is copied into
a result, every new field MUST be validated and normalized:

- `definition_ambiguity_observation.observed`: boolean
- `invariant_ids`: array of non-empty strings, unique and A-declared
- `note`: string when present
- `readings_considered`: finite non-negative integer when present
- `authority_observations.package_appeared_answer_free`: boolean
- `authority_observations.notes`: string when present
- `observed_undeclared_effects`: array of records
- every undeclared-effect `note`: string

Malformed observational metadata is fail-closed: return a deterministic
`UNPROVEN` result; do not copy raw malformed fields; do not `.map()`,
spread, or sort unvalidated values; do not throw. Caller-supplied
observation strings are not verified proof.

### 18.2 Second-party answer-free observation

```
authority_observations:
  package_appeared_answer_free: boolean
  notes?: string
```

Class: `SECOND_PARTY_OBSERVATION_ONLY`.

Does **not** replace the mechanical Object A faithfulness / allow-list
gate. Does **not** mint validity, provenance, independence, or PROVEN.

### 18.3 Undeclared-effect observation

Non-gating notes. `derived_attribution_set` may contain ONLY invariant
IDs declared by A. Unknown IDs there fail closed (`UNPROVEN` /
`AUTHORITY_INCOMPLETE`). Undeclared-effect notes MUST NOT expand
`DECLARED_CASE_IDS`, declared invariant IDs, the comparison universe, or
the exact attribution set, and MUST NOT alter PROVEN / DISAGREED /
UNPROVEN.

## 19. Exact comparison and closed universe (implementation truth)

Conceptual closure required before a **complete agreement** claim:

```
package cases
authority cases
originator oracle coverage
comparison cases
```

must cover the **same declared case universe**.

There is no runtime field named `INTERNAL_ORACLE_CASE_IDS`. The
evaluator closes package case IDs against authority case IDs via
`closeCaseUniverse`. After that closure, comparison IDs are the declared
package case IDs. Exact semantic comparison is:

```
authority derived_attribution_set == originator observed_attribution
```

as exact set equality per mutant. Observational metadata is outside that
equality.

Honest #201 behavior, unchanged by this lane: if a closed authority case
has no usable originator attribution (missing, unparsable, or unequal),
the evaluator reports `DISAGREED` / `AUTHORITY_DISAGREEMENT`, not
`AUTHORITY_INCOMPLETE`. Incomplete *authority* coverage (extra/missing
B cases, or unknown IDs inside `derived_attribution_set`) remains
`UNPROVEN` / `AUTHORITY_INCOMPLETE`. This lane does not silently
reclassify missing originator attribution.

Unknown invariant IDs, duplicate IDs, missing cases, extra cases,
duplicate cases, or malformed set encodings fail closed.

## 20. Result vocabulary

This protocol does not introduce a new TSEI runtime verdict.

```
no Authority result
→ UNPROVEN / AWAITING_INDEPENDENT_AUTHORITY

Authority artifact present but provider provenance invalid
→ UNPROVEN / UNPROVEN_INDEPENDENCE

case universe incomplete
→ UNPROVEN / AUTHORITY_INCOMPLETE

authority input ambiguous
→ UNPROVEN / AUTHORITY_AMBIGUOUS

valid provenance + exact disagreement
→ DISAGREED / AUTHORITY_DISAGREEMENT

valid provenance + exact complete agreement
→ PROVEN
```

For this particular authority relationship, a `PROVEN` outcome is bounded
by:

```
policy = EXTERNAL_PRIOR_PROTOCOL_EXPOSURE
```

It must not be restated as a proof of an unexposed or protocol-naïve
oracle.

This lane creates no production PROVEN.

## 21. Non-arrival

If the Authority accepts the protocol but does not later produce B:

```
UNPROVEN / AWAITING_INDEPENDENT_AUTHORITY
```

That is not:

```
failure
rejection
disagreement
TSEI violation
CI failure
```

No substitute internal oracle may be promoted to external evidence.

## 22. Disagreement

If valid external provenance exists and the Authority's exact attribution
differs from the committed internal oracle:

```
DISAGREED / AUTHORITY_DISAGREEMENT
```

**Disagreement is published, not reconciled.** Ambiguity observation
travels with PROVEN or DISAGREED and cannot reconcile disagreement.

The Originator must not:

- edit A;
- edit B;
- change the internal oracle reveal;
- change comparison semantics;
- remove the disagreeing case;
- reinterpret the Authority answer after seeing it.

The disagreement itself is the result.

A later diagnostic experiment, if desired, is a new study and uses a new
instance.

## 23. Abort conditions

The current instance is abandoned if any of the following occurs before
E1:

```
A faithfulness failure
protocol semantic change
provider-policy semantic change
provider identity selector change
provider cannot support E0<E1<E2
A byte drift
A case drift
internal oracle recomputation disagreement before E0
substantive semantic clarification requested after A delivery
answer leakage to Authority before B freeze
Authority receives an implementation-derived expected answer
```

After E1, the run is not rewritten.

It produces `PROVEN`, `DISAGREED`, or an exact `UNPROVEN` reason under
the frozen policy.

## 24. Exact sequence

```
PHASE 0
Authority reviews this protocol.
No cases exist.

PHASE 1
Originator + Authority agree on provider path.
Originator freezes:
- protocol bytes/digest
- provider policy bytes/digest
- relationship class
- identity selectors
- ordering rule

PHASE 2
Originator creates NEW Object A.
A passes faithfulness.
A bytes are frozen.
A SHA-256 is computed.

PHASE 3
Originator derives internal oracle privately.
Originator creates fresh 32-byte nonce.
Originator computes hiding oracle commitment.

PHASE 4 — E0
Originator anchors:
- protocol digest
- provider-policy digest
- instance_id
- A digest
- relationship class
- oracle commitment
No answers revealed.

PHASE 5
After E0 is verified, Originator sends exact A bytes to Authority privately.

PHASE 6
Authority independently derives B from A.
Originator does not see B contents.

PHASE 7 — E1
Authority freezes/publishes exact B.
B digest + authority identity are witnessed.
Originator verifies E1 exists before revealing anything.

PHASE 8 — E2
Originator publishes:
- A exact bytes
- internal oracle exact bytes
- nonce
and anchors the reveal.

PHASE 9
Provider-specific verifier independently verifies E0/E1/E2 and exact ordering.

PHASE 10
Comparison D verifies the closed universe and exact attribution equality.

PHASE 11
Emit:
PROVEN
or DISAGREED
or UNPROVEN / exact reason

PHASE 12
Freeze the complete evidence package.
```

This lane remains at PHASE 0. No later phase is executed here.

## 25. Publication package after completion

A completed run should preserve at least:

```
protocol.md
protocol.sha256
provider-policy.json
provider-policy.sha256
problem-package-A.json
problem-package-A.sha256
E0-record.json / provider proof
authority-oracle-B.json
authority-oracle-B.sha256
E1-record.json / provider proof
internal-oracle-reveal.json
nonce
E2-record.json / provider proof
provider-verification-C.json
comparison-D.json
closed-case-universe.json
sha256_inventory.txt
reproduction.md
```

All text files are LF-only.

Private chat content is not part of the publication package unless
separately agreed and necessary.

This lane does not create that package.

## 26. Follow-on stronger authority run

This run deliberately records prior protocol exposure.

For a stronger later experiment:

- use a different Authority relationship policy;
- use a completely new Object A;
- use a new internal oracle;
- use a new nonce/commitment;
- do not show the later Authority the first run's new instance before
  their own B is frozen;
- do not reuse the first run as a "blind" test for the second Authority.

Convergence across two separate blind instances may be reported as
additional evidence.

Disagreement across them must remain visible.

## 27. What this protocol does not prove

Even a successful run does not prove:

- source truth or real-world occurrence;
- universal correctness of TSEI adapters;
- absence of all undeclared invariants;
- metaphysical absence of collusion;
- zero prior conceptual exposure for this Authority;
- legal admissibility;
- settlement correctness;
- reputation correctness;
- universal verifier correctness;
- correctness outside the frozen instance and declared provenance policy.

The run proves only the bounded claim actually established by the frozen
evidence.

## 28. Acceptance checklist for Authority

Before any cases are created, please confirm only the protocol rules.

```
[ ] I understand I will receive a new blind Object A with no expected attribution answers.

[ ] I will derive each attribution set from the frozen normative definitions and concrete values, not by executing an Originator-supplied answer predicate.

[ ] I will not receive the internal oracle reveal before my Object B is frozen.

[ ] I accept that my prior exposure to the protocol is declared as part of this run's claim boundary.

[ ] I accept that disagreement will be published as disagreement rather than reconciled.

[ ] I accept that the provider path / identity selectors / ordering rule will be frozen before Object A exists.

[ ] I accept that once Object B is frozen, the run is not edited to make it agree.

[ ] I accept that the exact Object B bytes/digest and provider proof will be part of the reproducibility package.
```

No substantive cases or answers should be exchanged until this checklist
and the provider policy are resolved.

## 29. This lane does not create Object A

No Object A, no blind-case corpus, no real internal oracle, no real
32-byte nonce, and no real E0 commitment exist in this lane. Rekor v1 is
selected and the provider policy is frozen. Dummy-gate PASS is eligibility
only. No production provenance and no production PROVEN are created.

# Current protocol state

```
PROTOCOL = PROVIDER_POLICY_FROZEN_PRE_OBJECT_A
CASES_CREATED = false
ANSWERS_DISCLOSED = false
PROVIDER_SELECTED = true
PROVIDER_POLICY_FROZEN = true
DUMMY_GATE = REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS
DUMMY_GATE_CLASS = ELIGIBILITY_ONLY_NOT_OBJECT_A_NOT_PROVEN
AUTHORITY_RELATIONSHIP = EXTERNAL_PRIOR_PROTOCOL_EXPOSURE
NEXT_GATE = OBJECT_A_NOT_CREATED
```

**End of protocol draft.**
