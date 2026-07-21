# Unanchored Issuance-Time Witness v0

This document specifies the **unanchored issuance-time witness** path for discretionary gates where no independent settlement fact, job fact, or completion fact exists before computation.

It defines how a computation may enter a declared witnessed path before execution, how that path is published and externally observed, and how later predicate and admission evaluation remain separate.

This document is normative unless explicitly marked otherwise.

## Core pipeline

The profile uses the following normative order:

`coverage event`
→ `witnessed issuance record`
→ `computation`
→ `terminal commitment`
→ `public witness log`
→ `externally observed checkpoint`
→ `separate predicate and admission evaluation`

A later stage MUST NOT be treated as if it had occurred earlier. A timing, observation, publication, or liveness state MUST NOT collapse into a predicate-validity state.

Examples:

- overdue is not predicate invalid;
- unavailable is not mismatch;
- not_evaluated is not rejected;
- witness failure does not retroactively invalidate an earlier admitted predicate verdict.

## 1. Terminology and scope

### coverage event
A concrete event that the declared coverage path says MUST either produce a witnessed issuance intent or a witnessed skip record.

### owed event
A coverage event that, under the active coverage profile and verification window, is required to be accounted for by exactly one issuance-stream record.

### coverage profile
The declared rule set that defines which events are in scope, how they are ordered, what completeness basis exists, and what timing windows apply.

### coverage_source_authority
The declared authority class describing how independently the coverage source can establish the existence and completeness of owed events.

### issuer_ref
A stable identifier for the entity that owns the issuance stream and is responsible for emitting issuance records under the declared witness path.

### scope_ref
A stable identifier for the logical scope within which issuance ordering, continuity, and coverage are evaluated.

### coverage_profile_ref
A stable identifier for the exact stored coverage profile artifact whose rules define owed events, timing windows, and completeness conditions for the stream. In v0 it refers exactly to `coverage_profile_root`.

### coverage_event_ref
A stable identifier for one concrete event whose inclusion in the declared coverage path may require either an issuance intent or a skip record.

### inclusion_predicate_ref
A `sha256:<64 lowercase hex>` content reference to the exact predicate definition used to decide which trigger-source events become owed events.

### trigger_source_ref
A stable identifier for the concrete source from which coverage-triggering events are derived.

### request_commitment
An opaque commitment to the computation request as issued before computation, excluding verdict-derived output fields.

### ordering_basis_ref
A stable identifier for the basis whose ordered positions determine event ordering for a declared coverage or witness rule.

### liveness_basis_ref
A stable identifier for the external basis used to determine whether the witness has advanced, stalled, or become unverifiable relative to declared cadence rules.

### deadline_basis_ref
A stable identifier for the basis whose positions are used to compute skip, resolution, or publication deadlines.

### basis_ref
The generic stable identifier used by a position-bearing window; `ordering_basis_ref`, `liveness_basis_ref`, and `deadline_basis_ref` are role-specific uses of a basis reference.

### verification window
A bounded interval on a declared basis over which the verifier evaluates coverage, cardinality, timing, or publication claims.

### start_position
The basis position at which a declared timing window begins.

### event_position
The basis position at which the event relevant to a timing rule actually occurred, when such an event exists and is proven.

### as_of_position
The basis position on the relevant declared basis up to which timing, liveness, publication, or completeness is being evaluated.

### external as_of position
The externally supported `as_of_position` established on the declared external basis for liveness, publication, or deadline evaluation.

### complete verification window
A verification window for which the verifier can prove that the full ordered event interval is available with no hidden omissions relative to the declared authority and basis.

### checkpoint cadence
The required schedule by which witness-log checkpoints are expected to appear on a declared external basis.

### maximum checkpoint delay
The maximum additional position distance allowed after a checkpoint slot before absence of that checkpoint becomes a proven stall.

### issuance stream
A single hash-chained stream of issuance records under one scoped identity.

### issuance intent
A witnessed pre-computation record declaring that a specific computation request entered the witnessed path before execution.

### skip record
A witnessed issuance-stream record declaring that a coverage event was intentionally accounted for without producing a computation request.

### terminal commitment
A post-computation record binding the exact witnessed issuance intent to a result commitment without rewriting the earlier issuance state.

### witness receipt
The witness-generated acceptance proof for a record entering the witness path.

The witness receipt is a first-class stored artifact.

Its exact root body is:

```text
{
  "schema": "witness_receipt.v0",
  "witness_ref": "...",
  "log_id": "...",
  "accepted_record_schema": "...",
  "accepted_record_ref": "sha256:<64 lowercase hex>",
  "witness_position": <non-negative safe integer>,
  "witness_epoch": <non-negative safe integer>
}
```

