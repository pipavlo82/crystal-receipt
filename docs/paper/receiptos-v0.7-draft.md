# ReceiptOS: A Portable, Recomputable Evidence Substrate for Verifiable Agent Execution

Pavlo Tvardovskyi
Independent Researcher — Verifiable Agent Infrastructure
`shtomko@gmail.com` | `github.com/pipavlo82`

Draft v0.7 — reconstructed source for review only.

> **Reconstructed-source note.**
>
> This Markdown draft is reconstructed from the authoritative published v0.6 PDF because
> canonical `main` currently exposes no tracked editable paper source or canonical paper
> build pipeline. The v0.6 PDF remains the authoritative baseline for inherited wording and
> structure. The v0.7 changes below are intentionally narrow and evidence-bounded.

## Abstract

Autonomous agents are becoming economic actors: they negotiate, spend, produce artifacts,
and act across trust boundaries on behalf of their owners. This creates a verification problem
that existing infrastructure does not fully solve. When an agent controlled by one party relies
on work performed by an agent controlled by another, the relying party must answer a narrow
but load-bearing question: does this action record recompute as claimed under its declared
derivation and proof rules, and can it be checked without trusting the system that produced it?

Prevailing approaches often answer a different question. Reputation registries and validation
networks aggregate signals about agents and rank them; the resulting trust is probabilistic,
subjective, and, because it is score-based, susceptible to optimization pressure. We argue that
a more primitive layer is missing upstream of such systems: a portable receipt for a single agent
action whose admissibility is recomputable from public commitments, rather than asserted by
the issuer or inferred from aggregate reputation.

We present ReceiptOS, an evidence substrate built around the Evidence Capsule Model. Each
agent action is captured as a canonicalized capsule that commits to its payload, policy boundary,
authorization, execution, and result. From this capsule, a receipt root is derived deterministically
so that any third party can recompute it from the raw capsule and compare it against an external
anchor, without trusting the backend that generated it. The design is organized around three
invariants: the receipt gates; it does not score; the receipt recomputes; and the anchor is a
pluggable commitment target rather than a fixed chain.

We make four contributions. First, we give a formal model of the evidence capsule and its
deterministic derivation, including a normative canonicalization profile with a byte-exact test
vector on which three separately authored implementations agree — the ReceiptOS
reference, a separately authored recompute-kit reproduction, and a from-spec rebuild produced from
the pinned specification alone, without sight of the other two, which is the sharpest instance of
the three. Second, we state a threat model covering seven adversaries, including a profile-
governance adversary that self-declares a permissive canonicalization profile. Third, we
demonstrate composition, rather than competition, with the emerging agent-execution stack,
through a worked cross-specification conformance vector, and expand the executable
conformance analysis with two bounded TEE evidence-class suites: a relay-side profile
(`tee-inference-v0`) that reproduces 10/10 vectors with a 3 verified / 4 rejected / 3
unverifiable partition, and an enclave-side profile (`tee-inference-enclave-v0`) that reproduces
11/11 vectors with a 7 verified / 4 rejected partition [15][16]. In the relay profile, signature
recovery and response binding are recomputed, request binding is broker-asserted, and enclave
quote evidence is attested or unavailable; in the enclave profile, request binding is recomputed,
DCAP/X.509 parsing and verification are performed, and the quote chain is verified to the
pinned Intel root [15][16]. These TEE additions are bounded: they are distinct evidence classes,
not a homogeneous merged suite; they are same-collaboration-thread evidence, not independent
external reproduction; and the enclave suite does not implement live Intel PCS freshness or
revocation, so it does not establish complete current-platform attestation verification. Fourth,
we position the capsule relative to the RAILS admissibility framework as a candidate
interchange format for REC-class evidence: recomputation preserves and makes independently
checkable the record correctness of the evidence a receipt carries; it does not elevate the
evidence’s verification class [3]. Throughout, we argue that recompute, don’t trust is a general
solution to reliable information propagation under adversarial or noisy conditions.

## 1 Introduction

### 1.1 The missing layer

The early agentic internet is often modeled as chat between models or API calls between
applications. This is incomplete. What is being transferred is no longer merely a message or a
document, but delegated agency: authority to search, decide, negotiate, spend, and affect
external state on behalf of an owner. A system that transports delegated agency must carry not
only content but also identity, intent, authority, settlement, and proof.

Several standards and systems now address parts of this stack. Identity and reputation registries
record who an agent is and how it has performed. Metering and bounded-action specifications
constrain how much authority an agent may consume. Protocol interaction manifests describe
how to interact with a system correctly. Validation networks attest to outputs with economic
consequence. Input-commitment schemes bind what an agent reasoned over before it acted.
Each of these is useful. But they share an implicit dependency: they assume that the record of
an individual agent action already exists in a form that a third party can verify. What is still
under-specified is a portable, recomputable receipt for that action. That is the gap ReceiptOS
addresses [1].

The question ReceiptOS answers is deliberately narrow: what should the receipt for a single
agent action look like, and how can it be verified without trusting the system that produced it?

### 1.2 Admissibility, not reputation

The dominant instinct in agent trust infrastructure is to aggregate and rank: collect signals about
an agent’s past behavior, compute a reputation, and let relying parties threshold on the result.
This can be useful, but it answers a different question and carries a structural weakness: a score
is a target. Any metric against which agents are optimized is eventually subject to optimization
pressure that may diverge from the underlying competence it was intended to measure.

ReceiptOS takes the opposite stance. It does not score an agent; it determines whether the
record of a specific action is admissible—whether the receipt for that action recomputes from
its public commitments. The gate is binary and local to the action: only a receipt that
recomputes passes. The verdict behind the gate additionally distinguishes a record that failed its
checks from one that could not be evaluated at all (Definition 4); neither passes. Reputation
systems, settlement layers, and validators remain free to consume admissible receipts and build
higher-level judgments on top of them. The receipt itself, however, makes no merit claim. We
call this discipline **gates, not scores**.

### 1.3 Recompute, don’t trust

The defining property of a ReceiptOS capsule is that verification is intrinsic to its construction
rather than applied afterward. A capsule commits to its contents such that its receipt root is a
deterministic function of the raw evidence. An independent party recomputes that root from
the capsule and checks it against an external anchor. Nothing in this path requires trusting the
issuer: a tampered or fabricated capsule fails to recompute, and that failure is detectable by any
verifier, not only by a privileged one.

