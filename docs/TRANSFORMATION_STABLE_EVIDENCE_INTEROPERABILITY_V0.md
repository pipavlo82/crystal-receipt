# Transformation-Stable Evidence Interoperability

## Specification v0

*"v0" refers only to this specification artifact. This document does not use, and must not be read against, any ReceiptOS product version numbering.*

*Repository status note (non-normative): the generic mechanism this specification describes currently remains inside this repository by owner decision. This is a packaging choice, not an architectural requirement — an independent extraction audit already established that the generic core has no required ReceiptOS/Chronicle runtime dependency. Standalone repository creation may be revisited later if independent implementation, release, governance, or distribution needs justify it. Remaining in this repository should not be read as evidence that the generic mechanism depends on ReceiptOS or Chronicle; see the Reference Implementation Appendix for the precise boundary.*

---

## 1. Scope

This specification defines a mechanism for verifying **whether a declared transformation preserves the protected semantic surfaces of an artifact or artifact bundle, under independent recomputation.**

The mechanism verifies:
- that a *declared, admissible* transformation applied to a source artifact preserves the surfaces its profile marks as protected, as measured against an *independently recomputed* evaluation of both source and target — never against either side's own self-reported state.
- structural completeness of that comparison over the *observed* universe of one evaluated pair (Section 8).
- non-erasure of intermediate failures across a declared sequence of transformations (Section 7).

**This specification explicitly does NOT verify:**
- domain-object validity by itself — whether a single artifact is internally well-formed is a lower-layer concern, entirely delegated to the binding's own recompute/applicability logic (Section 3).
- completeness of all possible relationship invariants a domain might care about — only the invariants a binding actually declares and protects are checked (Section 12).
- transparency-log integrity, append-only auditability, or tamper-evidence of any underlying ledger or receipt-transparency infrastructure — out of scope entirely.
- signature validity, unless a domain adapter explicitly folds signature verification into its own recompute/projection logic; this specification defines no cryptographic-signature primitive.
- correctness of adapter-authored semantics themselves — the mechanism trusts that a binding's transform/recompute/projection functions correctly express what "transform," "recompute," and "protected surface" mean for its domain (Section 3 states this boundary precisely).

---

## 2. Terminology

Implementation-neutral definitions.

| term | definition |
|---|---|
| **artifact** | any structured, JSON-representable value under evaluation |
| **source artifact** | the artifact before a declared transformation |
| **target artifact** | the artifact produced by applying a declared transformation to the source artifact |
| **transformation** | a declared, domain-supplied function mapping a source artifact to a target artifact |
| **applicability predicate** | a domain-supplied function deciding whether a transformation is admissible for a given source artifact, prior to any comparison |
| **recompute procedure** | a domain-supplied function that independently re-derives an evaluation result from an artifact, without trusting that artifact's own self-reported claims |
| **evaluation result** | the output of a recompute procedure — an opaque, domain-defined value from which projections are taken |
| **projection** | a domain-supplied function extracting one comparison surface from an evaluation result |
| **normative surface** | a projection whose mismatch between source and target always constitutes a preservation violation |
| **stability/history-sensitive surface** | a projection whose mismatch is classified according to an explicit, declared policy — either as a softer, informational outcome or as a violation |
| **allowed-variant surface** | a projection that is free to change; tracked for observability but never gates classification |
| **forbidden surface** | a projection whose mismatch always constitutes a preservation violation, distinct from the normative surface in intent |
| **observed universe** | the set of structural paths mechanically present, with a value, in the canonicalized source and/or target artifact of one evaluated pair |
| **coverage atom** | the presence-aware value observed at one path — either `absent` or `present` with a canonical value; `null` is a present value, distinct from absent |
| **equivalence relation** | a domain-declared relation stating which distinct canonical values are to be treated as preservation-equivalent for one specific observed path |
| **normalizer** | an implementation computing a canonical representative for values considered equivalent under a declared equivalence relation |
| **normalizer authority** | a validated, immutable object resolving a normalizer identity to its declared equivalence relation and implementation, structurally distinct from both the profile that references it and the implementation it resolves to |
| **transformation edge** | one transformation step within an ordered sequence, evaluated against the same preservation predicate as a single transformation |
| **transformation cycle** | an ordered sequence of transformation edges applied to one starting artifact |
| **profile** | the complete, validated declaration binding a transformation family to its applicability, recompute, and projection procedures (and, optionally, coverage declarations and normalizer authority) |
| **binding / adapter** | the domain-specific code supplying every procedure a profile references — the only place domain knowledge enters the mechanism |