Define:

```text
witness_receipt_root =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(
      receiptos_c14n_v0(exact_witness_receipt_body)
    )
  )
)
```

Define the stored artifact as the exact body plus:

- `witness_receipt_root`
- `witness_signature`

Normative statements:

- `witness_receipt_root` MUST equal recomputation over the exact body;
- `witness_receipt_root` and `witness_signature` MUST NOT be root fields;
- `witness_signature` MUST authenticate the exact `witness_receipt_root`;
- the signed receipt therefore binds the accepted record reference, witness, log, position, and epoch;
- the only allowed `accepted_record_schema` values in v0 are `issuance_record.v0` and `issuance_result_commitment.v0`;
- when `accepted_record_schema = issuance_record.v0`, `accepted_record_ref` MUST equal the stored artifact's `issuance_root`;
- when `accepted_record_schema = issuance_result_commitment.v0`, `accepted_record_ref` MUST equal the stored artifact's `issuance_result_root`;
- no other `accepted_record_schema` value is conformant in v0;
- `accepted_record_schema` disambiguates the artifact family but is not a substitute for validating the referenced artifact and recomputing its root;
- an intent witness receipt MUST be issued before computation begins;
- witness receipt validity means recomputing the receipt root, validating the witness signature, and confirming that `accepted_record_ref` identifies the exact artifact under evaluation;
- position and epoch MUST NOT be accepted from an unsigned side channel.

The signature profile and concrete signature-field schema MUST be pinned before implementation.

### witness_ref
A stable identifier for the witness authority that signs witness receipts and witness-log checkpoints.

### witness position
The ordered append position assigned by the witness within the witness log.

### witness epoch
A witness-maintained publication epoch used by witness-log checkpoints.

### stream head
The latest accepted issuance record for one `issuance_stream_id`, consisting at minimum of the current head sequence and head issuance root used for successor acceptance.

### witness log checkpoint
A signed, hash-chained snapshot of the append-only witness log.

### log_id
A stable identifier for one append-only witness log namespace under one witness.

### log_root
The root commitment summarizing one witness-log checkpoint's append-only contents.

### terminal record
The witness-log representation of an `issuance_result_commitment.v0`.

### publication state
The combined publication progress and publication timing status for a terminal record relative to the declared witness and external observation rules.

### consistency proof
Evidence that one claimed witness-log checkpoint extends another by a valid append-only relation without rewriting the earlier retained history.

### admissible prefix
The maximal externally retained and consistency-proven prefix of witness history that remains usable for historical admission claims after equivocation or later witness failure.

### freshness
The extent to which a claim is supported by externally observed witness history up to a recent declared `as_of` position rather than only up to an older checkpoint.

### externally observed
A state in which a witness-log checkpoint or inclusion-relevant publication state has been retained, mirrored, consistency-observed, or otherwise fixed outside the sole control of the witness.

### predicate verdict
The result of evaluating the substantive gate predicate itself.

### admission verdict
The result of evaluating whether a computation result is admissible under the witnessed-path, timing, publication, continuity, and observation rules.

### as_of_checkpoint
The Chronicle history checkpoint against which the computation request itself is evaluated at issuance time.

### explicit as_of position
An explicit historical position identifying the witness-log checkpoint or equivalent externally observed point at which an admission claim is evaluated.

`as_of_checkpoint` and explicit `as_of` position MUST NOT be treated as interchangeable.

### Scope statement
This profile proves properties only for the **declared coverage path**.

Without an independently enumerable coverage source, the strongest claim available is continuity of the witnessed subset.

Completeness of all private or operator-originated computations is unverifiable.

## 2. Issuance intent

### Deterministic encoding

This profile uses the deterministic encoding profile `receiptos-c14n-v0`.

`receiptos-c14n-v0` is defined exactly as follows:

1. `null` serializes as `null`;
2. primitive values serialize using ECMAScript `JSON.stringify` semantics;
3. arrays preserve their stored order and recursively canonicalize each value;
4. object fields whose value is `undefined` are omitted;
5. explicit `null` is retained and is not equivalent to an omitted field;
6. object keys are sorted in ascending ECMAScript string order, matching the default `.sort()` behavior used by the repository, i.e. lexicographic ascending order over UTF-16 code units;
7. keys are JSON-string encoded;
8. values are recursively canonicalized;
9. objects and arrays contain no whitespace;
10. the resulting string is encoded as UTF-8 before SHA-256;
11. SHA-256 output is lowercase hexadecimal;
12. Chronicle-native identifiers and roots use `sha256:<64 lowercase hex>`.