This is an old solution to a familiar problem. Biological information copying uses the same
discipline: polymerase proofreads in-line, and mismatch-repair re-scans independently after
replication. Neither layer trusts that a competent process produced a correct copy; each re-
derives whether the copy matches what it should be. ReceiptOS follows the same two-level
structure: an issuer-side recompute during capsule construction, and a third-party recompute
against the anchor.

### 1.4 A note on structure: two levels

ReceiptOS distinguishes two levels of structure. At the outer level, a capsule is a schema-
validated document with eight required top-level objects: `schema`, `action`, `evidence`,
`receipt_root`, `proof_refs`, `verifier_result`, `capsule`, and `replay_manifest`. This is
the object a verifier reads and recomputes over.

At the inner level, the `capsule` object narrates a single action as an ordered set of conceptual
sections—such as payload, policy boundary, authorization, execution, evidence, result, and
related commitment material—that summarize phases of the action lifecycle. The pipeline
sketched above refers to this inner section sequence. The eight top-level objects form the outer
envelope that makes the artifact recomputable.

When we say that a receipt recomputes, we mean that the outer `receipt_root` is a deterministic
function of the canonicalized capsule; the inner sections are the content that root commits to.
The replay manifest enumerates exactly what an independent party needs to reproduce the
receipt from scratch. Broader conceptual distinctions, such as counterfactual or decision-trace
material, should be understood here as model-level structure rather than as a blanket claim
about every currently materialized implementation surface.

### 1.5 Contributions and structure

Section 2 defines the Evidence Capsule Model, its deterministic derivation, and the normative
canonicalization profile with a byte-exact test vector. Section 3 states the threat model: seven
adversaries the recomputation discipline answers, and the boundaries it does not claim. Section 4
develops the formal meaning of recompute-don’t-trust and gates-not-scores. Section 5 shows
how ReceiptOS composes with the agent-execution stack, including a worked cross-specification
composition example. Section 6 states the post-quantum durability layering argument; on-chain
benchmark artifacts are published separately. Section 7 positions the capsule relative to RAILS
as an interchange format for REC-class evidence, under class preservation rather than class
elevation. Section 8 describes conformance vectors and executable verification surfaces; in this
v0.7 draft, that executable conformance analysis is extended — not replaced — by two bounded
TEE evidence-class suites, one relay-side and one enclave-side, whose vector inventories,
partitions, and limits are stated explicitly [15][16]. Section 9 situates ReceiptOS against related
verification substrates, including attested execution as a complementary but non-substitutive
family. Section 10 states limitations and open problems, including the bounded Intel and
dependency-resolution caveats for the TEE suites.

## 2 The Evidence Capsule Model

### 2.1 Capsule as recomputable action record

ReceiptOS treats the receipt for a single agent action as a recomputable action record. The
central requirement is not that an issuer assert what happened, but that an independent verifier
be able to derive the same receipt commitment from the same action evidence under the same
declared rules.

Let `E` denote the evidence associated with a single action. Let `A(E)` denote the same
evidence with anchor-dependent fields removed. Let `C(·)` denote the canonicalization
function for the declared profile, and let `H(·)` denote the declared digest function. ReceiptOS
is built so that a verifier can compute a deterministic receipt commitment from `A(E)` alone,
without consulting the anchoring backend that may later carry or export that commitment.

### 2.2 Outer structure

- `schema`
- `action`
- `evidence`
- `receipt_root`
- `proof_refs`
- `verifier_result`
- `capsule`
- `replay_manifest`

These objects divide the problem of verification into explicit layers. `schema` identifies the
format and version; `action` identifies what happened; `evidence` carries the evidence body over
which recomputation is defined; `receipt_root` carries stored and recomputed root state;
`proof_refs` carries structural and exported commitment references; `verifier_result` carries an
admissibility verdict, not a score; `capsule` carries the inner narrative; `replay_manifest` makes
recomputation explicit.

### 2.3 Inner structure

At the inner level, the `capsule` object narrates the lifecycle of a single action as an ordered set
of semantically distinct sections. Typical sections include payload, policy boundary,
authorization, decision trace, execution, evidence, counterfactual, result, and commitment
stages. These sections determine the semantic scope of what the receipt root commits to. If two
conforming implementations process the same section content under the same canonicalization
profile, they must derive the same receipt root.

Counterfactual and decision-trace sections are conceptually powerful but should not be read as
claims that every currently materialized implementation surface already fully supports them.
They are model-level sections whose full representation remains an area for continuing
hardening.

### 2.4 Receipt-root object

The `receipt_root` object exposes the minimum state required for transparent local verification.
In v0 this object carries `stored`, `computed`, `match`, and `status`; `status` surfaces the ternary
verdict of Definition 4, so that non-evaluability is reported explicitly rather than collapsed into
failure or silence. It does not express reputation, quality, confidence, or any other ranking
semantics. It is a comparison witness, not a score.

**Definition 2 (Anchor-stripped evidence).** Let `E` be the evidence object of a capsule. The
anchor-stripped evidence `A(E)` is the evidence object obtained by removing exactly the fields
that the declared profile designates as anchor-dependent. A conforming profile **must**
enumerate its anchor-strip set exhaustively, so that `A(·)` is a closed, mechanical operation
rather than an open-ended semantic one. This enforces the invariant that anchoring must not
participate in root derivation. Under `receiptos-c14n-v0` the strip set is exactly the top-level
`anchor` field (Section 2.8, rule 4); a capsule that carries anchor-dependent values anywhere
else is malformed under that profile.

### 2.5 Proof references

The `proof_refs` object carries downstream commitment references. It has two distinct roles:
membership proof material, such as Merkle paths proving how a receipt root sits under a larger
commitment root; and anchor reference material, identifying where a commitment root was
exported or externally recorded.

Merkle verification answers whether the recomputed receipt root belongs to the declared
structural commitment. Anchor verification answers whether a declared structural commitment
was exported to some external target.

**Definition 3 (`receipt_root` derivation).** Let `E` be the evidence object of a capsule, `A(E)` its
anchor-stripped form, `C(·)` the canonicalization function under the declared profile, and `H(·)`
the declared digest function. The receipt-root derivation is:

`RR(E) = H(C(A(E)))`

A verifier recomputes `RR(E)` from the evidence object and compares it to
`receipt_root.stored`.

**Definition 4 (Receipt admissibility).** A receipt `R` for a single action record receives exactly
one of three verdicts under a consumer’s evaluation:

- **admissible** iff the declared profile is recognized by the consumer, `receipt_root.stored =
  RR(E)` under that profile, and all proof paths required by that profile verify successfully;
- **inadmissible** iff evaluation under a recognized profile completes and any required check
  fails (stored/computed mismatch, a proof path that does not close, or a schema violation
  detected during evaluation);
- **could-not-evaluate** iff no verdict can be computed under consumer-recognized rules: the
  declared profile is outside the consumer’s recognized set (Section 3.5), or required fields or
  references are absent or unresolvable such that evaluation cannot complete.

The verdict is ternary; the gate is binary. Only admissible passes: `Adm(R) = 1` iff the verdict
is admissible, and `Adm(R) = 0` otherwise. Could-not-evaluate never maps to admissible —
the gate fails closed. The verdict is local to the action record and deterministic given the
capsule, the consumer’s recognized-profile set, and the declared rules.

### 2.6 Replay manifest

The replay manifest exists to make recomputation explicit rather than implied. It enumerates
the information an independent verifier requires to reproduce the receipt from scratch under the
declared profile: canonicalization version, digest function identifier, evidence dependencies,
attachment hashes, replay ordering assumptions, proof verification inputs, and external
reference locators. The replay manifest does not itself determine the receipt root; it makes the
derivation procedure operationally reproducible.

### 2.7 Deterministic derivation

1. Read the evidence object `E`.
2. Construct `A(E)` by removing anchor-dependent fields.
3. Canonicalize `A(E)` under the declared profile.
4. Encode the canonicalized form as the profile-specified byte string.
5. Apply `H(·)` to obtain `RR(E)`.
6. Compare `RR(E)` to `receipt_root.stored`.
7. Verify required membership or anchor proof paths.

**Definition 5 (Proof-path validity).** A proof path for a receipt is valid iff every proof
component required by the declared profile succeeds when evaluated against the recomputed
receipt root.

**Definition 6 (Conforming implementation).** An implementation is conforming to a
ReceiptOS profile iff, for every canonical test vector under that profile, it computes the same
receipt root as every other conforming implementation and produces the same proof-path
validity and admissibility result.

### 2.8 Normative canonicalization profile: `receiptos-c14n-v0`

Section 10.2 identifies canonicalization as the hard dependency of the entire scheme; it must
therefore be stated normatively in the paper, not delegated to an implementation. The
serialization semantics of the profile are not novel, and deliberately so: `receiptos-c14n-v0`
adopts the JSON Canonicalization Scheme (JCS, RFC 8785 [13]) by reference — ECMAScript
`JSON.stringify` number and string serialization, lexicographic key ordering by UTF-16 code
unit, literal UTF-8 emission, and exclusion of absent keys are all JCS behavior. The profile’s
sole normative addition is the anchor-stripping step (rule 4 below); the prohibition on non-
finite numbers is inherited from JCS.

Stated in full, the profile `receiptos-c14n-v0`, which all conformance vectors in this paper use,
is the following total function `C(·)` from a JSON value to a byte string:

1. **Scalars.** `null`, booleans, numbers, and strings serialize per RFC 8259 with
   ECMAScript `JSON.stringify` semantics. Non-finite numbers are prohibited at hash-
   relevant positions; a capsule containing them is malformed.
2. **Arrays.** Element order is preserved; elements are canonicalized recursively and joined
   with a bare comma.
3. **Objects.** Keys whose value is absent/undefined are excluded. Remaining keys are sorted
   lexicographically by UTF-16 code unit. No whitespace appears anywhere in the output.
4. **Anchor stripping.** The top-level `anchor` field is deleted before canonicalization; under
   this profile it is the entire anchor-strip set of Definition 2.
5. **Encoding and digest.** The canonical string is encoded as UTF-8; `H` is SHA-256 over
   those bytes; `receipt_root` is rendered as `0x` followed by 64 lowercase hex characters.

**Test vector (inline, byte-exact).** Input evidence object:

```json
{"b":1,"a":{"y":"π","x":[true,null,"0x2a"]},"anchor":{"txHash":"0xdead"}}
```

After anchor stripping and canonicalization, the canonical form is the 45-byte UTF-8 string:

```json
{"a":{"x":[true,null,"0x2a"],"y":"π"},"b":1}
```

and `receipt_root = 0xe61c9a9eed9e1d7eb5107acd9bb71d53cee9fcdae806444f4dc93b2f9694c2ae`.
A conforming implementation must reproduce this value byte-exactly [13].

## 3 Threat Model

### 3.1 Adversary 1: malicious issuer

The issuer controls capsule construction and may fabricate, alter, reorder, or selectively omit
evidence after the action occurred, or emit a capsule whose carried root does not correspond to
its contents. Against post-derivation tampering the guarantee is direct: any modification to the
anchor-stripped evidence changes `C(A(E))` and therefore `RR(E)` (Definition 3), so the receipt
fails the stored/computed comparison for every verifier, not only a privileged one.

The honest boundary is equally direct: an issuer who lies in the evidence from the start —
fabricating plausible inputs before derivation — produces a capsule that recomputes perfectly.
Admissibility proves record integrity, not testimonial truth.

### 3.2 Adversary 2: compromised anchor

The anchor may censor exports, reorder them, equivocate between observers, or attempt to
substitute commitment roots. The structural defense is the anchor-stripping invariant:
because anchor-dependent fields are excluded from derivation, no anchor action can make an
inadmissible record admissible or retroactively confer correctness.

### 3.3 Adversary 3: colluding or dishonest verifier

A verifier, or a coalition of them, may falsely report that an inadmissible receipt verified, or
that an admissible one failed. The model’s answer is that the verifier holds no privileged role
(Section 8.6): admissibility is a deterministic function of the capsule and the declared profile,
so any party can recompute it independently.

### 3.4 Adversary 4: transport tampering

An adversary between issuer and consumer may modify the capsule in transit — flipping bytes,
splicing digests, truncating fields — including well-meaning corruption such as abbreviation of
hexstrings in human-mediated channels. All such modifications land in the same place: the
received evidence no longer recomputes to the carried root, or required fields fail schema
validation, and the receipt fails conservatively.

### 3.5 Adversary 5: self-declared profile (governance)