---

## 3. Trust Model

**The mechanism MUST NOT trust:**
- a stored, self-reported verdict merely because it is present on an artifact — every evaluation result MUST come from an independent recompute procedure, never from reading a claim the artifact makes about itself.
- transformation endpoint equality alone as evidence of preservation — an intermediate terminal violation MUST NOT be erased by a later state matching an earlier one (Section 7).
- root equality alone, when a protected surface exists outside the root's own preimage — a normative or forbidden surface MUST be independently compared even if a single scalar digest matches.
- profile-author completeness for observed structural fields — an unclassified but observed path MUST derive to forbidden, never to silently allowed (Section 8).
- an arbitrary inline normalizer implementation supplied directly by a profile — normalizer implementations MUST be resolved only through a separately-constructed authority (Section 10).

**The mechanism still trusts:**
- the declared adapter transformation logic itself.
- the applicability logic.
- the recompute logic.
- the projection logic.
- the comparator implementation (Section 11) — conformance vectors bound this trust but do not eliminate it.
- a supplied normalizer authority, as an **explicit trust root** — the mechanism verifies structural properties of an authority (Section 10) but does not and cannot verify that a declared equivalence relation is domain-semantically correct.

**Precision required:** independent recomputation removes trust in an artifact's *self-report*. It does not remove trust in the *adapter code* that defines what recomputation, applicability, and projection mean. A binding with a buggy recompute procedure will produce evaluation results this mechanism faithfully — and incorrectly — verifies.

---

## 4. Profile Model

A conforming profile is a validated record. Conceptual fields, independent of any host language's type system:

| field | required | purpose |
|---|---|---|
| profile identity | MUST | a stable, unique label for this declared transformation/cycle/coverage profile |
| profile version | SHOULD | an explicit version marker distinct from the identity string |
| source object kind | MUST | a domain-opaque label for the source artifact's kind; never interpreted by the evaluator |
| target object kind | MUST | same, for the target artifact |
| transformation family | MUST | a domain-opaque grouping label |
| applicability procedure | MUST | implements the applicability predicate |
| transformation procedure | MUST | implements the transformation |
| source recompute procedure | MUST | implements independent recomputation of the source artifact |
| target recompute procedure | MUST | implements independent recomputation of the target artifact |
| normative projection | MUST | extracts the normative surface |
| stability projection | MUST | extracts the stability/history-sensitive surface |
| allowed-variant projection | MUST | extracts the allowed-variant surface |
| forbidden projection | MUST | extracts the forbidden surface |
| history-sensitive policy | MUST | one of `classify` or `violation`; governs how a stability-surface mismatch is classified |

A **profile-invalid** state (malformed identity, missing procedure, structurally inconsistent declaration) **MUST** remain outside the five-outcome transformation verdict vocabulary defined in Section 5.

---

## 5. Verdict Model

Exactly five outcomes, normatively defined:

| verdict | necessary conditions | category |
|---|---|---|
| **stable** | applicability holds; recomputation of both sides succeeds; normative and forbidden surfaces match; stability surface matches, or mismatches without a required escalation | preservation |
| **history_sensitive** | as `stable`, except the stability surface mismatches and policy is `classify` | preservation (softer outcome) |
| **violation** | normative surface mismatches, OR forbidden surface mismatches, OR stability surface mismatches under a `violation` policy, OR closed-world coverage (Section 8) escalates a milder result | preservation (terminal) |
| **out_of_domain** | the applicability predicate rejects the source artifact before any recomputation or comparison occurs | applicability |
| **unresolved** | any declared procedure (applicability, transform, recompute, projection) fails to complete — throws, or explicitly reports a failure — before a preservation determination can be reached | execution |

**Precedence/termination:** applicability is checked first. Execution failure at any subsequent step terminates evaluation as `unresolved` immediately. Among preservation outcomes, `violation` is terminal and takes precedence. Closed-world coverage (Section 8) MAY escalate `stable` or `history_sensitive` to `violation`; it MUST NOT escalate toward, or produce, `unresolved`/`out_of_domain`, and MUST NOT downgrade `violation`.

