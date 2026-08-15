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
`fixtures.ts` / `ladder.ts` are that logic; `fixtures.ts` is the closest
analog to a frozen vector file here, and its mutant/repair declarations are
the closest analog to a `wrongly_collapses_vector_ids` entry.

## The generic scenario

All fixtures are synthetic. No Chronicle, ReceiptOS, IPFS, ENS, SCITT, or
registry semantics appear anywhere in this lane -- see
`fixtures.ts`'s top-of-file comment for the exact three-invariant scenario
used by every case.

## Rung semantics

1. **DECLARED** -- an invariant has a stable `invariant_id`. Proves nothing
   about discrimination by itself.
2. **DISCRIMINATING** -- at least one targeted mutant exists for which the
   invariant's predicate actually flips the evaluation outcome, and that
   mutant's case is validated (effective mutation, exact attribution match).
   A declared invariant with no such validated mutant reports
   `UNPROVEN_DISCRIMINATION` -- **never** silently folded into "covered".
   This lane deliberately declares a third invariant, `I_C`, that no mutant
   targets, specifically so the test suite can assert `I_C` is reported
   `UNPROVEN_DISCRIMINATION` by the harness itself -- concrete, executed
   evidence that `DECLARED != DISCRIMINATING`, not just a comment claiming it.
3. **ATTRIBUTION_CONSISTENT** -- for a validated mutant, the observed
   attribution set must equal the declared set `A_i` **exactly**. Not
   subset, not "something failed somewhere". Tested in both failure
   directions (missing declared attribution, unexpected extra attribution)
   plus corrupted/swapped attribution identities, via dedicated negative
   controls the harness must reject (Cases 3-6).
4. **CAUSALLY_SUPPORTED** -- for a mutant violating multiple invariants, a
   targeted repair restoring exactly one of them must make that invariant's
   attribution disappear while the other's remains. Tested in both
   directions on the same two-invariant mutant (Cases 7-8), plus a
   negative control where a "repair" changes something but does not
   causally restore its claimed target (Case 9) -- this specifically tests
   causality, not label agreement.
5. **INDEPENDENTLY_GROUNDED** -- see Oracle Boundary below. Always
   `UNPROVEN` in this lane.

## Mutation / repair effectiveness

Every mutant and every repair records a canonical structural digest of its
input and output. If a mutation's output digest equals its input digest, the
case is a `NO_OP_MUTANT` and is rejected before its gate output is ever
treated as evidence -- regardless of what it declares (Case 10). The same
check applies to repairs.

## Precommitment vs. independent grounding -- kept explicit and separate

`model.ts`'s `derivePrecommitment` freezes stable digests for the invariant
definition set (including each predicate's own source text), the baseline
case, the mutant descriptor (including its mutate function's source text),
and the declared expected attribution set `A_i`. `fixtures.ts` computes these
**eagerly, at fixture-declaration time** -- i.e. before any test in this lane
ever runs the gate -- and the test file re-derives them independently and
checks they match the frozen values.

**This proves precommitment only: that `A_i` was fixed before the observed
gate output was compared against it.** It does not, and cannot, prove `A_i`
is the objectively correct oracle. Precommitment answers "was this rewritten
after the fact?" -- not "was this right in the first place?". Those are
different claims and this lane does not conflate them.

## Oracle Boundary (read before trusting any PROVEN status above)

Exact set equality proves consistency between a declared oracle and observed
attribution. Counterfactual repair adds causal evidence on top of that.
**Neither, together or separately, proves that the expected attribution
oracle `A_i` was independently correct.**

In this lane, the invariant definitions, the mutant descriptors, the repair
descriptors, and every expected attribution set `A_i` were authored by the
same party that wrote the harness checking them. That is why
`independent_grounding` reports `UNPROVEN` here, unconditionally --
`INDEPENDENT_GROUNDING_NOT_PROVEN`, per `ladder.ts`'s
`INDEPENDENT_GROUNDING_REASON`. This lane does **not** fabricate independence
by introducing a second in-session persona or agent and calling that
grounding -- that would not be independence, and this lane is explicit that
it does not claim it.

A later, genuinely independent grounding lane would need to derive `A_i`
independently of: the mutant author, the gate output, and the gate
implementation under test. Potential future authorities include an
independent human reviewer, a separately authored predicate implementation,
or an independently frozen conformance artifact -- none of which is
implemented or simulated here.

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
  evaluation, exact set-equality, mutation/repair effectiveness bookkeeping,
  precommitment derivation.
- `ladder.ts` -- rung mechanics: `runMutantCase`, `runRepairCase`,
  `discriminationStatusPerInvariant`, the `INDEPENDENT_GROUNDING_STATUS`
  constant and its reason string.
- `fixtures.ts` -- the synthetic invariants (`I_A`, `I_B`, `I_C`), the
  baseline case, every positive and negative-control mutant, both
  counterfactual repairs and the wrong-repair control, and the eagerly
  frozen precommitment records for `M1`/`M2`.
- `tests/receiptos/tsei-invariant-discrimination-attribution-v0.test.ts` --
  the executable proof: Cases 1-10, the self-application/control-sensitivity
  suite (every negative control is actually executed and its rejection
  asserted, not merely declared to exist), and the assembled `LadderReport`.