Language-independent pseudocode equivalent to the existing repository behavior:

Independent implementations MUST reproduce this ordering exactly and MUST NOT replace it with locale-sensitive ordering.

```text
function receiptos_c14n_v0(value):
  if value is null:
    return "null"

  if value is a primitive:
    return ECMAScript_JSON_stringify(value)

  if value is an array:
    return "[" + join(",", map(receiptos_c14n_v0, value in stored order)) + "]"

  let keys = object_keys(value)
  let kept = filter(keys, key => value[key] is not undefined)
  let sorted = sort_strings_ascending_ecmascript_default(kept)

  let entries = []
  for key in sorted:
    entries.push(
      ECMAScript_JSON_stringify(key) + ":" + receiptos_c14n_v0(value[key])
    )

  return "{" + join(",", entries) + "}"
```

Root-bearing v0 bodies MUST use only values representable by this profile. Every field described as a safe integer has the inclusive range `0` through `9007199254740991`, except fields explicitly requiring a positive value, whose minimum is `1`.

JSON Schema draft 2020-12 can structurally enforce:

- required predecessor-key presence;
- `sequence === 0` iff predecessor is explicit `null`;
- positive sequence requiring a SHA-256 predecessor reference;
- intent/skip tagged-union exclusivity;
- safe-integer bounds.

Cross-artifact recomputation, signatures, continuity, timing, coverage completeness, append-only consistency, and findings precedence remain verifier/vector rules.

The issuance-intent body is defined conceptually with the following fields:

- `schema` / version
- `opaque_job_id`
- `issuer_ref`
- `scope_ref`
- `coverage_profile_ref`
- `coverage_event_ref`
- `issuance_stream_id`
- `as_of_checkpoint`
- `request_commitment`
- `sequence`
- `prev_issuance`

The signed body MUST NOT contain:

- verdict
- pass/fail
- score
- result commitment
- result reason
- any field derived from the computation result

Clarify that the exact intent and skip objects listed below are the `issuance_record.v0` root bodies.

Define `issuance_record.v0` root bodies exactly.

For `kind: "intent"`:

```text
{
  "schema": "issuance_record.v0",
  "kind": "intent",
  "opaque_job_id": ...,
  "issuer_ref": ...,
  "scope_ref": ...,
  "coverage_profile_ref": ...,
  "coverage_event_ref": ...,
  "issuance_stream_id": ...,
  "as_of_checkpoint": ...,
  "request_commitment": ...,
  "sequence": ...,
  "prev_issuance": ...
}
```

For `kind: "skip"`:

```text
{
  "schema": "issuance_record.v0",
  "kind": "skip",
  "issuer_ref": ...,
  "scope_ref": ...,
  "coverage_profile_ref": ...,
  "coverage_event_ref": ...,
  "issuance_stream_id": ...,
  "skip_reason_code": ...,
  "sequence": ...,
  "prev_issuance": ...
}
```

Define:

```text
issuance_root =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(receiptos_c14n_v0(exact_kind_specific_body))
  )
)
```

Define the stored `issuance_record.v0` artifact as:

- exact kind-specific root body
- plus required field: `"issuance_root": "sha256:<64 lowercase hex>"`

Normative statements:

- `schema` is the in-body domain separator;
- no out-of-band separator bytes are used;
- every stored `issuance_record.v0` MUST contain `issuance_root`;
- `issuance_root` MUST equal recomputation over the exact kind-specific root body;
- `issuance_root` itself MUST NOT be included in recomputation;
- witness signature and witness receipt MUST NOT be included in recomputation;
- a schema for the stored artifact MUST require `issuance_root`;
- forbidding `issuance_root` from the stored artifact would be non-conformant;
- intent-only fields MUST be absent from skip;
- skip-only fields MUST be absent from intent;
- absence MUST NOT be normalized to `null`;
- explicit `null` is permitted only where the artifact rule explicitly permits it, including genesis `prev_issuance: null`.

The witness MUST sign the exact `issuance_root` before computation begins.

## 3. Issuance stream identity

The issuance stream is scoped by exactly:

- `issuer_ref`
- `scope_ref`
- `coverage_profile_ref`

Define the exact derivation:

```text
issuance_stream_id =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(
      receiptos_c14n_v0({
        "schema": "issuance_stream.v0",
        "issuer_ref": issuer_ref,
        "scope_ref": scope_ref,
        "coverage_profile_ref": coverage_profile_ref
      })
    )
  )
)
```