**Explicit distinctions, each a separate concern:**
- **profile invalid** — a construction-time defect in the profile declaration itself; never reaches evaluation.
- **object/domain invalid** — an artifact fails its own internal well-formedness; entirely a matter for the binding's own recompute/applicability logic.
- **transformation out_of_domain** — the declared transformation does not apply to this input; a verdict, not a validity judgment.
- **execution unresolved** — something in the declared procedures failed to complete; says nothing about whether preservation actually holds.
- **preservation violation** — the only verdict that asserts something was *not preserved*.

---

## 6. Single-Transformation Evaluation

Algorithm, in implementation-neutral prose:

```
evaluate(profile, source):
  if not applicable(profile, source):
    return out_of_domain

  target := transform(profile, source)          # failure -> unresolved
  sourceResult := recompute(profile, source)     # failure -> unresolved
  targetResult := recompute(profile, target)     # failure -> unresolved

  normativeMatch  := project_normative(sourceResult)  == project_normative(targetResult)
  forbiddenMatch  := project_forbidden(sourceResult)  == project_forbidden(targetResult)
  stabilityMatch  := project_stability(sourceResult)  == project_stability(targetResult)
                                                        # projection failure -> unresolved

  if not normativeMatch or not forbiddenMatch:
    return violation

  if not stabilityMatch:
    return violation if policy == violation else history_sensitive

  return stable
```

Rules, stated normatively:
- a normative mismatch **MUST** yield `violation`.
- a forbidden mismatch **MUST** yield `violation`, independently of the normative surface's result.
- a stability mismatch **MUST** yield `history_sensitive` under a `classify` policy, or `violation` under a `violation` policy.
- if all protected surfaces match, the result **MUST** be `stable`.
- any exception or explicit failure signal raised by a declared procedure **MUST** cause the evaluation to terminate as `unresolved`, without attempting any further comparison.

---

## 7. Edgewise Transformation Cycles

A cycle is an ordered sequence `R0 → R1 → ... → Rn` of transformation edges `T1, ..., Tn`, each `Ti` mapping `R_{i-1}` to `Ri`.

- Each edge **MUST** be evaluated, using the Section 6 preservation predicate applied to `(R_{i-1}, Ri)`, before the next edge is accepted as preserved.
- A terminal edge outcome (`violation`, `unresolved`, or `out_of_domain`) **MUST** terminate evaluation of the whole cycle at that edge; no subsequent edge **MAY** be evaluated once a terminal outcome occurs.
- Endpoint equality **MUST NOT** erase any prior terminal violation — a cycle's classification is determined at the first terminal edge, independent of what any later state would otherwise show.
- Endpoint comparison (of `R0` against `Rn`) **MAY** be evaluated only after every preceding edge completes without a terminal result.
- A non-terminal `history_sensitive` edge (a stability mismatch under a `classify` policy) does not halt the cycle; it MUST be recorded, and the cycle's own final classification MUST reflect `history_sensitive` if any edge, or the endpoint comparison, produced one and no edge was terminal.

**Non-erasure theorem, implementation-independent form:** let `i*` be the least index at which edge `i*` is terminal. The cycle's classification is a function of `i*` and the edges up to and including it; it is **not** a function of any comparison between `R0` and `Rn`. If no such `i*` exists, the cycle's classification is a function of the endpoint comparison and any non-terminal `history_sensitive` edges encountered along the way. Consequently, no construction of `T1..Tn` can cause a violation that occurred at `i*` to be masked by choosing a later edge to restore `Rn` to a state resembling `R0` — the mechanism never reaches the endpoint-comparison step in that case.

---

## 8. Closed-World Observed-Pair Coverage

```
U_obs(R, R') = paths(canonical(R)) UNION paths(canonical(R'))
```

A profile **MAY** declare disjoint `C_N`, `C_S`, `C_A` (normative/stability/allowed-variant coverage classes, by path selector). The residual is derived, never declared:

```
C_F = U_obs - (C_N UNION C_S UNION C_A)
```

Requirements:
- every path in `U_obs` **MUST** receive exactly one effective class (Section 9 defines how declarations resolve to a single winner).
- an observed path matching no declaration **MUST** derive to `F` — the fallback **MUST NOT** depend on the profile author having enumerated it.
- presence **MUST** be first-class: a coverage atom **MUST** distinguish `absent` from `present`.
- an appearance (`absent -> present`) **MUST** be observable as a mismatch where the path's class requires equality.
- a deletion (`present -> absent`) **MUST** likewise be observable.
- `null` **MUST** remain distinct from `absent` — a present `null` value is not the same coverage atom as an absent path.
- arrays are whole-array atoms in this specification version — an array's structural contents **MUST NOT** be decomposed into per-index paths, unless a future specification version explicitly extends structural decomposition.