Admissibility is defined under the declared profile, and the capsule declares its own profile —
so a malicious issuer can declare a permissive canonicalization profile of its own design and
recompute cleanly under it. Nothing inside the artifact prevents this; the defense is necessarily
on the consumer’s side: profile trust is pinned by the consumer, never by the issuer’s
declaration [8].

### 3.6 Adversary 6: equivocation

An issuer or anchor may present different artifacts to different observers: two capsules for the
same action, or two commitment roots exported to different audiences. Within a single artifact,
recomputation is unaffected — each observer’s copy either recomputes or does not. What
recomputation alone does not establish is uniqueness.

### 3.7 Adversary 7: cross-anchor replay

An adversary may take a valid anchor reference from one context and splice it into another
capsule’s `proof_refs`, or replay an export made under one anchor into claims about another.
Because anchor material is outside root derivation, such splicing cannot make a tampered record
recompute; what it can attack is the discoverability claim. The defense is that anchor
verification is itself recomputable: the membership leg must close against the recomputed
receipt root, and the anchor leg must resolve on the claimed target with the claimed root.

### 3.8 Out of scope

Four things this model deliberately does not defend:

- evidence truthfulness;
- confidentiality;
- issuer key management;
- anchor availability under sustained denial.

### 3.9 Summary

No mechanism in this section is new: every defense is a restatement of Definitions 2–6 and the
layer separations already in force. That is deliberate, and it is the property to want: a threat
model that requires additional machinery to answer its adversaries is a design admitting gaps.

## 4 Recompute, Don’t Trust; Gates, Not Scores

### 4.1 Two distinct questions

ReceiptOS separates two questions that are often conflated in agent-trust systems. The first is
local and action-specific: does this receipt recompute and do its required proof paths verify
under the declared profile? The second is global and actor-oriented: should this agent,
provider, runtime, or institution be trusted more generally? ReceiptOS addresses the first
question and explicitly does not attempt to answer the second.

### 4.2 Admissibility as a binary predicate

Section 2 defined the verdict for a receipt as ternary: admissible, inadmissible, or could-not-
evaluate (Definition 4). The gate itself remains binary: only an admissible receipt passes, and
both failure and non-evaluability fail closed.

`Adm(R) ∈ {0, 1}`

This is the operational meaning of **gates, not scores**.

### 4.3 Why scores are structurally different

A score aggregates signals across time, tasks, or observers and converts them into a value
intended to support ranking or thresholding. Such a value may be useful for downstream
systems, but it is structurally unlike a recomputation predicate. Scores invite optimization
pressure.

### 4.4 Recompute, not trust

ReceiptOS is built on the premise that verification should be intrinsic to the artifact rather than
delegated to the authority of its producer. The issuer’s assertion is never sufficient. The verifier
must be able to re-derive the decisive commitment from the evidence itself:

`RR(E) = H(C(A(E)))`

### 4.5 Two-layer verification discipline

The recomputation discipline has two layers. The first is issuer-side: a producer system should
derive its own receipt root from the action evidence under the declared profile and refuse to emit
a record whose carried root does not close over its contents. The second is verifier-side: a third
party independently recomputes the same root and verifies any required proof paths.

### 4.6 Failure semantics

Failure in ReceiptOS is explicit and conservative. If recomputation fails, the receipt does not
become low confidence or partially trusted. It falls below the admissibility floor for the claim
being made.

### 4.7 Consequences for downstream systems

A settlement layer may require an admissible receipt before releasing funds. A history layer may
require admissible receipts before recording continuity. A reputation system may require
admissible receipts before counting outcomes toward a score. But none of those functions can
be pushed back into the receipt itself without changing its role.

### 4.8 Summary

A receipt is not a score, a reputation, or a generalized trust signal. It is an admissibility object
for a single action record.

## 5 Composition with the Agent-Execution Stack

### 5.1 Upstream and downstream position

ReceiptOS is not designed to function as an identity registry, execution runtime, settlement rail,
or reputation system. Its scope is narrower and more primitive: it defines a portable,
recomputable receipt for a single agent action record and the verification discipline by which
that record is determined to be admissible.

Upstream of ReceiptOS are systems responsible for agent identity, bounded authority,
execution runtimes, input capture or input commitment, and external attestations or transport
proofs. Downstream of ReceiptOS are settlement release, portfolio continuity, validation
registries, scoring, reputation, archive, indexing, and provenance graph construction.

### 5.2 Composition with identity and validation layers

Identity systems answer who acted. Validation systems answer who endorsed, accepted, or
externally checked the result. Both are important, but neither by itself defines a recomputable
single-action receipt. ReceiptOS composes with identity by permitting the receipt and its
auxiliary profiles to carry identity-bound signature material without treating that material as
constitutive of the receipt root. It composes with validation by giving validators a portable
proof-bearing record to consume, while not collapsing validator opinion into receipt truth.

### 5.3 The input-commitment seam

One of the most important composition boundaries is the seam between action evidence and
committed input state. In many agentic workflows, a verifier cares not only about what action
occurred, but also about what committed input set the action reasoned over. ReceiptOS
therefore reserves a composition seam for committed input state.

### 5.4 A worked composition example: the WYRIWE seam

Composition claims are cheap; a composed conformance vector is not. We therefore report one
worked cross-specification composition that has been executed and independently re-verified,
rather than architecturally sketched.

WYRIWE is an input-commitment specification that binds the committed input state an agent
reasoned over before acting. The composition proceeded as follows. First, the field mapping was
publicly pinned: WYRIWE’s commitments enter the receipt under two declared fields,
`input_commitment.raw_input_hash` and `input_commitment.sanitization_pipeline_hash`,
with a declared dependency on the upstream specification. Second, both sides produced their
halves of a composed conformance vector: a WYRIWE-side commitment chain and a
ReceiptOS-side receipt over it. Third, in the course of recomputation, a genuine specification
gap was discovered and closed: the genesis case of the receipt hash chain was not derivable from
the informal `sha256(decision ∥ prev)` shorthand. The encoding was pinned by elimination as:

`receipt_sha256 = sha256(utf8(decision_hex + "|" + prev_hex))`

with `prev_hex = ""` at genesis and the delimiter always retained. Fourth, a three-case test
vector (genesis · linked · chain-tamper) was contributed and folded into the composed vector,
so that agreement covers the degenerate case, the linked case, and a mandatory rejection case.