Normative statements:

- the fixed `schema` value is the in-body domain separator;
- no bytes are prepended or appended outside the canonicalized object;
- those are the exact root fields;
- changing any of the three refs creates a different stream;
- implementations MUST reject a stored `issuance_stream_id` that does not equal recomputation from those exact fields;
- changing the coverage profile creates a new stream;
- the old stream cannot be reinterpreted under a later policy;
- unrelated scopes MUST NOT share a sequence.

Genesis rules mirror `chronicle_checkpoint.v0`:

- `sequence === 0` iff `prev_issuance === null`;
- `sequence > 0` MUST require non-null `prev_issuance`;
- omitted `prev_issuance` MUST NOT be treated as equivalent to explicit `null`;
- malformed shape MUST be treated as distinct from invalid continuity.

## 4. Coverage profile

Define the exact root body of `issuance_coverage_profile.v0` as:

```text
{
  "schema": "issuance_coverage_profile.v0",
  "profile_id": "...",
  "inclusion_predicate_ref": "sha256:<64 lowercase hex>",
  "trigger_source_ref": "...",
  "coverage_source_authority": "...",
  "required_cardinality": "exactly_one",
  "ordering_basis_ref": "...",
  "liveness_basis_ref": "...",
  "skip_window": {
    "basis_ref": "...",
    "length": <non-negative safe integer>
  },
  "resolution_window": {
    "basis_ref": "...",
    "length": <non-negative safe integer>
  },
  "publication_window": {
    "basis_ref": "...",
    "length": <non-negative safe integer>
  },
  "checkpoint_cadence": {
    "basis_ref": "...",
    "origin": <non-negative safe integer>,
    "interval": <positive safe integer>,
    "max_delay": <non-negative safe integer>
  }
}
```

Define:

```text
coverage_profile_root =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(
      receiptos_c14n_v0(exact_issuance_coverage_profile_body)
    )
  )
)
```

Define the stored artifact as the exact body plus:

- `"coverage_profile_root": "sha256:<64 lowercase hex>"`

Normative statements:

- `schema` is the in-body domain separator;
- no bytes are prepended or appended outside the canonicalized body;
- every stored `issuance_coverage_profile.v0` MUST contain `coverage_profile_root`;
- `coverage_profile_root` MUST equal recomputation over the exact body;
- `coverage_profile_root` MUST NOT be included in its own recomputation;
- `coverage_profile_ref` MUST equal the exact stored `coverage_profile_root`;
- changing any rooted profile field MUST produce a different `coverage_profile_root` and therefore a different `issuance_stream_id`;
- an implementation MUST NOT resolve `coverage_profile_ref` through a mutable identifier whose content can change without changing the ref;
- `required_cardinality` is exactly the literal `exactly_one` in v0;
- `checkpoint_cadence.basis_ref` MUST equal `liveness_basis_ref`;
- the profile contains no signature field in v0.

An `inclusion_predicate_ref` is a `sha256:<64 lowercase hex>` content reference to the exact predicate definition used to decide which trigger-source events become owed events.

Normative statements:

- the predicate definition itself is outside this artifact;
- changing the predicate definition MUST change `inclusion_predicate_ref`;
- a mutable name or URL without a pinned content hash MUST NOT satisfy this field.

Every skip, resolution, and publication window is defined conceptually as:

```text
{
  "basis_ref": "...",
  "length": <non-negative safe integer>
}
```

An `as_of` position is defined conceptually as:

```text
{
  "witness_checkpoint_ref": "...",
  "external_basis_ref": "...",
  "external_basis_position": <non-negative safe integer>
}
```

The exact JSON schema may be deferred, but these three semantic components MUST be present.

Allowed `coverage_source_authority` values:

- `operator_controlled`
- `third_party`
- `consensus_anchored`

Normative statements:

- operator-controlled coverage MUST NOT establish independent completeness;
- absence from an operator-controlled source MUST be treated as `unverifiable`;
- admission MUST NOT treat coverage completeness as proven unless the verifier can independently enumerate every owed event in the complete declared window;
- every included coverage event MUST bind to exactly one issuance-stream record.

`Independently enumerable` requires all of:

- the source is not solely operator-controlled;
- the window boundaries are explicit;
- the verifier can obtain the complete ordered event set or a cryptographic commitment with valid completeness proofs;
- completeness does not depend on cooperation from the operator whose omissions are being tested.

Otherwise coverage completeness is unverifiable.

## 5. Intent and skip records

Model `issuance_record.v0` as a conceptual tagged union:

- `kind: intent`
- `kind: skip`

Shared fields include:

- `coverage_event_ref`
- `issuance_stream_id`
- `sequence`
- `prev_issuance`

Intent-specific fields include:

- `opaque_job_id`
- `as_of_checkpoint`
- `request_commitment`

Skip-specific fields include:

- `skip_reason_code`

Normative rules:

- skip MUST be a full member of the issuance stream;
- skip MUST occupy sequence;
- skip MUST be chained through `prev_issuance`;
- skip MUST be signed by the same witness path;
- skip MUST be witnessed within the declared skip window;
- `request_commitment` MUST be absent for skip;
- `skip_reason_code` MUST be absent for intent;
- late skip is well-formed but evaluated invalid with reason `late_skip`.

The skip window starts at the coverage event's position on its declared basis.

The deadline arithmetic is:

```text
deadline = start_position + window.length
```

Normative timing rules:

- `event_position <= deadline` means `on_time`;
- `event_position > deadline` means `late`;
- no event and `as_of_position <= deadline` means `not_due`;
- no event and `as_of_position > deadline` means `overdue` only when the complete interval through `as_of` is proven;
- otherwise timing is `unverifiable`;
- positions from different basis refs MUST NOT be compared;
- missing or incomparable basis evidence produces `unverifiable`, not `invalid`.

## 6. Coverage cardinality

Define:

```text
one owed coverage event
→ exactly one issuance record
```

Normative statements:

- duplicate bindings are not malformed when each record is individually well-formed;
- a proven duplicate MUST be evaluated invalid with reason `duplicate_coverage_binding`;
- valid cardinality requires a demonstrably complete verification window;
- when the provided window is incomplete, cardinality MUST be `unverifiable` rather than `valid`;
- missing binding and duplicate binding are separate outcomes;
- a proven missing binding MUST be evaluated invalid with reason `missing_coverage_binding`.

## 7. Witness acceptance and stream order

The witness MUST maintain the current stream head per `issuance_stream_id`.

It MUST accept a non-genesis record only when:

- `next.sequence === head.sequence + 1`
- `next.prev_issuance === head.issuance_root`

For every accepted record, it MUST assign:

- `witness_position`
- `witness_epoch`

Pin this invariant:

```text
within one issuance stream,
sequence(a) < sequence(b)
implies witness_position(a) < witness_position(b)
```

Implementations MUST treat violation of that invariant as a proven continuity/admission failure.

Define relation failures:

- `issuance_position_inversion`
- `issuance_stream_fork`
- `sequence_gap`
- `predecessor_ref_mismatch`

These are continuity/admission failures, not predicate verdicts.

## 8. Public witness log

Every accepted intent, skip, and terminal record MUST enter a public append-only witness log.

Expand the exact checkpoint root body to:

```text
{
  "schema": "witness_log_checkpoint.v0",
  "witness_ref": "...",
  "log_id": "...",
  "checkpoint_sequence": <non-negative safe integer>,
  "epoch": <non-negative safe integer>,
  "log_size": <non-negative safe integer>,
  "log_root": "sha256:<64 lowercase hex>",
  "prev_checkpoint": null | "sha256:<64 lowercase hex>"
}
```

Define:

```text
witness_checkpoint_root =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(
      receiptos_c14n_v0(exact_witness_checkpoint_body)
    )
  )
)
```

Define the stored artifact as the exact body plus:

- `witness_checkpoint_root`
- `witness_signature`

A checkpoint MUST be:

- signed;
- hash-chained;
- published on declared cadence;
- independently retained or consistency-observed.

Normative statements:

- `witness_checkpoint_root` MUST equal recomputation over the exact body;
- `witness_checkpoint_root` and `witness_signature` MUST NOT be root fields;
- `witness_signature` MUST authenticate the exact `witness_checkpoint_root`;
- `witness_checkpoint_ref` MUST refer to `witness_checkpoint_root`;
- `prev_checkpoint` MUST refer to the preceding stored `witness_checkpoint_root`;
- `checkpoint_sequence === 0` iff `prev_checkpoint === null`;
- `checkpoint_sequence > 0` requires a non-null `prev_checkpoint`;
- omitted `prev_checkpoint` MUST NOT be treated as explicit `null`;
- a successor checkpoint MUST have `checkpoint_sequence = predecessor.checkpoint_sequence + 1`;
- checkpoint predecessor continuity remains a verifier/vector rule, not merely a shape rule.

Clarifications:

- `log_root` is the commitment to the witness log state at `log_size`;
- this amendment pins its field format and checkpoint binding;
- the concrete append-only log construction and consistency-proof algorithm remain profile-defined and MUST be pinned before implementation.

