# Transformation Stability v0

Frozen profile: `transformation-stability-v0`

## Normative purpose

This package freezes the first conformance surface over the Transformation
Stability v0 implementation merged in PR #185 (merge commit
`8e31310a8686ee78c32103d0fb40047770de4c7d`, implementation commit
`824033ea7aa91d6d99e5758e5e10c1b9004cdbfe`).

It does not change implementation semantics. It recomputes and pins the
already-merged behavior so that drift is independently detectable.

Core claim: `normative_preservation`.

Transformation Stability separates four projections over a recomputed
observation:

- `N` — normative projection; mismatch is always `violation`.
- `S` — stability projection; mismatch is `history_sensitive` unless an
  authenticated profile explicitly escalates it to `violation`.
- `A` — allowed variant projection; variation is telemetry only and never
  changes the principal class.
- `F` — forbidden variant projection; mismatch is always `violation`, even
  when `N` matches.

Principal result classes: `stable`, `history_sensitive`, `unresolved`,
`out_of_domain`, `violation`.

- Failed applicability is `out_of_domain`, never a validity judgment.
- Transformation or recompute failure is bounded as `unresolved`.
- `N` or `F` mismatch is unavoidably `violation`.

## Package scope

Two frozen surfaces, both recomputed directly against the merged PR #185
evaluators via read-only imports from `src/receiptos/challenge/`:

1. **Handoff matrix** — the exact six-vector adversarial matrix already
   merged in `transformation-stability-handoff-matrix.ts`, evaluated against
   the committed `session-evidence.sample.json` fixture.
2. **Closed cycle** — four cycle vectors evaluated against the generic
   closed-cycle evaluator in `transformation-stability-cycle.ts`, using the
   package-local synthetic node domain already demonstrated in
   `tests/receiptos/transformation-stability-cycle-v0.test.ts`.

A Handoff-realistic closed-cycle profile is explicitly out of scope for v0
and is forbidden semantics for this package (see `contract.json`).

## Handoff matrix

Vector order is normative:

| vector_id | expected classification |
|---|---|
| `H-ROUNDTRIP-STABLE` | `stable` |
| `H-KEY-ORDER-REVERSE` | `stable` |
| `H-NORMATIVE-SESSION-ID-MUTATION` | `violation` |
| `H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION` | `violation` |
| `H-SOURCE-SCHEMA-MISMATCH` | `out_of_domain` |
| `H-TARGET-RECOMPUTE-UNRESOLVED` | `unresolved` |

Expected aggregate: `stable=2, history_sensitive=0, unresolved=1,
out_of_domain=1, violation=2`.

Pinned fixture: `src/receiptos/fixtures/session-evidence.sample.json`,
Git blob SHA-1 `a5dbda7662aa95a92a3befa3df28a666319e6740`.

Pinned roots:

- sample: `0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`
- normative session-id mutation:
  `0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e`
- anchor-only mutation:
  `0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`

The anchor-only mutation root equals the sample root by construction:
`anchor` is excluded from the receipt-root preimage, so an anchor-only
mutation cannot move `N`. It does move `F` (the forbidden projection
literally is `{ anchor }`), which is why this vector is still `violation`.
This is normative evidence that root equality alone does not protect every
transformation boundary.

## Closed cycle

Cycle vector order and cycle edge order are both normative.

| cycle_id | edges (ordered) | expected classification |
|---|---|---|
| `stable_closed_cycle` | `to-pid-b`, `to-pid-a` | `stable` |
| `intermediate_violation_restored_endpoint` | `flip`, `restore` | `violation` (fails at `flip`) |
| `failed_applicability_out_of_domain` | `domain` | `out_of_domain` |
| `recompute_unresolved_worker_timeout` | `trigger_unresolved` | `unresolved` |

`intermediate_violation_restored_endpoint` is the frozen instance of the
core cycle invariant: endpoint closure cannot erase an intermediate
violation. Its second edge (`restore`) would bring the normative projection
back into agreement with the source, but the cycle terminates at the first
violating edge (`flip`) and never reaches the endpoint comparison.

`recompute_unresolved_worker_timeout` exercises the `unresolved` recompute
path (`reason: "worker_timeout"`) that the merged cycle evaluator already
supports but that had no standalone frozen cycle vector before this
package.

The synthetic node domain (`value`, `observation`, `telemetry`,
`forbidden`, `inDomain`, `unresolved`) and its projections
(`N = { verdict }`, `S = { observation }`, `A = { telemetry }`,
`F = { forbidden }`) are identical to the profile already merged in
`tests/receiptos/transformation-stability-cycle-v0.test.ts`. This package
does not invent new cycle semantics; it freezes the existing ones.

## Independence

- `generate_package.ts` imports the merged evaluators read-only and
  materializes `vectors/handoff-matrix-set.json`, `cycles/cycle-set.json`,
  and `manifest.json`. It changes no `src/**` file.
- `audit_package.ts` and `verify_independent.py` import no production code.
  Both recompute package digests independently; `verify_independent.py`
  additionally re-derives the Handoff roots from the fixture's committed
  Git blob bytes (not working-tree-normalized bytes) and independently
  re-executes the closed-cycle state machine from the frozen `input`
  specification in `cycles/cycle-set.json`.

## Forbidden semantics

See `contract.json` → `forbidden_semantics`. In particular this package
must never generalize Lane K's `observational_stability_evidence` claim
into a `violation` class, must never treat observation/telemetry variance
as a validity judgment, and must never let endpoint equality suppress a
recorded intermediate violation.