**Frozen, non-obvious behaviors** (must match `conformance/observed-leaf-paths-conformance-v0/vectors.json` exactly, not be silently "improved"):
- a key whose value is a **nested empty object** contributes **zero** observed leaves — that key is indistinguishable, from `U_obs`'s point of view, from being entirely absent.
- a key whose value is a **nested empty array** contributes **one** observed leaf (the empty array itself, as the whole-array atom) — this is different from the empty-object case above.
- the path walker itself never throws or rejects a value, including a non-finite number or an undefined-equivalent array element — it always successfully enumerates paths and preserves the raw leaf value unmodified. Rejection of such a value happens strictly downstream, in the comparator (Section 11), when an atom is actually built for comparison — see Section 15 for how that downstream rejection surfaces as an evaluation outcome.

**Precision required:** observed-pair completeness is **not** schema-total completeness. A path absent on both sides of the evaluated pair lies outside `U_obs` by construction and is therefore invisible to this layer entirely. If the underlying domain schema requires that path to be present, that is an object/domain-validity concern belonging to a lower layer — never a transformation-preservation event at this layer.

---

## 9. Selector Semantics

The generic grammar:

```
selector        = [ side_qualifier "::" ] path_expr ;
side_qualifier  = "source" | "target" ;
path_expr       = exact_path | deep_wildcard ;
exact_path      = segment { "." segment } ;
deep_wildcard   = segment { "." segment } "." "**"
                | "**" ;
segment         = letter { letter | digit | "_" } ;
```

**`side_qualifier` is RESERVED grammar, NOT ACTIVE in this specification version.** The grammar production exists (a parser MAY accept the token sequence), but no v0-conforming coverage profile MAY use it operationally: see Section 9.1 for the exact v0 boundary. A future specification version MAY activate cross-type coverage without changing this grammar's surface syntax.

Classification of what is protocol-necessity versus this-version's implementation-policy:

| rule | classification | rationale |
|---|---|---|
| segment character set, deep-wildcard-only, no array indices | implementation-policy, this spec version | a parseable, unambiguous surface syntax is needed, but this exact grammar is one reasonable choice; a future version could widen it without breaking the underlying theorem |
| **some** total, deterministic precedence order must exist among matching declarations | protocol necessity | without one, path classification is not well-defined, which breaks the coverage-completeness guarantee (Section 8) at its foundation |
| the *specific* precedence rule — exact beats wildcard; among wildcards, longer segment-prefix wins | fixed by this spec version for cross-implementation interoperability | arbitrary in the abstract, but MUST be this exact rule for two independent conforming implementations to agree on a classification given the same profile and data |
| equal-specificity, conflicting-class declarations MUST yield profile-invalid | protocol necessity | consistent with the mechanism's fail-closed philosophy throughout |
| `A` wildcards MUST be forbidden, unconditionally | protocol necessity | a wildcard-declared allowed-variant surface would let an author pre-declare unknown future fields as freely changeable, directly undermining the coverage-completeness guarantee's purpose |
| `S` wildcards MUST be permitted only when `history_sensitive_policy` is `violation` | protocol necessity, same rationale | restricting wildcard `S` to the policy that already escalates mismatches to `violation` closes the same author-declared-weakening loophole |

### 9.1 Cross-Type Coverage V0 Boundary

**Closed-world coverage in this specification version supports same-type profiles only.** A same-type profile compares a source and target artifact of the same declared kind, using one shared, side-neutral path space.

**Cross-type coverage is NOT supported in this specification version.** This is a deliberate, complete exclusion, not an unverified or partially-working feature:

- a coverage profile **MUST** declare itself same-type; a profile that does not **MUST** fail construction (profile-invalid), unconditionally, regardless of how well-formed its declarations otherwise are.
- there is **no** conforming way, in this specification version, to construct an authenticated cross-type coverage profile — construction rejection MUST occur before any declaration-level validation is attempted, so a well-formed pair of `source::`/`target::` selectors cannot bypass the rejection by being otherwise valid.
- an implementation **MUST NOT** present cross-type coverage as available, partially available, or "supported with caveats." It is unsupported, full stop, in this version.

