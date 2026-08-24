# Independent Authority Blind Grounding Protocol v2

Normative real intended-instance eligibility and production composition contract.

**Governance boundary:** these bytes contain no mutable approval, implementation,
repository, release, or run status. Activation is established only by the
separate append-only ratification record defined in §17.

**Text rule:** LF only, final LF present.

**Answer-free:** this document contains no blind cases, attribution answers, oracle payload, nonce, or future instance ID.

This protocol does not change protocol v0 or v1, does not repair or reevaluate a completed instance, does not create a new instance, does not publish P0/E0/E1/E2, and does not mint `PROVEN` or any production verdict by its existence or ratification alone.

## 1. Purpose

Protocol v1 successfully defined answer-free intended bytes, P0, E0 v1, and strict `P0 < E0 < E1 < E2`, but it intentionally left `sufficient_for_real_intended_instance` permanently false as a pre-instance scaffold safety lock.

Protocol v2 defines a governed true-producing path without weakening that lock. It separates:

1. acceptance of exact intended-faithfulness bytes;
2. proof that those exact bytes formed a real intended instance through verified P0/E0 evidence;
3. later independent artifact grounding over E1/E2;
4. any still-stronger claim that a complete real run is sufficient for another downstream purpose.

No single boolean supplied by a caller can substitute for any proof layer.

## 2. Frozen historical boundary

Protocol v0 remains the historical `E0 < E1 < E2` contract.

Protocol v1 remains the exact pre-A scaffold contract whose SHA-256 is:

`fd7e17355e9c61daa6632398baeefcc519e53b3cf235c5f915ce0f56c72f8729`

The completed instance `tsei-ia-real-v1-20260821-02` remains closed under its approved split status:

```text
artifact grounding = PROVEN / AGREES
production status = NOT_MINTED
```

Its frozen source, operands, events, evaluator result, and closure must not be edited, retried, migrated, replayed, or reevaluated under protocol v2 to obtain a stronger label.

Protocol v2 requires a new instance ID and genuinely new cases.

## 3. Public status vocabulary

Independent artifact-grounding statuses remain:

```text
UNPROVEN | DISAGREED | PROVEN
```

Real intended-instance eligibility statuses are separate:

```text
INELIGIBLE | ELIGIBLE
```

Production composition may return boolean publishability fields only from internally verified conjunctions defined in this protocol. Eligibility alone never means artifact grounding is `PROVEN`, and `PROVEN` alone never means intended-instance eligibility is `ELIGIBLE`.

## 4. Exact provider policy

Protocol v2 uses this exact provider policy artifact:

```text
filename: provider-policy.rekor-v1.p0-e0-e1-e2.v1.json
bytes: 1905
SHA-256: 744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56
schema: tsei-invariant-discrimination-v1.provider-policy.rekor-v1.p0-e0-e1-e2.v1
```

The policy retains the verified Rekor v1 trust and selector semantics but fixes the production tree pin to `capture_at_p0_not_dummy_tree`. The old exact policy bytes with `capture_at_e0_not_dummy_tree` are not accepted under protocol v2.

Normative provider properties include:

- Rekor v1 public-good endpoint `https://rekor.sigstore.dev`;
- hashedrekord `0.0.1`;
- SHA-256 artifact digests;
- log ID `c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d`;
- GitHub OIDC issuer `https://github.com/login/oauth`;
- Originator SAN `shtomko@gmail.com`;
- Authority SAN `114340671+TMerlini@users.noreply.github.com`;
- exactly one verified digest match per event;
- same log and captured P0 tree for P0/E0/E1/E2;
- strict top-level global logIndex order;
- inclusion proof, signed entry timestamp, and signed checkpoint verification;
- RFC3161 time is irrelevant to event order and required only for a wall-clock claim.

## 5. Intended-faithfulness v1

Exact schema:

```text
tsei-invariant-discrimination-v1.intended-faithfulness.v1
```