The resulting composed vector recomputes byte-identically across three independently-authored
implementations: the ReceiptOS reference canonicalization, an independent recompute-kit
reproduction, and an external pre-publication verification gate whose author rebuilt the
derivation from the pinned specification alone, without sight of the other two, and additionally
reproduced all negative-rejection cases with matching rejection reasons [7]. The full vector with
its replay script is published as a standalone artifact [6]. The independence claimed here is of
authorship and method — not of project affiliation. The from-spec rebuild’s author works within
the broader collaboration, and reproduction by parties fully outside the project has not yet been
obtained.

Two honest boundaries on this example. It demonstrates the composed-vector seam: a cross-
specification record that recomputes under both specifications’ declared rules. The general input-
commitment schema slot on the reference implementation’s mainline remains draft-scoped until
the corresponding attestation slot shape is pinned with its upstream author, and Section 8 reports
it as such.

### 5.5 Producer adapters and neutrality

A substrate that claims neutrality must be precise about what kind of neutrality it claims. The
reference implementation attaches producers through adapters: translation surfaces that map a
runtime’s native evidence into the capsule’s evidence object, after which derivation proceeds
identically regardless of origin.

These integrations are not sociologically equidistant, and we do not claim they are. The
reference implementation was developed in design partnership with one agent runtime —
Stealth, within the CYPHES ecosystem — and its adapter, integration-status documentation,
and test fixtures are correspondingly the deepest in the repository, alongside adapters for
unaffiliated runtimes. The neutrality claim is structural, not sociological.

### 5.6 Why composition matters more than ownership

Infrastructure stops being infrastructure when it becomes semantically owned by a single
application. A receipt layer defined only as receipts emitted by one system cannot serve as
neutral substrate for multiple systems with different runtimes, validators, or settlement
environments.

### 5.7 Byte-identical recomputation across implementations

Composition is meaningful only if it survives independent implementation. ReceiptOS treats
byte-identical recomputation as a first-class conformance target. Cross-implementation
agreement requires stable rules for field inclusion and exclusion, anchor stripping, canonical key
ordering, separators and byte encoding, degenerate proof cases such as the one-leaf Merkle path,
and named composition seams when present.

### 5.8 Compose, not compete

ReceiptOS does not compete with identity systems, validation systems, execution runtimes,
settlement layers, or continuity layers. Instead, it contributes a narrower but load-bearing
object: a receipt for a single action whose admissibility is recomputable from public
commitments and whose commitment export can be anchored downstream without altering its
semantics.

## 6 Post-Quantum Durability

### 6.1 The durability problem

A receipt is a deferred object. Its value lies in the fact that it can be verified later: in a dispute,
an audit, a portfolio review, or a provenance check long after the underlying action has
completed. ReceiptOS separates post-quantum durability into three layers: integrity,
attribution, and randomness.

### 6.2 Stable integrity vs upgradable attribution

The ReceiptOS integrity layer is built from recomputable commitments. Its core semantic object
is the `receipt_root`, defined by deterministic derivation from the action evidence under the
declared profile. The attribution layer is scheme-dependent.

**Proposition 1 (Durability Layer Separation).** The semantic validity of a ReceiptOS receipt
is determined by `receipt_root` recomputation and proof-path validity, and is independent of
any specific signature scheme used to attest to or transport the receipt.

### 6.3 PQ signature slot model

ReceiptOS treats post-quantum durability as an attestation-profile problem layered on top of a
stable recomputation substrate. The current model uses a reserved PQ signature slot shape
represented schematically as `sig_pq.type` and `sig_pq.signerHashed`.

### 6.4 On-chain verification cost, stated honestly

Measured benchmark artifacts for a Solidity ML-DSA-65 verification track are published
separately [4][5] rather than in this paper. The headline number argues for itself: the measured
end-to-end verification path costs on the order of 68.9M gas, which exceeds recent Ethereum
mainnet block gas limits severalfold.

### 6.5 Practical deployment profile

The practical deployment profile is layered: keep the semantic core of the receipt at the integrity
layer; use the signature layer for attribution durability; avoid forcing heavy post-quantum
verification into every ordinary execution path when cheaper decomposition is available.

### 6.6 Forward-looking randomness layer

A complete long-horizon receipt stack will likely need to extend beyond signatures to
randomness-dependent processes. ReceiptOS does not require a post-quantum VRF or equivalent
randomness proof for core receipt admissibility and makes no claim that such mechanisms are
already integrated into the current implementation track.

### 6.7 Summary

Post-quantum durability in ReceiptOS is best understood as a layer-separation problem. The
integrity layer is anchored in recomputable commitments and remains semantically stable across
signature-profile changes. The attribution layer is upgradeable. The randomness layer is a
forward-looking completion path rather than a prerequisite for current receipt admissibility.

## 7 Relation to RAILS: An Interchange Format for REC-Class Evidence

### 7.1 Why RAILS is relevant

ReceiptOS is not a clearing protocol, settlement protocol, or obligation language. Its scope is
narrower: it defines a portable, recomputable receipt for a single agent action and a verification
discipline for determining whether that receipt is admissible. RAILS is relevant because it
classifies evidence by verification basis [3, §5.1].

### 7.2 What RAILS explicitly provides

`SELF ⪯ SIGN ⪯ {WIT, REC} ⪯ ATT ⪯ PROOF`

RAILS Section 5.6 adds a guardrail: generic receipt-verifier behavior is not automatically
elevated to PROOF. Depending on origin and verification basis, a receipt verifier may rest on
REC or ATT [3, §5.6].

### 7.3 Class preservation, not elevation

ReceiptOS defines a receipt whose record correctness is determined by `receipt_root`
recomputation and proof-path validity. Recomputation proves that the record presented is
exactly the record committed — intact, unspliced, and independently checkable. It does not
change the verification basis of the evidence the record carries. We state this as the section’s
central claim: the receipt preserves the class of the evidence it carries and makes its record
correctness independently verifiable; it does not elevate it [3].

### 7.4 What recomputation adds within the class

Relative to SIGN, recomputation adds independent verification of record correctness under
declared derivation rules, where a signature alone provides only non-repudiation about who
endorsed the record. Relative to bare REC, it removes the need to accept that some external
system emitted the record intact.

### 7.5 Guardrails against overclaiming

RAILS does not define ReceiptOS by name. RAILS Section 5.6 warns against generic receipt
overclaiming — a receipt is not elevated by being called a receipt or signed by an issuer — and
this paper takes that guardrail as its own framing [3].

### 7.6 What the mapping does not claim