A signed chain plus a periodically updated head hosted only on a mutable, witness-controlled endpoint is insufficient.

Allowed anti-equivocation / publication modes may include:

- independent append-only mirror
- threshold of independent mirrors
- public transparency log with gossip
- consensus anchor

Consensus anchoring is optional, not mandatory.

## 9. Observation stages

Signature-boundary rules:

- issuance records and result commitments do not embed witness signatures;
- acceptance signatures live in `witness_receipt.v0`;
- witness checkpoints carry their own checkpoint signature;
- all signature fields are excluded from deterministic artifact-root recomputation;
- a mutable unsigned position, epoch, checkpoint, or publication claim MUST NOT satisfy witness receipt or checkpoint validity.


Distinguish:

- `accepted_by_witness`
- `published_by_witness`
- `externally_observed`

Only `externally_observed` MUST establish an externally fixed historical state.

A private witness receipt alone MUST be insufficient.

## 10. Witness authority and liveness

Define `witness_authority_class`:

- `operator_controlled`
- `independent_single`
- `threshold_independent`
- `consensus_anchored`

An external `liveness_basis_ref` is required.

Witness liveness states:

- `live`
- `stalled`
- `unavailable`
- `equivocation_detected`
- `unverifiable`

Represent checkpoint cadence conceptually with:

```text
{
  "basis_ref": "...",
  "origin": <non-negative safe integer>,
  "interval": <positive safe integer>,
  "max_delay": <non-negative safe integer>
}
```

For slot `n`:

```text
slot_position = origin + n * interval
latest_allowed_position = slot_position + max_delay
```

A witness is `stalled` when:

- the external `as_of` position is greater than `latest_allowed_position`;
- the required checkpoint for that slot is absent;
- completeness of the external basis interval is proven.

A delayed checkpoint MUST NOT reset the origin or shift future slots.

`witness_stalled` is a proven finding only when the declared external liveness basis and a complete relevant interval prove that a required witness checkpoint missed its non-drifting cadence deadline.

If witness stalling prevents the verifier from proving the relevant interval, the affected check is `unverifiable` and MUST NOT emit `witness_stalled` as a proven finding merely from endpoint unavailability.

Normative statements:

- the witness cannot establish its own liveness merely by advancing its own epoch;
- missed checkpoint cadence against the external basis produces `stalled`;
- without comparable complete external-basis evidence, liveness is `unverifiable`, not `live`;
- without an external basis, liveness is `unverifiable`;
- current unavailability does not erase already externally observed history.

## 11. Terminal commitment

Define the exact root body of `issuance_result_commitment.v0` as:

```text
{
  "schema": "issuance_result_commitment.v0",
  "issuance_intent_root": "...",
  "verdict_commitment": "..."
}
```

Define:

```text
issuance_result_root =
"sha256:" +
lowercase_hex(
  SHA-256(
    UTF8(
      receiptos_c14n_v0(exact_issuance_result_commitment_body)
    )
  )
)
```

Define the stored artifact as the exact root body plus:

- `"issuance_result_root": "sha256:<64 lowercase hex>"`

Normative statements:

- `schema` is the in-body domain separator;
- no out-of-band bytes are prepended or appended;
- `issuance_result_root` MUST equal recomputation over the exact body;
- `issuance_result_root` MUST NOT be included in its own recomputation;
- `issuance_intent_root` MUST match the exact stored intent artifact being resolved;
- `verdict_commitment` MUST be a `sha256:<64 lowercase hex>` commitment;
- the terminal record entering the witness log is the stored `issuance_result_commitment.v0` artifact;
- timing and witness metadata MUST NOT be added to its root body;
- timing and witness observation belong to witness receipts, log inclusion, checkpoints, and admission evaluation.

The terminal commitment MUST bind to the exact witnessed intent.

It may be published after computation, but its timing is evaluated against the declared resolution window.

Separate:

`resolution_progress`
- `pending`
- `resolved`

`resolution_timing`
- `not_due`
- `on_time`
- `overdue`
- `late`
- `unverifiable`

`publication_progress`
- `not_started`
- `accepted_by_witness`
- `published_by_witness`
- `externally_observed`

`publication_timing`
- `not_started`
- `not_due`
- `on_time`
- `overdue`
- `late`
- `unverifiable`