Exact top-level keys:

```text
schema
instance_id
protocol_sha256
provider_policy_sha256
invariants
cases
```

Invariant rows contain exactly:

```text
invariant_id
normative_definition
normative_definition_identity
```

Case rows contain exactly:

```text
mutant_id
baseline
mutated
```

The artifact is answer-free. Attribution sets, expected answers, derived answers, originator answers, oracle or nonce material, commitment openings, evaluator output, repair output, and caller verdicts are forbidden anywhere in the graph.

Canonical bytes are recursively key-sorted compact UTF-8 JSON followed by exactly one LF. BOM, CR, NUL, missing LF, extra LF, pretty printing, duplicate keys, non-finite values, negative zero, unsafe integers, prototypes, accessors, proxies, symbols, functions, cycles, and excessive graph depth fail closed.

The exact bytes bind:

- a new non-historical, non-dummy instance ID;
- this protocol's exact SHA-256 as named by the separate ratification record;
- provider policy SHA-256 `744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56`;
- normative definition identities recomputed from exact definition strings;
- a non-empty invariant universe and non-empty case universe.

Acceptance of these bytes proves only `INTENDED_BYTES_ACCEPTED`. It does not itself return `ELIGIBLE`.

## 6. Object A v1

Exact schema:

```text
tsei-invariant-discrimination-v1.blind-problem.v1
```

Exact top-level keys:

```text
schema
instance_id
evaluation_instruction
invariants
cases
```

The exact frozen evaluation instruction is:

```text
For each case, determine the exact set of declared invariants violated by the mutated value, using only the invariant definitions and case data contained in Object A.
```

Object A must be deterministically materialized from the independently accepted intended artifact. Production acceptance recomputes the expected Object A bytes and requires exact byte equality. Semantic similarity, map projection supplied by a caller, or `intendedFrom(Object A)` is not sufficient.

Object A remains answer-free and contains no originator oracle, nonce, commitment opening, expected attribution set, derived attribution set, or evaluator output.

## 7. P0

P0 is the Originator publication of the exact intended-faithfulness bytes under the frozen provider policy.

Before Object A or E0 is accepted for a real intended instance, the verifier requires:

- SHA-256 computed from exact intended bytes;
- one and only one verified Rekor match;
- verified Originator SAN and OIDC issuer;
- verified Rekor log ID, entry body artifact digest, signed entry timestamp, inclusion proof, and checkpoint;
- capture of the production tree at P0;
- no dummy-gate digest or historical instance alias.

Rekor stores the digest, not the intended payload. The evaluation bundle supplies exact intended bytes whose digest must equal the verified P0 entry digest.

## 8. E0 record v2

Exact schema:

```text
tsei-invariant-discrimination-v1.e0-record.v2
```

Exact keys:

```text
schema
protocol_sha256
provider_policy_sha256
instance_id
problem_package_sha256
intended_faithfulness_sha256
authority_relationship_class
oracle_commitment
```

E0 binds:

- this protocol's exact SHA-256;
- provider policy SHA-256 `744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56`;
- the same new instance ID as intended and Object A;
- SHA-256 of exact Object A bytes;
- SHA-256 of exact intended bytes;
- the frozen authority relationship class;
- the hiding oracle commitment.

Nonce and oracle bytes remain forbidden in E0.

E0 must be canonical, published by the Originator under the same provider/log/tree selector, unique, and strictly after P0.

## 9. Real intended-instance eligibility

Exact result schema name:

```text
tsei-invariant-discrimination-v1.real-intended-instance-eligibility.v0
```

The verifier accepts only:

```text
intended_faithfulness_bytes
object_a_bytes
e0_record_bytes
policy_bytes
rekor_documents
```

All required proof facts are internally derived. Caller-shaped parsed artifacts, digests, indexes, identities, observations, booleans, statuses, eligibility, sufficiency, publishability, `PROVEN`, or synthetic injection fields fail closed.