- that the broader obligation was satisfied
- that the action was normatively correct in every domain-specific sense
- that a clearing decision should be emitted
- that a settlement instruction should execute
- that the actor deserves reputation gain or loss
- that the verification class of the carried evidence is elevated by the receipt

### 7.7 Summary

RAILS provides a useful external admissibility framework because it distinguishes verification
bases rather than flattening them into a score. Within that framework, ReceiptOS contributes an
interchange format for REC-class evidence: a portable, canonicalized, anchor-committed record
whose correctness any consumer re-establishes by recomputation. The class of the evidence is
preserved; what changes is that its record integrity no longer rests on trust in the producer.

## 8 Conformance Vectors and the Independent Verifier

### 8.1 Why conformance matters

A receipt substrate cannot function as shared infrastructure unless independent verifiers can
derive the same answer from the same action record. ReceiptOS therefore treats conformance
vectors as first-class artifacts. For the current implementation track, v0.6 used three real
executable verification surfaces: the TypeScript reference path in `crystal-receipt`, which
implements and maintains ReceiptOS; the static browser verifier in
`docs/receipt-verifier/index.html`; and the script/fixture-driven replay path in `scripts/*` and
`src/receiptos/fixtures/*`. These are real execution paths, not three fully independent
ecosystems.

For v0.7, this executable conformance discussion is extended by two additional, bounded
evidence-class suites drawn from immutable upstream artifacts: a relay-side TEE profile and an
enclave-side TEE profile [15][16]. These do not replace the v0.6 conformance surfaces; they
extend the paper’s account of how distinct verification surfaces can be pinned, executed, and
bounded.

### 8.2 Cross-implementation reproducibility

**Definition 7 (Cross-implementation reproducibility).** A conformance vector is reproducible
iff all conforming implementations derive identical `receipt_root` values and identical
admissibility outcomes for that vector under the declared profile. The role of conformance
vectors is to make both positive agreement and negative rejection agreement explicit.

### 8.3 Vector classes

The conformance model is intended to cover at least the following classes: canonicalization
vectors, anchor-stripping vectors, one-leaf Merkle vectors, multi-leaf Merkle vectors, input-
commitment seam vectors, tamper negative vectors, and missing-field negative vectors.
Multi-leaf Merkle and input-commitment seam vectors should remain marked as planned or
draft-scoped unless re-verified on current main.

### 8.4 Table of current conformance vectors

| Vector | Status | Byte-identical root? | Notes |
|---|---|---|---|
| Canonicalization | Current | Yes | Sorted-key canonicalization yields same `receipt_root` across reference, browser, and script surfaces. |
| Anchor stripping | Current | Yes | Anchoring is downstream of `receipt_root` derivation. |
| One-leaf Merkle | Current | Yes | `leaf_index=0`, `proof=[]`, `merkle_root=receipt_root` is valid membership. |
| Multi-leaf Merkle | Planned / partial | Planned | Non-trivial path semantics should be distinguished from fully locked conformance evidence. |
| Input-commitment seam | Planned / draft-scoped | Planned | Architectural seam; optional and draft-scoped until re-verified on current main. |
| Tamper negative | Current | No (`stored/computed` mismatch) | Agreement is on rejection semantics. |
| Missing-field negative | Current | N/A | Agreement is on rejection before admissible root exists. |

**Table 2.** Current conformance vector status.

### 8.5 Positive and negative agreement

Positive conformance vectors establish that identical evidence under identical rules yields
identical `receipt_root` values and proof-verification outcomes. Negative vectors are equally
important: a verifier should fail deterministically on malformed or tampered inputs. Agreement
on rejection semantics matters because ambiguity at the point of failure is itself semantic
divergence.

### 8.6 Independent verifier

The independent verifier is not a privileged authority. Its value comes from separation from the
producer, not institutional status.

**Proposition 2.** In ReceiptOS, the trust contribution of an independent verifier arises from its
ability to reproduce `receipt_root` values and admissibility outcomes from shared evidence under
shared rules, rather than from special authority.

### 8.7 Relay and enclave TEE evidence-class suites

The v0.7 addition is not a merged homogeneous TEE package; it is two separately named,
separately bounded executable profiles.

**Relay profile: `tee-inference-v0`.** The pinned upstream authority is recompute-kit PR #2 at
immutable commit `73d6a1307a3671cd6fa713b5911936d333a4a498`; the relay vectors SHA-256
is `c02f8af51edef5038a76b9e30ab7ef4781d3d66bd4eafe00146fe225ddbb2a69` [15]. The relay
suite contains exactly 10 vectors; all 10 reproduced. The outcome partition is 3 verified, 4
rejected, 3 unverifiable. The verified claim boundary is narrow: signature recovery is
recomputed; response binding is recomputed; request binding is broker-asserted; enclave quote
evidence is attested or unavailable [15].

**Enclave profile: `tee-inference-enclave-v0`.** The pinned upstream authority is the same
immutable recompute-kit PR #2 commit together with the associated TMerlini gist revision
`060f2f995169b99abae2fdc43d31c7a3e1e9157b`; the enclave vectors SHA-256 is
`b197809da7198f8854cc9d17036b46c7ad16466155bc0657c5197d204da82d2e`, and the primary
enclave artifact SHA-256 is `ada9731bd58620ce5dc148e907903b786439dbad7b6f00e26b25e698e0cec78d`
[15][16]. The enclave suite contains exactly 11 vectors; all 11 reproduced. The outcome
partition is 7 verified, 4 rejected. The verified claim boundary is likewise narrow: request
binding is recomputed; DCAP/X.509 chain parsing and verification are performed; and chain-
of-trust verification reaches the pinned Intel root [15][16].

These two suites extend the paper’s executable verification-surface discussion by making the
evidence class itself explicit. They do **not** establish a single fused TEE verdict, and they do
**not** justify collapsing relay-visible and enclave-visible evidence into one undifferentiated
class.

### 8.8 What remains to be shown

Any stronger cross-implementation claim must continue to enumerate which executable surfaces
were tested, which vectors were exercised, what equality criterion was used, and whether
agreement concerned a positive `receipt_root` value, a proof-path result, or a rejection
condition. Conformance is a reproducibility property open to expansion, falsification, and
tightening.