`not_started` means no terminal commitment has yet entered the witness path.
`accepted_by_witness` means the terminal commitment was accepted by the witness but has not yet been published in a witness checkpoint.
`published_by_witness` means it appears in a published witness checkpoint but that checkpoint is not yet externally observed.
`externally_observed` means the relevant checkpoint has satisfied the declared independent observation rule.

Observation progress and publication timing are separate axes.

The resolution window starts at witness acceptance of the issuance intent.
The publication window starts at witness acceptance of the terminal commitment.

The deadline arithmetic is:

```text
deadline = start_position + window.length
```

Normative timing rules:

- `event_position <= deadline` means `on_time`;
- `event_position > deadline` means `late`;
- no event and `as_of_position <= deadline` means `not_due`;
- no event and `as_of_position > deadline` means `overdue` only when the complete interval through `as_of` is proven;
- otherwise timing is `unverifiable`;
- positions from different basis refs MUST NOT be compared;
- missing or incomparable basis evidence produces `unverifiable`, not `invalid`.

A terminal that actually arrives after deadline MUST remain:

- `resolution_progress = resolved`
- `resolution_timing = late`
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- finding `late_resolution`

If no terminal exists and the resolution deadline has passed, with the complete comparable interval through `as_of` proven, then:

- `resolution_progress = pending`
- `resolution_timing = overdue`
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- `predicate_evaluation_state = not_evaluated`
- `predicate_verdict = null`
- finding `resolution_overdue`

If absence of a terminal cannot be proven because the witness interval is incomplete, the result MUST be `unverifiable` rather than `overdue`.

A later terminal MUST NOT erase the earlier overdue interval.

Apply the same distinction to publication:

- no external observation after deadline with a complete comparable interval proven yields `publication_timing = overdue` and finding `publication_overdue`;
- later external observation after deadline yields `publication_timing = late` and finding `late_publication`.

A later external observation MUST NOT erase the earlier overdue interval.

## 12. Predicate vs admission

Define separate result dimensions:

`predicate_evaluation_state`
- `evaluated`
- `unverifiable`
- `malformed`
- `not_evaluated`

`predicate_verdict`
- `valid`
- `invalid`
- `null`

`admission_evaluation_state`
- `evaluated`
- `unverifiable`
- `malformed`
- `not_evaluated`

`admission_verdict`
- `valid`
- `invalid`
- `null`

State:

A consumer may rely on `predicate_verdict = valid` only when:

- `predicate_evaluation_state = evaluated`
- `predicate_verdict = valid`
- `admission_evaluation_state = evaluated`
- `admission_verdict = valid`

Admission MUST NOT be represented as the same boolean as predicate validity.

## 13. Admission checks

Admission evaluation uses the following normative ordered checklist:

1. profile and artifact shape;
2. issuance intent shape;
3. witness receipt validity;
4. coverage-event inclusion;
5. coverage-source authority;
6. coverage cardinality and window completeness;
7. issuance sequence and prev linkage;
8. sequence-to-witness-position monotonicity;
9. witness-log inclusion;
10. checkpoint consistency;
11. external observation;
12. equivocation status;
13. terminal-to-intent binding;
14. resolution timing;
15. publication timing;
16. explicit `as_of` scope.

Admission evaluation MUST return all proven violations, not only the first.

Define conceptually:

- `findings`: all proven violations;
- `findings` MUST be sorted by normative check order;
- `primary_reason_code` MUST equal the first finding after sorting;
- an unverifiable check MUST NOT be emitted as a proven violation.

If no violation is proven but a required check is unverifiable, admission MUST NOT be valid.

Co-occurrence vectors MUST pin the complete findings list and its order.

The currently required reason codes, without claiming that the enum is complete, are:

- `late_skip`
- `missing_coverage_binding`
- `duplicate_coverage_binding`
- `issuance_position_inversion`
- `issuance_stream_fork`
- `sequence_gap`
- `predecessor_ref_mismatch`
- `resolution_overdue`
- `late_resolution`
- `publication_overdue`
- `late_publication`
- `witness_stalled`
- `witness_equivocation`

The closed v0 reason-code enum MUST be pinned in `admission_result.v0` and the normative vectors before implementation.

## 14. Normative state matrix

### A. Pending, witness live, deadline not reached

- `admission_evaluation_state = not_evaluated`
- `admission_verdict = null`
- `predicate_evaluation_state = not_evaluated`
- `predicate_verdict = null`
- `resolution_progress = pending`
- `resolution_timing = not_due`
- `publication_progress = not_started`
- `publication_timing = not_started`
- `findings = []`
- `primary_reason_code = null`
- explicit `as_of` position included when applicable

### B. Pending, witness stalled, external deadline passed with complete comparable interval proven