Let:

```text
I = exact intended bytes are canonical and accepted
A = exact Object A bytes are canonical and exactly faithful to I
N = intended, Object A, and E0 have the same permitted new instance ID
D = E0 intended digest equals SHA256(exact intended bytes)
G = E0 problem-package digest equals SHA256(exact Object A bytes)
E = exact E0 bytes are canonical and accepted
P = exact provider policy bytes match the frozen policy pin
P0 = one unique independently verified Originator P0 binds the intended digest
E0P = one unique independently verified Originator E0 binds the E0 digest
S = P0 and E0 use the required provider, log, captured P0 tree, SAN, and issuer
O = top-level global_logIndex(P0) < top-level global_logIndex(E0)
F = the instance ID is non-historical, non-dummy, and permitted
C = no caller-shaped proof or verdict field is present
```

The exact formula is:

```text
real_intended_instance_eligible =
  I && A && N && D && G && E && P && P0 && E0P && S && O && F && C
```

`ELIGIBLE` is returned if and only if the whole conjunction is true. Every other result is `INELIGIBLE`, with non-empty deduplicated machine-readable failure reasons and no partial success object.

The eligibility result never contains `production_publishable`, `sufficient_for_proven_grounding`, or `sufficient_for_real_run`.

## 10. E1 and Object B

After E0 and eligibility verification, the Originator may release exact Object A bytes to the Authority.

The Authority independently derives Object B from Object A alone, `HUMAN_PRIMARY`, without oracle, nonce, originator answers, expected sets, evaluator output, or comparison hints.

Before E1, the Authority must materialize exact Object B bytes using `encodeJsonUtf8Lf`:

- recursively key-sorted;
- compact UTF-8 JSON;
- exactly one final LF;
- no BOM, CR, or NUL;
- byte-for-byte round-trip equality after parse and canonical re-encoding.

The exact-byte preflight is mandatory. Schema-valid or semantically equal non-canonical bytes do not qualify.

E1 must be unique, verified under the Authority selector, on the captured P0 tree, and strictly after E0.

## 11. E2 and commitment opening

E2 is the Originator publication of the exact canonical originator oracle bytes. It must be unique, verified under the Originator selector, on the captured P0 tree, and strictly after E1.

Only after E2 is independently verified may the Originator reveal the exact oracle bytes and exact nonce bytes.

The evaluator recomputes the frozen commitment formula over:

```text
domain separator
0x00
instance_id UTF-8 bytes
0x00
problem_package_sha256 lowercase hex ASCII
0x00
raw nonce bytes
0x00
exact canonical oracle bytes
```

The recomputed value must equal the `oracle_commitment` stored in the exact E0 artifact at rest. A target supplied only in a message is insufficient.

## 12. Full event order

The required production sequence is:

```text
P0 = Originator intended-faithfulness publication
E0 = Originator commitment record publication
E1 = Authority exact Object B publication
E2 = Originator exact oracle publication
P0 < E0 < E1 < E2
```

Order uses top-level global Rekor `logIndex`, not inclusion-proof local indexes, integrated time, chat time, Git time, or a caller boolean.

All four events must use the same verified provider, log ID, and captured P0 tree. Each artifact digest must have exactly one verified matching entry.

## 13. Production composition

The full evaluator accepts exact intended, Object A, Object B/E1, oracle/E2, nonce, E0, policy bytes, and untrusted Rekor documents. It derives all observations internally.

The evaluator may set `production_publishable: true` only when:

```text
real intended-instance eligibility == ELIGIBLE
AND independent artifact grounding == PROVEN
AND semantic relation == AGREES
AND oracle input state == VALID_PROVENANCE
AND commitment opening passes
AND Object B bytes equal E1 artifact bytes
AND oracle bytes equal E2 artifact bytes
AND the complete closed case universe compares by exact set equality
AND unique same-tree P0 < E0 < E1 < E2 passes
AND every canonicality, identity, digest, binding, and forbidden-field gate passes
```