For the TEE profiles specifically, one further caveat is operational rather than semantic: the
suite artifacts and vector bytes are immutable, but the successful rerun environment was not
lockfile-frozen. The upstream commit carried `package.json` with `ethers: ^6.13.0` and no
lockfile; successful execution used `bun install`, Bun `1.3.14`, Python `3.12.10`, and resolved
`ethers@6.17.0` [15]. This is a reproducibility caveat, not a semantic failure of the suites.
Reproduction of these TEE suites by parties fully outside the current collaboration remains open.

### 8.9 Summary

ReceiptOS relies on conformance vectors to make reproducibility visible. A receipt substrate
cannot become neutral infrastructure merely by declaring that it recomputes; it must show that
multiple executable surfaces derive the same `receipt_root` values and the same admissibility
outcomes from the same artifacts. The current implementation track supports this discipline
across canonicalization, anchor stripping, Merkle closure, and negative rejection cases, with
seam composition treated as planned / draft-scoped future work. The v0.7 TEE relay and
enclave suites strengthen the same contribution by showing that executable conformance can
also distinguish bounded evidence classes without collapsing them into a stronger claim than the
underlying verifier actually establishes.

## 9 Related Work

ReceiptOS borrows a discipline that several adjacent fields have already validated: correctness re-
derived from public commitments rather than asserted by a producer. This section situates the
capsule model against the nearest neighbors and states what each does not provide.

**Software supply-chain attestation.** `in-toto` [9] and SLSA [10] define signed, layout-verified
attestations over the steps of a software build pipeline. They share ReceiptOS’s producer-
skepticism, but their attestations are fundamentally signature-and-policy objects over a known
pipeline topology.

**Content provenance.** C2PA [11] binds provenance manifests to media assets so that
consumers can trace edit history. Like ReceiptOS it is a portable evidence format, but its trust
base is certified signing identities within an issuer PKI.

**Transparency logs.** Certificate Transparency [12] and Sigstore’s Rekor [14] make issuance
events publicly auditable through append-only Merkle logs. These systems solve visibility; the
logged record itself is still an assertion by its issuer. ReceiptOS is complementary.

**Attested execution.** TEE-based remote attestation strengthens claims about the environment
in which code ran. As discussed in Section 7.4, an attested runtime raises the floor of the
execution environment but does not substitute for replay of the commitment path; attestation
evidence composes with the capsule as auxiliary material rather than replacing recomputation.
The new TEE suites in Section 8 keep this boundary explicit: the relay profile and enclave
profile are distinct executable evidence classes, not a universal statement about TEE security
[15][16]. The enclave profile verifies the quote chain to the pinned Intel root, but it does not
implement live Intel PCS freshness or revocation, and therefore does not establish complete
current-platform attestation verification [15][16].

**Agent trust standards.** The emerging agent-execution stack — identity and reputation
registries, bounded-action metering, protocol interaction manifests, validation networks, and
input-commitment schemes such as WYRIWE — was discussed throughout Section 5, together
with a worked composed conformance vector. RAILS [3] is the closest conceptual neighbor:
it classifies evidence by verification basis, and Section 7 positions this work within its lattice.

Across all five families the distinguishing commitments of ReceiptOS are the same three
invariants stated in the abstract: admissibility is a recomputation predicate rather than a
signature or a score; the receipt gates a single action record rather than rating an actor; and the
anchor is a pluggable export target that never participates in root derivation.

## 10 Limitations and Open Problems

### 10.1 ReceiptOS does not solve the whole stack

ReceiptOS does not solve identity, execution safety, dispute resolution, settlement, or global
reputation. It assumes that such layers either exist elsewhere or remain open design problems.
Its purpose is to define a portable, recomputable receipt for a single agent action, not to absorb
every surrounding trust function into one artifact.

### 10.2 Canonicalization remains a hard dependency

Recomputability is only as strong as the canonicalization discipline beneath it. Any ambiguity in
field inclusion, anchor stripping, ordering, separators, encoding, or degenerate proof cases
threatens interoperability. Continued canonicalization hardening is therefore a first-order
requirement.

### 10.3 Seam discipline is stronger than seam coverage

This paper treats certain seams—especially input commitment—architecturally. It identifies
where such structures belong in the receipt model and why their placement matters, but does
not claim that every such seam is already fully locked in current mainline conformance
evidence.

### 10.4 Counterfactual representation remains immature

The counterfactual section is conceptually powerful because it attempts to capture not only what
an action did, but what it could have done within its authorized envelope. In practice, portable
representation of what did not happen remains immature and is not treated here as a solved
engineering problem.

### 10.5 Anchor diversity introduces profile complexity

The anchor is intentionally pluggable. This improves portability but introduces profile
complexity. Different anchoring targets may differ in export cost, availability, external trust
assumptions, and verification semantics. The open problem is how far anchor diversity can
expand before interoperability fragments operationally, even if core receipt semantics remain
stable.

### 10.6 Post-quantum durability is not free

Post-quantum attribution durability can be costed and benchmarked, but signature size,
verification gas, transport cost, and deployment complexity remain significant. Better
normalization, verifier engineering, and possibly randomness integration will be needed before a
full long-horizon receipt stack is mature.

### 10.7 Chronicle-like continuity remains downstream

ReceiptOS addresses admissibility for a single action record. Chronicle-like systems address
continuity, historical accumulation, and downstream views over multiple admissible records.
Chronicle is therefore best understood as a downstream consumer of admissible receipt objects
rather than as part of the receipt substrate itself [2].

### 10.8 A speculative remark on emergent admissibility gradients

We note, without formal claim, a suggestive interpretive parallel. One can imagine populations
of interacting agents under selection pressure routing computational influence away from
unreliable components with no explicit reliability score, trust model, or verifier role — a de
facto admissibility gradient implicit in the collective’s dynamics. Whether any real system
exhibits this is outside the scope of, and unestablished by, this paper.

### 10.9 Final open question

The broad open question is not whether agents will need verification, but whether the action
record itself can become as neutral and composable as the other infrastructure layers around it.
ReceiptOS offers one answer: a receipt substrate that asks not for trust in the producer, but only
for the continued ability to re-derive record correctness after the producer is gone.

### 10.10 Bounded TEE and dependency-resolution caveat

The new TEE material adds bounded executable evidence classes; it does not prove universal
TEE correctness, live Intel freshness, revocation completeness, author-circle independence,
security of every 0G deployment, or equivalence of relay and enclave evidence classes [15][16].
The enclave suite verifies the quote chain to the pinned Intel root, but live Intel PCS freshness
and revocation were not implemented, so complete current-platform attestation verification is
not claimed [15][16].