This boundary exists because same-type coverage's per-path classification is defined without needing to know which side (source or target) an observed path came from — but a cross-type profile's declarations are side-qualified by requirement, and without a side-aware classification step actually threading that information through at evaluation time, side-qualified declarations cannot be relied upon to classify anything correctly. Rather than leave that side-awareness partially wired and unverified, this specification version excludes cross-type coverage entirely and requires implementations to reject it deterministically at construction.

---

## 10. Declared Equivalence and Normalizer Authority

The three-way separation is normative:

```
coverage classification  !=  declared equivalence relation  !=  normalizer implementation
```

For a normalized atom under relation `~_k`:

```
normalize_k(x) = normalize_k(y)  =>  x ~_k y        (soundness, REQUIRED)
```

is the required safety direction. If an implementation additionally claims its normalizer computes a canonical representative of each equivalence class, it **MUST** also satisfy:

```
x ~_k y  =>  normalize_k(x) = normalize_k(y)         (completeness, REQUIRED only when claimed)
```

**Profile-level requirements:**
- profiles **MUST** reference normalizers only by an opaque identity string.
- profiles **MUST NOT** supply an arbitrary inline normalizer implementation directly.
- normalizer meaning **MUST** be supplied by a separately-constructed normalizer authority, never assembled inline within the profile declaration.

**Authority requirements**, stated as properties, not as a mandated data structure:
- an authority **MUST** carry an explicit authority identity and an explicit authority version.
- an authority **MUST** reject, at construction, any attempt to admit two entries under the same normalizer identity.
- each admitted entry **MUST** carry its own normalizer identity, a declared equivalence-relation identity/kind, and an implementation.
- admitted entries **MUST** be immutable after authority construction.
- an authority **MUST** support lookup by normalizer identity.
- the evaluator **MUST** verify that the identity carried by a returned entry equals the identity that was requested; a mismatch **MUST** cause profile validation to fail closed.
- an unknown normalizer identity **MUST** cause profile validation to fail — whether because no authority was supplied at all, or because the supplied authority has no matching entry; these **MUST** be indistinguishable failure conditions.

**Explicitly out of scope (implementation guidance only, not normative):** how an authority *proves* implementation-identity provenance (e.g., source-file pinning, cryptographic hashing) is one possible binding-level technique, not a protocol requirement. This specification does **not** require Git blob identity, or any other specific provenance mechanism, generically.

---

## 11. Comparator Requirements

A conforming canonical-identity comparator is grounded against the frozen, language-neutral corpus at `conformance/canonical-identity-json-conformance-v0/vectors.json` (27 vectors, 4 mutant-rejection cases as of this specification version).

Documented, normative behavior:

| behavior | requirement |
|---|---|
| object key-order independence | two objects with identical key/value sets in different declaration order **MUST** canonicalize identically, including recursively into nested objects |
| object key total order | object keys **MUST** be sorted lexicographically by Unicode scalar value before JSON string escaping; a UTF-16 implementation **MUST NOT** use naïve code-unit `<` or a default code-unit sort as a substitute |
| array order significance | arrays **MUST NOT** be reordered or treated as sets; declared order is part of identity |
| duplicate-array significance | arrays **MUST NOT** be deduplicated; an element-count change is a real difference |
| presence-vs-absence | a key present with any value **MUST** canonicalize differently from the key being entirely absent |
| null-vs-absence | a key present with a `null` value **MUST** canonicalize differently from the key being absent; `null` is a present value |
| string case significance | no case-folding **MUST** be applied |
| no Unicode normalization | a comparator **MUST NOT** apply NFC/NFD or any other Unicode normalization |
| Unicode string domain | string values and object keys **MUST** be Unicode scalar-value sequences; a lone high or low surrogate **MUST** be rejected before canonicalization |
| `0`/`-0` behavior | documented as-is: positive and negative zero **MUST** canonicalize identically under this specification's reference numeric-to-string behavior; a domain requiring signed-zero distinction **MUST NOT** rely on this comparator to provide it |
| non-finite rejection | a comparator **MUST** reject non-finite numeric values outright |
| absent-value rejection | a comparator **MUST** reject a bare top-level absent/undefined-equivalent value, and **MUST** reject an object key whose value is absent/undefined-equivalent, distinctly from that key being entirely omitted |

**A conforming implementation MUST reproduce the vector corpus's outcomes exactly**, for both direct equality/inequality assertions and the documented mutant-rejection cases.