`sufficient_for_real_run` remains false until a separate exact contract defines its additional claim. Protocol v2 does not silently equate production publishability with every possible downstream notion of a complete real run.

## 14. Fail-closed and non-repair rules

Any failed byte, schema, pin, canonicality, identity, uniqueness, tree, order, commitment, universe, or exact-set gate stops evaluation. No artifact is modified, normalized after freeze, repaired, reinterpreted, or retried as the same instance.

If E1 or E2 binds invalid bytes, preserve the original evidence. Any further attempt uses a new protocol-approved instance ID and genuinely new cases.

If a production evaluator call is authorized as single-shot and exits fail-closed, no retry occurs without a new separately governed authorization. Source must not be edited between a failed call and its recorded closure.

## 15. Mandatory tests before freeze

The implementation must include:

- a synthetic test-only positive path where all eligibility predicates are byte-derived and true;
- one isolated negative for every eligibility predicate;
- caller-shaped proof and verdict rejection;
- old/new schema cross-rejection;
- canonical byte negatives including pretty JSON and LF variants;
- P0/E0 digest, selector, uniqueness, tree, and strict-order negatives;
- full P0/E0/E1/E2 sequence negatives;
- Object A exact-faithfulness negatives;
- E0 binding negatives;
- commitment-opening negatives;
- Object B and oracle exact-payload negatives;
- closed-universe and exact-set negatives;
- deep immutability tests;
- historical v0/v1 regression locks;
- proof that no synthetic fixture is production-publishable by caller assertion.

Implementation, tests, protocol bytes, policy bytes, and source commit require
separate review before any future real instance design begins. Protocol
activation additionally requires the append-only ratification record defined
in §17.

## 16. Lifecycle

```text
final protocol and policy exact bytes reviewed
→ implementation and tests reviewed
→ independent contract audit
→ implementation commit landed
→ append-only ratification record approved and frozen
→ genuinely new private instance design
→ intended bytes exact review and approval
→ P0 publication and independent verification
→ Object A and E0 exact review and approval
→ E0 publication and independent verification
→ Authority preflight and Object A release
→ E1 independent verification
→ E2 publication and independent verification
→ separately controlled opening
→ one authorized single-shot production evaluation
→ accurate result closure
```

## 17. Ratification and activation

Mutable lifecycle state is not part of these normative bytes. Approval,
implementation, repository, audit, and activation facts belong in one separate
append-only ratification record. Changing any such fact never requires editing
this protocol.

The ratification record is canonical `encodeJsonUtf8Lf` JSON with exactly these
top-level keys:

```text
schema
protocol_filename
protocol_bytes
protocol_sha256
provider_policy_filename
provider_policy_bytes
provider_policy_sha256
implementation_repository
implementation_commit
implementation_tree
independent_audit_sha256
approval_record_sha256
status
```

Required literal values include:

```text
schema = tsei-invariant-discrimination-v1.protocol-v2-ratification.v0
protocol_filename = INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V2.md
provider_policy_filename = provider-policy.rekor-v1.p0-e0-e1-e2.v1.json
provider_policy_bytes = 1905
provider_policy_sha256 = 744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56
implementation_repository = pipavlo82/crystal-receipt
status = RATIFIED_FOR_NEW_INSTANCES
```

The record must bind the exact protocol bytes, the exact policy bytes, the
landed implementation commit and tree, an independent contract-audit artifact,
and exact approval evidence. Every digest is lowercase SHA-256 hex. The record
must pass exact-byte human review before it is frozen. Missing, malformed,
unreviewed, non-canonical, or internally inconsistent ratification evidence
means protocol v2 is not active for a real instance.

Ratification does not create an instance, authorize P0, contact the Authority,
or mint any evaluator result. Each of those remains a later separately governed
gate. Protocol v2 applies only to genuinely new instance IDs and cases.

**End of protocol v2.**