A second caveat is operational rather than semantic: the suite artifacts and vector bytes are
immutable, but the successful rerun environment was not lockfile-frozen. The upstream commit
contained `package.json` with `ethers: ^6.13.0` and no lockfile; successful execution used
`bun install` and resolved `ethers@6.17.0` under Bun `1.3.14` [15]. This is a reproducibility
caveat, not a conformance failure. Reproduction by parties fully outside the current
collaboration also remains open.

## Acknowledgments and disclosure

The WYRIWE ↔ ReceiptOS composed conformance vector reported in Section 5.4 is joint work
with TMerlini, whose recompute-kit carries the canonical conformance row. The external from-
spec verification gate is the work of a collaborator who rebuilt the derivation from the
specification alone; that author works within the broader collaboration, and the paper’s
independence claim is stated accordingly (Section 5.4). The author is a contributor to the
receipt layer of Stealth (CYPHES), the design-partner runtime disclosed in Section 5.5; the
neutrality claims of this paper should be read with that affiliation in view, and are stated
structurally for exactly that reason. The author thanks Alex Bogdan for a detailed critical review
across two rounds, which materially reshaped Sections 2, 3, 6, and 7; remaining errors are the
author’s alone.

The TEE relay and enclave suites discussed in Sections 8–10 are same-collaboration-thread
external evidence, not independent external reproduction. The relay and enclave artifacts were
reverified against immutable upstream bytes, but the paper does not claim a fourth
implementation, blind reproduction, or closure of an independence gap [15][16].

## References

[1] Pavlo Tvardovskyi. *ReceiptOS Specification and Crystal Receipt Reference Implementation*.
GitHub repository, 2026. `https://github.com/pipavlo82/crystal-receipt`. Accessed 2026-07-06.

[2] Pavlo Tvardovskyi. *Chronicle: Portable Historical Continuity for Verifiable Work Records*.
GitHub repository, 2026. `https://github.com/pipavlo82/Chronicle`. Accessed 2026-07-06.

[3] Adrian de Valois-Franklin and Alex Bogdan. *RAILS: Verification-Native Clearing for Agentic
Commerce*. arXiv preprint `arXiv:2606.08790`, 2026. `https://arxiv.org/abs/2606.08790`.

[4] Pavlo Tvardovskyi. *ML-DSA-65 Ethereum Verification*. GitHub repository, 2026.
`https://github.com/pipavlo82/ml-dsa-65-ethereum-verification`. Accessed 2026-07-06.

[5] Pavlo Tvardovskyi. *Gas-per-Secure-Bit*. GitHub repository, 2026.
`https://github.com/pipavlo82/gas-per-secure-bit`. Accessed 2026-07-06.

[6] TMerlini and Pavlo Tvardovskyi. *ReceiptOS × WYRIWE — composed recompute vector
(Step 3 × Step 5), reproducible via recompute-kit*. GitHub Gist, 2026.
`https://gist.github.com/TMerlini/24fada454cfbd89a85912452e02e2be8`. Accessed 2026-07-06.

[7] babyblueviper1. *ReceiptOS pre-post gate: spec-only recompute of the composed vector and
negative-fixture conformance run*. GitHub Gists, 2026.
`https://gist.github.com/babyblueviper1/9efc382d3156d1d3358845d9c0c6bc1b`;
`https://gist.github.com/babyblueviper1/e3dc422c7ce3d23af9ec610af37f56d4`. Accessed
2026-07-07.

[8] TMerlini, Pavlo Tvardovskyi, and babyblueviper1. *Eligibility ↔ Verification Verdict —
Correspondence Note*. GitHub Gist, three-way locked 2026-07-08.
`https://gist.github.com/TMerlini/0f5f426e400197a670874f17c4451c99`.

[9] Santiago Torres-Arias, Hammad Afzali, Trishank Karthik Kuppusamy, Reza Curtmola, and
Justin Cappos. *in-toto: Providing farm-to-table guarantees for bits and bytes*. In *28th USENIX
Security Symposium*, 2019.

[10] The SLSA community. *Supply-chain Levels for Software Artifacts (SLSA)*. Specification.
`https://slsa.dev`. Accessed 2026-07-06.

[11] Coalition for Content Provenance and Authenticity. *C2PA Technical Specification*.
`https://c2pa.org/specifications/`. Accessed 2026-07-06.

[12] Ben Laurie, Adam Langley, and Emilia Kasper. *Certificate Transparency*. RFC 6962,
IETF, 2013.

[13] Anders Rundgren, Bret Jordan, and Samuel Erdtman. *JSON Canonicalization Scheme
(JCS)*. RFC 8785, IETF, 2020.

[14] The Sigstore community. *Rekor: Software Supply Chain Transparency Log*.
`https://docs.sigstore.dev/logging/overview/`. Accessed 2026-07-06.

[15] trustless-ai. *recompute-kit PR #2: TEE inference conformance suites*. GitHub pull request
commit `73d6a1307a3671cd6fa713b5911936d333a4a498`, 2026.
`https://github.com/trustless-ai/recompute-kit/pull/2/commits/73d6a1307a3671cd6fa713b5911936d333a4a498`.

[16] TMerlini. *TEE inference package artifacts and verification scripts*. GitHub Gist revision
`060f2f995169b99abae2fdc43d31c7a3e1e9157b`, 2026.
`https://gist.github.com/TMerlini/19d532bcb627d3ea237c72003d550337/060f2f995169b99abae2fdc43d31c7a3e1e9157b`.

## Appendix A — Conformance vectors

- canonicalization vector
- anchor-stripping vector
- one-leaf Merkle vector
- multi-leaf Merkle vector (planned / future)
- input-commitment seam vector (planned / draft-scoped until re-verified)
- tamper negative vector
- missing-field negative vector
- bounded TEE relay evidence-class suite: `tee-inference-v0` (10 total; 3 verified / 4 rejected /
  3 unverifiable; 10/10 reproduced) [15]
- bounded TEE enclave evidence-class suite: `tee-inference-enclave-v0` (11 total; 7 verified /
  4 rejected; 11/11 reproduced) [15][16]

## Appendix B — Example fixtures

- local Merkle fixture
- tampered fixture
- CLI replay examples
- browser verifier samples

## Appendix C — Benchmark artifacts

- raw gas benchmark rows
- optimization path rows
- normalization notes
- protocol-readiness comparison rows