**Independent implementation evidence:** an independent clean-room Rust implementation exists at `interoperability/tsei-canonical-identity-rust-v0/`. It consumes the shared corpus without importing or transpiling the TypeScript reference implementation and reproduces all 27 vector outcomes plus all 4 mutant-rejection cases. This is bounded conformance evidence, not a proof over every possible input or every future implementation.

---

## 12. Relationship / Bundle Semantics

This specification does **not** introduce a first-class relationship-profile type.

- an artifact type **MAY** be a bundle, tuple, or collection of other artifacts, entirely supplied by a domain binding.
- relationship invariants **MAY** be included directly in a recompute procedure's evaluation result and protected by ordinary projections, exactly as any other surface.

**Explicit limitation, stated prominently:**

> Closed-world coverage is mechanically complete over observed structural value surfaces of an evaluated pair. It does NOT mechanically derive the complete set of domain relationship invariants. Relationship-invariant completeness remains binding/profile-authored.

**Rationale, not yet a formal theorem:** the stronger composition principle motivating this limitation is that *local validity must not imply composed validity unless the composition relationship itself has been independently recomputed and verified.* Two individually well-formed artifacts can be assembled into a bundle whose cross-artifact relationship was never actually checked by anything — this mechanism verifies whatever relationship a binding chose to fold into its recompute/projection logic, and nothing more. This specification does **not** claim the system automatically discovers a relationship invariant nobody declared; that remains explicitly out of scope, not a gap to be silently closed.

---

## 13. Interoperability Requirements

A portable binding **SHOULD** specify, where relevant to its domain:
- deterministic serialization — a canonical form with a total, specified ordering rule.
- numeric domain — an explicit range and literal-form restriction.
- duplicate-key behavior — reject, first-wins, or last-wins, explicitly specified.
- parser constraints — bounded resource limits (nesting depth, string length, array length, file size), distinct from the underlying domain's own possibly-unbounded semantics.
- ordering/comparator rules — whether any domain-level ordering is locale-dependent (outside a portable-interoperability claim) or codepoint-based (claimable as portable).
- escaping/encoding rules — specified byte-for-byte wherever a domain supplies identifiers needing escaped encoding; language-standard-library escaping functions **SHOULD NOT** be assumed portable without an explicit self-test.
- applicability rules — written down explicitly, not left implicit in one implementation's source.
- package/manifest topology — fixed, non-producer-chosen file/field layout for any interoperability package.
- transport-integrity checks — **MUST NOT** be treated as semantic validity. A digest matching **MUST NOT**, by itself, be accepted as evidence of preservation.

---

## 14. Conformance

