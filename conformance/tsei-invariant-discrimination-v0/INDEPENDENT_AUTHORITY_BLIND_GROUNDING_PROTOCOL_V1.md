# Independent Authority Blind Grounding Protocol v1 addendum

Methodology / protocol addendum after PR #206. This artifact does **not**
create a real intended-faithfulness corpus, Object A, Object B, an oracle,
a nonce, P0, or E0/E1/E2. It does **not** mint production `PROVEN`. It
does **not** change the meaning of protocol v0, the historical instance
`tsei-ia-real-v0-20260819-01`, PR #206 public receipt, or the PR #200
ladder.

**Status:** `FUTURE_RUN_CONTRACT_SCAFFOLD_PRE_INTENDED_INSTANCE`
**Text rule:** LF only
**Important:** this document contains **no blind cases and no attribution
answers**.

Public independent-grounding statuses remain exactly:

```
UNPROVEN | DISAGREED | PROVEN
```

## 1. Relationship to protocol v0

Protocol v0 (`INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md`,
SHA-256 `8f2cf22d77b5476c0619a186d4a889c428fc5565f3d838f88d57b3c6fc806301`)
remains the frozen historical contract. Its E0 record has six keys and no
intended digest. Its witness sequence is `E0 < E1 < E2`.

A future production run that wants an independently verifiable
pre-A intended-faithfulness freeze uses **this addendum** and a **new**
`instance_id`. It must not reuse the historical instance, its E0, or its
private operands.

Do not edit protocol v0 to insert P0. Do not retrofit
`intended_faithfulness_sha256` into the historical E0.

## 2. Narrow provable claim

The future-run contract can prove only:

```
exact intended-faithfulness bytes were publicly and independently
verifiably bound (Rekor v1 hashedrekord P0, originator selector,
same log/tree) before Object A acceptance / E0
```

That claim is a freeze/anchor claim. It is **not**:

- proof of when private bytes were first created;
- proof that the intended corpus was independently authored by a second
  human;
- proof of metaphysical non-collusion;
- a change to Object B independence (Authority still derives B from
  answer-free A after E0).

Authorship/selection of the intended corpus remains Originator
`HUMAN_PRIMARY`. Independent derivation of Object B remains Authority
`HUMAN_PRIMARY` from A, not from a second intended channel.

## 3. Historical lock

The following remain `UNPROVEN` and must not be reinterpreted by this
addendum or by a later private production evaluator on a new instance:

- PR #200 ladder / `independent_grounding` for the published #200 instance;
- PR #206 public receipt status
  `REKOR_V1_PUBLIC_RECEIPT_RECORDED_PRODUCTION_UNPROVEN`;
- `evaluateProductionIndependentGrounding` on the historical path;
- `publicly_recomputable_from_package = false` for sanitized receipts
  that omit private operands.

Historical six-key E0 remains valid only for that receipt. It cannot
satisfy the v1 production gate.

## 4. Intended-faithfulness artifact

Canonical schema:

```
tsei-invariant-discrimination-v0.intended-faithfulness.v0
```

Exact top-level keys:

```
schema
instance_id
protocol_sha256
provider_policy_sha256
invariants
cases
```

Invariant rows: `invariant_id`, `normative_definition`,
`normative_definition_identity` (SHA-256 of the definition UTF-8 bytes).
Case rows: `mutant_id`, `baseline`, `mutated`.

The artifact is answer-free. It must not contain attribution sets,
expected answers, oracle/nonce material, evaluator/repair/discrimination
output, or Object A `evaluation_instruction`.

Canonical bytes: sorted-key UTF-8 JSON + exactly one trailing LF. No BOM,
CR, or NUL. Digest is SHA-256 of those exact bytes, computed outside the
artifact.

`instance_id` must be new. Forbidden: `tsei-ia-real-v0-20260819-01` and
the dummy-gate run id.

## 5. Pre-A anchor P0

Normative freeze is Rekor v1 hashedrekord `0.0.1` event **P0**:

- controller: Originator (GitHub OIDC, SAN `shtomko@gmail.com`);
- payload bytes: the exact intended-faithfulness bytes;
- log ID / endpoint: frozen Rekor v1 public-good log;
- search: SHA-256 hash, zero-or-multiple matches fail closed;
- uniqueness: exactly one verified match;
- inclusion proof and signed checkpoint required;
- tree captured at P0; E0, E1, E2 must be that same tree;
- dummy-gate D0/D1/D2 artifact digests are not production P0/E0/E1/E2.

Rekor stores the digest, not the payload. A verifier obtains exact bytes
from the evaluation bundle (or a later optional public copy) and requires
them to be the bytes whose hash was verified at P0.

Git timestamps and other publications are not the v0/v1 ordering domain.

