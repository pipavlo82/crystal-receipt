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
plus one focused test file under `tests/receiptos/**`.

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
  classifier. Production `VALID_PROVENANCE` is unreachable: no provider-
  specific verifier or trust root is declared.
- `independent-authority-synthetic.ts` -- **test-only** injection for the
  `VALID_PROVENANCE` branch. Not a production provider. Outcomes are not
  production-publishable.
- `tests/receiptos/tsei-invariant-discrimination-independent-authority-v0.test.ts`
  -- scaffold negatives, waiting state, closed-universe measurement, and
  synthetic PROVEN/DISAGREED branches.

## Independent authority scaffold (v0)

This is conformance methodology, not TSEI runtime. The published #200
instance remains `independent_grounding = UNPROVEN`
(`INDEPENDENT_GROUNDING_NOT_PROVEN`).

Authority-visible Object A may contain only: schema, instance_id,
invariant_id, implementation-independent normative invariant definition,
implementation-independent normative definition identity, mutant_id,
concrete baseline/mutated values, and an implementation-independent
evaluation instruction. A must not contain executable predicates,
predicate source, evaluators, evaluator output, `expected_attribution`,
or any implementation-derived `A_i`. An oracle produced by executing
harness-supplied evaluator code is `TRANSPORT_ONLY`.

Generic provenance-envelope fields never grant `VALID_PROVENANCE`.
Production validity requires a later, explicitly declared external
provider verifier against a declared trust root. Until then, production
operation is `ABSENT` (reason `AWAITING_INDEPENDENT_AUTHORITY`) or
`INVALID_PROVENANCE` (reason `UNPROVEN_INDEPENDENCE`). Non-arrival is
not disagreement.
