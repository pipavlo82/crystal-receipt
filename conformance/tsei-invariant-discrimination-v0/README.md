# TSEI Invariant Discrimination & Attribution Conformance (v0)

A generic, executable conformance layer for a five-rung evidence ladder:

```
declared -> discriminating -> attribution-consistent -> causally-supported -> independently-grounded
```

This mechanizes the methodology motivated by (but not made normative by)
Section 16.1 of `docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md`
("Future Work: Invariant Sensitivity") -- that a *declared* invariant is not
the same thing as a *discriminating* one. This lane turns that observation
into an executable, negative-control-tested check.

**This lane changes no TSEI runtime semantics.** It does not touch the
specification, the canonical-identity comparator, the transformation-stability
modules, or any frozen comparator/coverage vector file. It introduces no new
TSEI runtime verdict and does not reinterpret `stable` / `history_sensitive` /
`unresolved` / `out_of_domain` / `violation`. It is conformance methodology
only, scoped entirely to `conformance/tsei-invariant-discrimination-v0/**`
plus focused test files under `tests/receiptos/**`.

## Why code, not a JSON vector file

The existing `conformance/*-conformance-v0/vectors.json` corpora are plain
data because their oracle (a comparator's output for a given input) is
representable as data. This lane's oracle is different in kind: it must
express *predicates*, *deterministic mutation procedures*, and *repair
procedures* as executable logic, not as static values. `model.ts` /
`fixtures.ts` / `ladder.ts` are that logic; `precommitment-manifest.json`
is the one part of this lane that *is* plain frozen data, for the reason
explained in the Precommitment section below.

## The generic scenario

All fixtures are synthetic. No Chronicle, ReceiptOS, IPFS, ENS, SCITT, or
registry semantics appear anywhere in this lane -- see
`fixtures.ts`'s top-of-file comment for the exact three-invariant scenario
used by every case.

## Rung semantics

1. **DECLARED** -- an invariant has a stable `invariant_id`. Proves nothing
   about discrimination by itself.
2. **DISCRIMINATING** -- at least one targeted mutant exists for which the
   invariant's predicate actually flips from holding to violated between the
   baseline and the mutated value (`newly_violated`), and that mutant's case
   is validated (effective mutation, exact attribution match). Discrimination
   evidence is **derived from the observed transition**, never merely from a
   mutant's declared `expected_attribution` -- see
   `MUTANT_CASE_NO_TRANSITION` in `fixtures.ts`, which declares `{I_A}` and
   is even attribution-consistent (observed == declared), yet contributes
   zero discrimination evidence because `I_A` was already violated on its
   baseline and stays violated after the mutation. A declared invariant with
   no such validated, transition-backed mutant reports
   `UNPROVEN_DISCRIMINATION` -- **never** silently folded into "covered".
   This lane deliberately declares a third invariant, `I_C`, that no mutant
   targets, specifically so the test suite can assert `I_C` is reported
   `UNPROVEN_DISCRIMINATION` by the harness itself.
3. **ATTRIBUTION_CONSISTENT** -- for a validated mutant, the observed
   attribution set must equal the declared set `A_i` **exactly**. Not
   subset, not "something failed somewhere". Tested on both the
   **oracle side** (Cases 3-6: missing/extra/corrupted/swapped *declared*
   attribution) and, separately, the **output/emission side**
   (`runMutantCaseWithCorruptedEmission`: predicates and the declared oracle
   are both left untouched, and only the identity the gate *emits* is
   corrupted or swapped). These are deliberately distinct mechanisms testing
   different failure classes -- an oracle-side control proves nothing about
   whether the gate could still lie about its own output, and vice versa.
4. **CAUSALLY_SUPPORTED** -- derived from the **observed before/after
   attribution delta** of a repair, not from the repair's own authored
   claim. A repair is causally supported only when it is effective
   (non-no-op), its declared target invariant was actually violated
   beforehand, exactly that one invariant's attribution was removed, and no
   new attribution was introduced as a side effect. Tested in both
   directions on the same two-invariant mutant (Cases 7-8: repairing `I_A`
   alone vs. `I_B` alone), plus **three** negative controls
   (`REPAIR_CASE_A/B/C` in `fixtures.ts`) each constructed so its *authored*
   `expected_attribution_after_repair` matches the real post-repair outcome
   exactly (i.e. the old authored-set check alone would have accepted all
   three) while the causal delta check correctly rejects each for a
   different reason: the declared target was never violated to begin with;
   the repair removed the target plus an unrelated invariant; the repair
   removed the target but introduced a new violation as a side effect. The
   authored-set comparison is kept as a separate, explicitly secondary
   `attribution_matches` field on `RepairCaseResult` -- useful, but never
   sufficient on its own to establish causality.
5. **INDEPENDENTLY_GROUNDED** -- see Oracle Boundary below. Always
   `UNPROVEN` in this lane.

## Mutation / repair effectiveness

Every mutant and every repair records a canonical structural digest of its
input and output. If a mutation's output digest equals its input digest, the
case is a `NO_OP_MUTANT` and is rejected before its gate output is ever
treated as evidence -- regardless of what it declares (Case 10). The same
check applies to repairs.

## Precommitment -- a genuine pushed-commit anchor, not a same-session claim

An earlier version of this lane computed "precommitment" digests eagerly at
fixture-declaration time, in the same file, in the same uncommitted session,
and called comparing them against a same-session recomputation
"precommitment". That proved only that the digest algorithm is deterministic
(`FIXTURE_IDENTITY_REPRODUCIBLE`, not precommitment) -- nothing prevented
editing both sides together before anyone looked, so it carried no real
temporal guarantee.

This version fixes that: `precommitment-manifest.json` is a **literal, frozen
data file** -- digests written as plain JSON string values, not
computed into constants at import time. The manifest and the fixture code it
digests are committed and **pushed to origin together**, and the actual
precommitment claim is anchored to that pushed commit's SHA, not to anything
computed locally. The conformance suite's `"precommitment (manifest-anchored)"`
test block independently re-derives every digest from the live fixture code
at run time and checks it byte-for-byte against the literal manifest values.
The audit report accompanying this repair records the exact pushed anchor SHA
and states that verification was performed against a **fresh checkout of that
exact commit** (a separate detached worktree, mirroring how the PR #199
post-merge audit verified merged `main`), not merely against uncommitted
local state.

**This proves precommitment in the narrow sense used throughout this lane:
that the invariant set, baseline cases, and mutant descriptor identities were
fixed before the comparison run, anchored to a commit nobody authoring this
lane can retroactively edit.** It does **not**, and cannot, prove `A_i` is
the objectively correct oracle -- see Oracle Boundary below. If a fixture
needs to change after an anchor is pushed and verified, the precommitment
sequence restarts from a newly pushed anchor; nothing is edited in place
against an already-reported anchor.

## Oracle Boundary (read before trusting any PROVEN status above)

Exact set equality proves consistency between a declared oracle and observed
attribution. Counterfactual repair adds causal evidence on top of that. A
pushed-commit precommitment anchor proves fixture identity was fixed before
comparison. **None of these, together or separately, prove that the expected
attribution oracle `A_i` was independently correct.**

In this lane, the invariant definitions, the mutant descriptors, the repair
descriptors, every expected attribution set `A_i`, **and** the precommitment
manifest anchor itself were all authored and pushed by the same party that
wrote the harness checking them. That is why `independent_grounding` reports
`UNPROVEN` here, unconditionally -- `INDEPENDENT_GROUNDING_NOT_PROVEN`, per
`ladder.ts`'s `INDEPENDENT_GROUNDING_REASON`. This lane does **not**
fabricate independence by introducing a second in-session persona or agent
and calling that grounding -- that would not be independence, and this lane
is explicit that it does not claim it.

A later, genuinely independent grounding lane would need to derive `A_i`
independently of: the mutant author, the gate output, the gate
implementation under test, **and** whoever controls the precommitment
anchor. This directory now contains an **internal scaffold** for that
comparison (`independent-authority*.ts`). The scaffold does **not**
flip this published instance to independently grounded, does **not**
declare a production provider/trust root, and does **not** make
production `VALID_PROVENANCE` reachable. See "Independent authority
scaffold (v0)" below.

## Relation to external adversarial work

This methodology was independently designed inside `crystal-receipt`. No
code was imported from, or ported out of, `trustless-ai/cross-reference-console`
PRs #85-87; their Python harness is not a dependency of, and their gates are
not the test oracle for, anything in this directory. Any citation of that
external work in commit messages is rationale only, not a code or design
source -- the point is independent convergence on the same methodology, not
transplantation.

## Files

- `model.ts` -- generic types, canonical structural digest, violation
  evaluation, exact set-equality, set difference, attribution-identity
  remapping (for output-side corruption controls), mutation/repair
  effectiveness bookkeeping, and the digest-derivation utilities the
  precommitment manifest's literal values were computed from.
- `ladder.ts` -- rung mechanics: `runMutantCase` (with baseline/mutated/
  newly_violated/no_longer_violated transition tracking),
  `discriminationEvidence`, `runMutantCaseWithCorruptedEmission` (output-side
  corruption), `runRepairCase` (with before/after delta and
  `causally_supported`), `discriminationStatusPerInvariant`, and the
  `INDEPENDENT_GROUNDING_STATUS` constant with its reason string.
- `fixtures.ts` -- the synthetic invariants (`I_A`, `I_B`, `I_C`), the
  baseline cases, every positive and negative-control mutant (including the
  predicate-flip no-transition control and the output-side emission-
  corruption remaps), both counterfactual repairs and all four repair
  negative controls (wrong-repair, never-violated, overreach, side-effect).
- `precommitment-manifest.json` -- the literal, frozen precommitment
  anchor data; see the Precommitment section above.
- `tests/receiptos/tsei-invariant-discrimination-attribution-v0.test.ts` --
  the executable proof: Cases 1-10, the predicate-flip and causal negative
  controls, the output-side corruption controls, the manifest-anchored
  precommitment check, the self-application/control-sensitivity suite (every
  negative control is actually executed and its rejection asserted, not
  merely declared to exist), and the assembled `LadderReport`.
- `independent-authority-model.ts` / `independent-authority.ts` -- Object A/B/C/D
  scaffold contracts, leak/faithfulness/universe checks, and the provenance
  classifier. Production evaluation still cannot mint VALID_PROVENANCE:
  a selected Rekor v1 verifier does not feed the production evaluator.
- `rekor-v1-verifier.ts` -- production Rekor v1 verifier. It authenticates the
  Rekor SET before trusting top-level entry fields, verifies the signed
  checkpoint and RFC 6962 inclusion, validates the leaf certificate to pinned
  Sigstore TUF Fulcio trust material, and reads the OIDC issuer only from the
  exact Fulcio extension OIDs. Offline tests inject immutable public dummy-gate
  fixtures. Caller booleans are not proofs.
- `provider-policy.rekor-v1.json` -- frozen Rekor v1 policy bytes; SHA-256
  is computed outside the file.
- `independent-authority-synthetic.ts` -- **test-only** injection and the
  named synthetic evaluator for the `VALID_PROVENANCE` branch. Not a
  production provider. Outcomes are not production-publishable. Caller-
  shaped `{ injection_kind: "synthetic_test_only" }` objects are not issued.
- `INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md` -- protocol
  hardening: observational metadata on B, claim boundary, dummy-gate
  eligibility, selected Rekor v1 / hashedrekord `0.0.1`, and the frozen
  production originator-oracle object shape (§8.2). Does not create
  Object A and does not mint PROVEN or E0.
- `object-a-e0-contract.ts` -- Object A acceptance and public E0 record
  contract. Freezes `INTERNAL_ORACLE_CODEC`; does not define production
  oracle field contents.
- `originator-oracle.ts` -- production Originator internal-oracle private
  artifact: schema `tsei-invariant-discrimination-v0.internal-oracle.v0`,
  filename `originator-oracle.private.json`, lifecycle
  `PRIVATE_PRE_E0_NOT_E0`. Mechanical serialize of HUMAN_PRIMARY answers
  only. Not Object A, not Object B, not E0, not
  `internal-oracle-reveal.json`.
- `tests/receiptos/tsei-invariant-discrimination-independent-authority-v0.test.ts`
  -- scaffold negatives, waiting state, closed-universe measurement, and
  synthetic PROVEN/DISAGREED branches.
- `tests/receiptos/tsei-object-a-e0-contract-v0.test.ts` -- Object A / E0
  scaffold contract.
- `tests/receiptos/tsei-originator-oracle-production-v0.test.ts` --
  production originator-oracle grammar, golden synthetic bytes, and
  fail-closed negatives. No real worksheet answers.
- `rekor-v1-real-run-public-evidence.ts` -- fail-closed acceptor for the
  sanitized public receipt. Rejects status escalation and public
  recomputation claims. Does not open the E0 commitment and does not
  verify unpublished E1/E2 payloads.
- `fixtures/rekor-v1-real-run-public-evidence/` -- sanitized public
  coordinates, public E0-record bytes, and frozen public Rekor entries
  for the real E0/E1/E2 run. This is a public receipt, not a complete
  public reproduction. It does **not** contain Object A, Object B,
  oracle/reveal, or nonce bytes.
- `tests/receiptos/tsei-real-run-public-evidence-v0.test.ts` -- schema
  exactness, reported-table shape, recorded order/identity/commitment
  coordinates, offline E0 Rekor verification, sanitization negatives,
  and malformed/status-escalation negatives.

## Independent authority scaffold (v0)

This is conformance methodology, not TSEI runtime. The published #200
instance remains `independent_grounding = UNPROVEN`
(`INDEPENDENT_GROUNDING_NOT_PROVEN`).

Authority-visible Object A may contain only: schema, instance_id,
invariant_id, implementation-independent normative invariant definition,
implementation-independent normative definition identity, mutant_id,
concrete baseline/mutated values, and an implementation-independent
evaluation instruction. Unexpected keys at those contract levels are
rejected by a runtime allow-list. Concrete baseline/mutated values remain
domain data (not the same metadata allow-list) but are still scanned for
forbidden implementation/answer keys. This does **not** claim to detect
arbitrary semantic steganography in natural-language normative
definitions.

A must not contain executable predicates, predicate source, evaluators,
evaluator output, `expected_attribution`, or any implementation-derived
`A_i`. An oracle produced by executing harness-supplied evaluator code is
`TRANSPORT_ONLY`.

Evaluation mechanically checks Object A faithfulness (leak check,
normative-definition identity recomputation, intended-definition equality,
invariant/case id consistency, exact intended baseline/mutated values, and
required semantic fields) **before** provenance or semantic comparison.
An unfaithful package yields `independent_grounding = UNPROVEN` with
reason `PROBLEM_PACKAGE_NOT_FAITHFUL` -- never `DISAGREED`, `PROVEN`,
`UNPROVEN_INDEPENDENCE`, or a TSEI runtime violation.

Generic provenance-envelope fields never grant `VALID_PROVENANCE`.
The production evaluator does not accept provider outcomes or caller-shaped
verified observations even after Rekor v1 is selected. Synthetic
`VALID_PROVENANCE` is reachable only
through the explicitly named test-only evaluator after
`injectSyntheticVerifiedProvenance` issues the outcome. On that valid
path, exact oracle byte binding is mandatory: a null or mismatched
`oracle_bytes_sha256` is `INVALID_PROVENANCE`.

Production `VALID_PROVENANCE` remains unreachable on
`evaluateProductionIndependentGrounding`: that evaluator still does not
ingest Rekor observations. A real E0/E1/E2 instance now has a **public
receipt** in `fixtures/rekor-v1-real-run-public-evidence/`: public Rekor
v1 coordinates and a public E0-record. Both participants privately
recomputed the historical run and reported 12/12 exact-set agreement.
That comparison is a private-artifact result; the two operands are not
in this package, so the committed bytes cannot mechanically recompute
exact-set equality.

What the public package **does** prove from committed bytes:

- exact E0-record bytes hash to the anchored E0 digest
- E0 publication/signature/selector/Rekor verification passes
- frozen E1/E2 Rekor entry documents record the stated digests, log IDs,
  UUIDs, and indexes
- the recorded global indexes are numerically E0 < E1 < E2
- private-artifact independent recomputation reported 12/12 equality
- production status remains UNPROVEN

What the public package **does not** independently verify:

- E1/E2 payload signatures (exact payload bytes are unpublished)
- E1/E2 identity-to-payload binding
- E0 commitment opening (nonce and oracle bytes are unpublished)
- exact-set equality between two public operands

Derived status from those artifacts and the production
verifier/evaluator is:

- `evaluateProductionIndependentGrounding.independent_grounding = UNPROVEN`
  (`UNPROVEN_INDEPENDENCE` / `INVALID_PROVENANCE`)
- `production_publishable = false`
- `verifyRekorV1OrderedEvents.sufficient_for_proven_grounding = false`
- `private_artifact_run_result.relation = REPORTED_EXACT_SET_AGREES`
  (`cases_equal = 12`, `cases_total = 12`,
  `publicly_recomputable_from_package = false`)
- public evidence status:
  `REKOR_V1_PUBLIC_RECEIPT_RECORDED_PRODUCTION_UNPROVEN`

This sanitized package is a public receipt, not a complete public
reproduction. Object A, Object B, oracle/reveal bytes, and nonce bytes
remain unpublished. Chat corroboration is not a cryptographic provenance
source and does not mint status. Non-arrival is not disagreement.

Object B may carry observational metadata (definition-ambiguity
observation, second-party answer-free observation, undeclared-effect
notes). Valid fields survive into the evaluation result and MUST NOT
alter exact-set comparison, mint `VALID_PROVENANCE`, or change
UNPROVEN / DISAGREED / PROVEN. Malformed observational metadata is
fail-closed `UNPROVEN` without throwing and is not copied into the
result. The claim boundary is runtime-frozen, compared against a
private canonical baseline, classified
`DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED`, and cannot mint
provenance. See `INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md`
for freeze-before-A, Object A/B/C/D obligations, P1–P10, abort
conditions, PHASE 0–12, publication package, Authority checklist,
E0/E1/E2, hiding commitment, no retroactive blindness, and
`CO_SIGNED_CHECKPOINT_TIME = NOT_YET_QUALIFIED`.
The production Originator internal-oracle private artifact is specified
in `originator-oracle.ts` and protocol §8.2. Semantic answers remain
`HUMAN_PRIMARY`; code may only validate and serialize. The pre-E0 file
`originator-oracle.private.json` is `PRIVATE_PRE_E0_NOT_E0`: it is not
E0, not Object A, not Object B, and not the post-E2
`internal-oracle-reveal.json`. A later E0 lane may hash those exact
bytes with a nonce via the existing commitment; this lane still does
not mint E0.

A real provider dry run is required before any real Object A;
`evaluateProviderDryRun` is an in-memory model and cannot set
`provider_policy_freezable = true`. Rekor v1 is selected; Rekor v2 remains
`rekor-v2-candidate-not-selected`. Dummy-gate PASS is eligibility only.
The #200 published instance remains `independent_grounding = UNPROVEN`.
For the separate real-run public-evidence package, current derived state is
`CASES_CREATED = true` (reported comparison table only; not a public
recomputation of two independently bound sets),
`ANSWERS_DISCLOSED = comparison_sets_only`,
`PROVIDER_SELECTED = true`, `PROVIDER_POLICY_FROZEN = true`,
and production evaluator `independent_grounding` remains `UNPROVEN`.