Minimum generic conformance categories a conforming implementation **SHOULD** be tested against:
- positive vectors (preservation holds)
- must-fail vectors (`violation` expected)
- comparator vectors (Section 11's corpus)
- profile-invalid vectors
- selector conflict vectors
- cross-type rejection vectors (Section 9.1's boundary)
- cycle non-erasure vectors
- observed-path appearance/deletion vectors (Section 8's corpus)
- normalizer-authority adversarial vectors (naked resolver / unbranded authority / ID-substitution / duplicate-ID rejection)
- mutant sensitivity, for both the comparator and the path walker

**Evidence-type discipline, kept explicit:**
- **conformance evidence** — a fixed vector set is run against an implementation and produces the expected outcomes. Bounds behavior against known cases; does not prove absence of unknown-case bugs.
- **formal proof** — a property established by direct inspection of control flow or construction, independent of running any test (e.g., cycle non-erasure, observed-pair coverage-completeness).
- **independent implementation evidence** — a second, separately-authored implementation shown to agree with a reference. The canonical comparator has one instance of this category: the clean-room Rust implementation in `interoperability/tsei-canonical-identity-rust-v0/`, bounded to agreement on the shared 27-vector / 4-mutant corpus. The path walker currently has no independent second implementation. Tests of either implementation are conformance evidence over their exercised corpus, not full-domain proofs.

---

## 15. Security / Failure Considerations

| consideration | grounding |
|---|---|
| **author omission** | a hand-written preservation profile that forgets to declare a real protected surface silently lets mutations to that surface through undetected; Section 8's coverage mechanism exists specifically to catch this class mechanically |
| **normalization over-collapse** | a normalizer whose implementation is broader than its declared equivalence relation silently accepts mutations that should be violations; Section 10's mutant-rejection requirement exists to catch this |
| **malicious/incorrect authority** | an authority that returns an entry for a different identity than requested would let one normalizer's implementation be substituted for another's under a valid-looking ID; Section 10's requested-ID cross-check is the specific defense |
| **comparator over-collapse** | a comparator that treats semantically distinct values as equal makes every consumer of it blind simultaneously; Section 11's mutant-rejection requirement is the defense |
| **adapter-author bugs** | recompute/projection/applicability logic is trusted (Section 3); a bug there is not detectable by this mechanism and remains an explicit trust boundary |
| **endpoint laundering** | a sequence of transformations where an intermediate violation is followed by a restoring step, hoping the final state "looks fine" — Section 7's non-erasure requirement is the specific defense |
| **relationship omission** | a binding that fails to declare a relationship invariant it should have protected leaves that invariant entirely unchecked; Section 12 states this is not mechanically discoverable |
| **coverage-plane evaluation-time failure** | a non-finite number, an undefined-equivalent array element, or a throwing normalizer surfacing during observed-pair evaluation **MUST** yield `unresolved`, exactly as a flat-evaluation-time failure does (Section 6) — a conforming implementation **MUST NOT** let such a failure escape as an unhandled exception, and **MUST NOT** allow it to become `violation` |
| **parser/serialization divergence** | independently-authored parsers/serializers can silently disagree on numeric ranges, duplicate-key handling, or escaping — Section 13 exists specifically because this class of hazard has been found empirically in reference-binding evidence, not hypothesized |
| **resource exhaustion boundaries** | an unbounded parser is a denial-of-service surface for any interoperability claim; Section 13's bounded-resource-limit guidance exists to make any portability claim explicitly scoped |

**This specification does not overstate its security guarantees:** it defines a mechanism for detecting preservation violations under the trust model of Section 3, not a general security architecture. It provides no confidentiality, authentication, or availability guarantee of any kind.

### 15.1 Adversarial Motivation (Non-Normative)

The following generic failure shapes motivate several of the requirements above. They are described here in the abstract, as rationale, not as formal claims backed by vectors or evidence, and not as a dependency on any specific external system or incident:

- a derived value is correct in isolation, but its retrievability under real conditions was never independently verified.
- an observation is valid only under a hidden requester- or serving-side condition that the recorded evaluation does not capture.
- a presence predicate, originally intended only as an internal signal, gets silently promoted into a verification decision by a different consumer than the one that defined it.
- an identifier treated as locally cosmetic actually forms part of a frozen contract another party depends on.
- a false "everything is fine" result is produced by an undeclared serialization transformation between two otherwise-correct systems.
- individually valid objects, composed together, produce a stale or misleading composed claim because the composition relationship itself was never recomputed (see Section 12's rationale).

These shapes are kept generic and are not attributed to any named external party or incident. They are not elevated into normative requirements beyond what Sections 3–15 already state.

---

## 16. Explicit Non-Claims / Limitations

Repeated prominently, verbatim in substance:

1. Relationship-invariant completeness is not mechanically derived — it remains binding/profile-authored (Section 12).
2. Reactive observed-pair coverage is not schema-total static analysis — completeness holds only over the paths actually observed in one evaluated pair (Section 8).
3. A path absent on both sides of an evaluated pair, even if required by an underlying domain schema, belongs to lower object/domain validation — never to this mechanism's pairwise-preservation claim (Section 8).
4. Real, authenticated normalizer/equivalence-relation evidence breadth is currently n=1 in the reference implementation — the mechanism (Section 10) is structurally general, but its empirical necessity argument rests on thin evidence.
5. The comparator (Section 11) has one independent second-language implementation — bounded to the shared 27-vector / 4-mutant corpus; broader implementation diversity and full-domain equivalence remain unproven.
6. The path walker underlying Section 8 likewise has no second, independent implementation yet — conformance-evidenced only, via the corpus referenced in Section 8.
7. Adapter-authored transformation/recompute/applicability/projection semantics remain inside the trust boundary (Section 3) — independent recomputation removes trust in an artifact's self-report, never in the adapter code defining what recomputation means.
8. Cross-type coverage is not supported in this specification version (Section 9.1) — this is a deliberate exclusion, not a gap expected to close without a future specification revision.

### 16.1 Future Work: Invariant Sensitivity (Non-Normative, Not Implemented)

**Observation:** a declared invariant is not the same thing as a discriminating one. A declared invariant `I_k` may hold vacuously against every input a profile's author actually tested — it can be syntactically present in a profile while never having been shown to fail on any constructed counterexample.

**Candidate future conformance property, not specified or implemented by this document:** for each declared invariant `I_k`, construct a targeted mutant `m_k` designed to make `I_k` fail specifically, and require that the resulting failure be attributable to `I_k` — not merely that "some failure occurred" when `m_k` is evaluated. This would be a property about the *quality of a profile's own declared invariants* (an authoring-time or conformance-time concern), not a change to runtime verdict semantics.

This is recorded here as a candidate direction for future profile-conformance / invariant-sensitivity work. It is explicitly **not** implemented, **not** required, and **not** part of the verdict model (Section 5) or any normative section of this specification version.

---

## Reference Implementation Appendix (Non-Normative)

*This appendix is non-normative. Nothing in Sections 1-16 depends on it. The generic specification above can be implemented without reading ReceiptOS or Chronicle source.*

| abstract interface | current reference implementation |
|---|---|
| canonical identity comparator (Section 11) | `src/receiptos/challenge/canonical-identity-json.ts` |
| flat evaluator (Section 6) | `src/receiptos/challenge/transformation-stability.ts` |
| cycle evaluator (Section 7) | `src/receiptos/challenge/transformation-stability-cycle.ts` |
| closed-world coverage (Section 8, Section 9) | `src/receiptos/challenge/transformation-stability-coverage.ts` |
| normalizer authority (Section 10) | `src/receiptos/challenge/transformation-stability-coverage-normalizer-authority.ts` |
| ReceiptOS/Chronicle profiles | reference bindings only — `transformation-stability-chronicle-*.ts` and `transformation-stability-coverage-normalizer-registry.ts` instantiate the generic mechanism for the Chronicle domain; they do not define it |

ReceiptOS and Chronicle serve this specification in exactly three roles: **reference implementation** (the five modules above implement Sections 1-16 without requiring Chronicle knowledge), **reference binding** (the Chronicle-specific files above are one worked example of supplying profiles, recompute procedures, and a normalizer authority to the generic mechanism), and **empirical/adversarial evidence** (the independent Python/JS Chronicle producers referenced in Section 13's interoperability requirements, and the failure-shape rationale in Section 15.1). None of these three roles defines the generic specification; Sections 1-16 are complete without them.

---

## Conformance References (Non-Normative)

Two generic, language-neutral conformance corpora currently exist:

- **Canonical identity vectors** — `conformance/canonical-identity-json-conformance-v0/vectors.json` (27 vectors, 4 mutants). Referenced normatively by Section 11 and consumed independently by both the TypeScript and Rust implementations.
- **Observed leaf path vectors** — `conformance/observed-leaf-paths-conformance-v0/vectors.json` (19 walk vectors, 4 pairwise vectors, 4 mutants). Referenced normatively by Section 8.

The following are generic *tests* — evidence that the current reference implementation matches this specification — and are explicitly not themselves the specification, and not proofs:

- `tests/receiptos/canonical-identity-json-conformance-v0.test.ts`
- `tests/receiptos/observed-leaf-paths-conformance-v0.test.ts`
- `tests/receiptos/transformation-stability-generic-extraction-v0.test.ts`
- `tests/receiptos/transformation-stability-coverage-cross-type-rejection-v0.test.ts`
- `tests/receiptos/transformation-stability-coverage-failure-semantics-v0.test.ts`
- `tests/receiptos/transformation-stability-coverage-structural-contract-v0.test.ts`
- `tests/receiptos/transformation-stability-v0.test.ts`
- `tests/receiptos/transformation-stability-cycle-v0.test.ts`

A test passing demonstrates that one reference implementation currently produces the documented outcome for one constructed input. It does not demonstrate that the outcome is the only correct one, and it does not substitute for the structural/control-flow proofs and construction theorems this document identifies separately (Section 14).

---

## Document Status

This document defines specification v0. It records the generic mechanism as implemented and conformance-evidenced in this repository, including the four previously identified specification-readiness closures (structural path-walker conformance, the cross-type coverage boundary, coverage-plane failure-semantics alignment, and the generic artifact structural contract) and the Unicode scalar-order comparator closure. Every normative rule in Sections 3-11 is exercised against the current reference implementation; no rule in this document is known to contradict current reference behavior.