## 6. Object A

Object A schema is unchanged:

```
tsei-invariant-discrimination-v0.blind-problem.v0
```

Production acceptance must parse intended from independently frozen P0
bytes. Deriving `intended` from Object A (`intendedFrom(A)` or any
projection of A) is not a production intended source.

## 7. E0 v1

New public E0 record schema:

```
tsei-invariant-discrimination-v0.e0-record.v1
```

Exact keys:

```
schema
protocol_sha256
provider_policy_sha256
instance_id
problem_package_sha256
intended_faithfulness_sha256
authority_relationship_class
oracle_commitment
```

`intended_faithfulness_sha256` must equal the verified P0 artifact digest.
Nonce and oracle bytes remain forbidden on the public record.

Historical six-key E0 (no `schema`, no intended digest) is not an alias
for this record.

## 8. Event order

```
P0 = Originator intended-faithfulness hashedrekord
E0 = Originator hiding commitment (v1 record)
E1 = Authority freezes / publishes exact B
E2 = Originator reveals oracle + nonce
P0 < E0 < E1 < E2
```

under one log / captured tree. Dummy `D0 < D1 < D2` remains eligibility
only and is not this sequence.

Provider policy for this sequence is a **new** file with

```
strict = P0_lt_E0_lt_E1_lt_E2
```

The historical `provider-policy.rekor-v1.json` bytes and digest stay
pinned for v0 / #206.

## 9. Lifecycle

```
intended bytes finalized
→ P0 verified
→ Object A built/accepted against independently parsed intended bytes
→ E0 v1
→ exact A bytes sent to Authority
→ E1 / Object B
→ E2 / oracle reveal
→ private single-shot production evaluation
```

Before E1, the Authority may receive only exact Object A bytes, and only
after E0 is verified. No oracle, nonce, expected sets, evaluator output,
or intended-as-answers channel.

## 9.1 Authority exact-byte preflight is mandatory

For a real v1 run, the Authority must freeze **canonical Object B bytes**,
not merely a schema-valid JSON object with the intended semantic content.
The exact byte rule is normative and load-bearing:

- encoding: `encodeJsonUtf8Lf`
- recursively key-sorted JSON
- UTF-8
- compact form (no pretty-print indentation)
- exactly one trailing LF
- no BOM, CR, or NUL

The Originator must give the Authority an **answer-free Object B template**
and an **exact-byte preflight** before Object A is released. The preflight
must reject at least:

- pretty-printed / indented JSON
- missing final LF
- extra trailing LF
- CRLF line endings
- non-UTF-8 / BOM / NUL
- bytes that do not round-trip through `encodeJsonUtf8Lf`

Passing schema validation alone is insufficient. Equality of derived
attribution sets alone is insufficient. If Object B is frozen with
non-canonical bytes, the run fails closed before semantic comparison.

## 9.2 Non-repair boundary for a closed instance

If E1 is later shown to have frozen non-canonical Object B bytes, that
instance is `UNPROVEN` for reason `object_b_bytes_non_canonical`. The
permitted closure is:

- preserve the original Object B / E1 / E2 evidence unchanged;
- do not canonicalize and continue as the same instance;
- do not ask the Authority to re-sign or republish a replacement E1/E2 for
  that closed instance;
- if intended-faithfulness proof is still wanted, start a **new blind
  instance** with a new `instance_id` and genuinely new cases.

## 10. Production evaluation

`evaluateProductionIndependentGrounding` remains the locked historical
path: it never ingests Rekor observations and cannot mint production
`PROVEN`. `asProductionGroundingEvidence` remains null.
`IndependentGroundingResult.production_publishable` remains literal
`false`. Existing `verifyRekorV1OrderedEvents` remains dummy-eligibility
typed `sufficient_for_proven_grounding: false`.

A future run uses a **new** single-shot function
`evaluateProductionRekorIndependentGrounding` that accepts exact bytes,
verifies P0/E0/E1/E2 internally, derives observations internally, and
calls the private core without exporting it. Caller-shaped observations,
order booleans, identities, digests, `PROVEN`, or
`production_publishable` cannot mint validity.

## 11. This lane does not create the intended instance

No real intended corpus, P0, Object A, or E0/E1/E2 are created here.
Scaffold tests use non-instance fixtures labeled insufficient for a real
run.

```
PROTOCOL_V1 = FUTURE_RUN_CONTRACT_SCAFFOLD_PRE_INTENDED_INSTANCE
INTENDED_INSTANCE_CREATED = false
P0_PUBLISHED = false
CASES_CREATED = false
HISTORICAL_RECEIPT_UNPROVEN = true
NEXT_GATE = INTENDED_BYTES_NOT_CREATED
```

**End of protocol v1 addendum.**