- `resolution_progress = pending`
- `resolution_timing = overdue`
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- `predicate_evaluation_state = not_evaluated`
- `predicate_verdict = null`
- `findings` include `resolution_overdue` and any separately proven `witness_stalled` finding in normative check order
- `primary_reason_code` equals the first proven finding
- explicit `as_of` position included when applicable

### C. Pending with insufficient external evidence to determine deadline

- `resolution_progress = pending`
- `resolution_timing = unverifiable`
- `admission_evaluation_state = unverifiable`
- `admission_verdict = null`
- `predicate_evaluation_state = not_evaluated`
- `predicate_verdict = null`
- `publication_progress = not_started`
- `publication_timing = not_started`
- `findings = []`
- `primary_reason_code = null`
- explicit `as_of` position included when applicable

### D. Terminal resolved on time and externally observed

- `resolution_progress = resolved`
- `resolution_timing = on_time`
- `publication_progress = externally_observed`
- `publication_timing = on_time` when published within the declared window on a comparable basis
- eligible for admission evaluation
- explicit `as_of` position included when applicable

### E. Terminal resolved late

- `resolution_progress = resolved`
- `resolution_timing = late`
- `predicate_evaluation_state` MAY still be `evaluated` independently
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- `findings` include `late_resolution`
- `primary_reason_code = late_resolution`
- explicit `as_of` position included when applicable

### F. Published but not externally observed

- `publication_progress = published_by_witness`
- `publication_timing` is evaluated separately from publication progress
- `admission_evaluation_state = not_evaluated` until publication window expires or another rule proves invalidity or unverifiability
- explicit `as_of` position included when applicable

### G. Publication deadline passed with no external observation and complete comparable interval proven

- `publication_progress` remains `accepted_by_witness` or `published_by_witness`, according to the latest proven stage
- `publication_timing = overdue`
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- `findings` include `publication_overdue`
- `primary_reason_code = publication_overdue`
- explicit `as_of` position included when applicable

### H. External observation occurs after the publication deadline

- `publication_progress = externally_observed`
- `publication_timing = late`
- `admission_evaluation_state = evaluated`
- `admission_verdict = invalid`
- `findings` include `late_publication`
- `primary_reason_code = late_publication`
- explicit `as_of` position included when applicable

### I. Witness currently unavailable after earlier externally observed admission

- historical admission remains valid `as_of` the earlier checkpoint
- freshness and completeness after the last checkpoint are `unverifiable`
- current liveness does not retroactively rewrite the earlier admission verdict

### J. Equivocation

Define an incompatible checkpoint pair conceptually as two signed checkpoints for the same `witness_ref` and `log_id` whose claimed histories cannot both be connected by a valid append-only consistency relation.

The admissible prefix MUST end at the latest independently retained checkpoint that has valid consistency from the preceding externally observed checkpoint and precedes the incompatible pair.

- only that exact prefix may retain prior admission status;
- the divergent suffix MUST produce `admission_evaluation_state = evaluated` and `admission_verdict = invalid` with finding `witness_equivocation`;
- `predicate_verdict` MUST NOT be changed automatically;
- the concrete equivocation-proof artifact shape MAY be deferred to schemas and vectors before implementation.

### K. Operator-controlled coverage or witness

- concrete record continuity MAY be checked
- independent completeness is `unverifiable`
- no-omission admission cannot be `valid`

## 15. Historical invariant

An admission that was evaluated and valid `as_of` checkpoint `H` MUST NOT become historically invalid merely because the witness later stalls, becomes unavailable, or equivocates after `H`.

Later failure MUST limit claims after the last proven checkpoint.

Current liveness MUST NOT collapse into historical validity.

## 16. Required future artifacts

List, but do not create:

- `issuance-record-v0.schema.json`
- `issuance-coverage-profile-v0.schema.json`
- `issuance-result-commitment-v0.schema.json`
- `witness-receipt-v0.schema.json`
- `witness-log-checkpoint-v0.schema.json`
- `admission-result-v0.schema.json`
- normative single-condition vectors
- normative co-occurrence vectors

A reference implementation MUST NOT be written before the specification, all required schemas, and normative vectors are pinned.

A second implementation SHOULD be built independently from the pinned artifacts without reading the reference implementation.

## 17. Non-goals and honest limits

This v0 does not prove:

- computations that never entered any independently observable coverage path;
- truth of an operator-controlled ingress claiming completeness;
- availability of a witness without an external liveness basis;
- predicate validity from admission validity;
- admission validity from predicate validity;
- that blockchain anchoring is mandatory.
