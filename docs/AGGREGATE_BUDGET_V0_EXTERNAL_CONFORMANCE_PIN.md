# Aggregate Budget v0 external conformance pin

This document is the canonical ReceiptOS external/conformance pin for the
accepted upstream `aggregate-budget-v0` profile.

## Scope and authority

This pin references an **external** upstream artifact and records ReceiptOS's
**bounded interpretation** of that artifact.

ReceiptOS canon here consists only of:

1. the immutable external reference set pinned below; and
2. the bounded interpretation stated in this document.

This pin does **not**:

- copy upstream bytes into ReceiptOS authority;
- promote a moving branch such as `main` into authority;
- claim independent external reproduction;
- claim non-bypassability;
- claim global conservation beyond the pinned root and period;
- claim authorization, settlement, or storage-slot equivalence.

The upstream artifact is **same-collaboration-thread external evidence**, not
independent external reproduction.

## Immutable upstream reference

Current authoritative upstream pin:

- upstream repository: `trustless-ai/recompute-kit`
- immutable commit: `dfc0351834f744268a089cfbf90117841d604d11`
- upstream profile directory: `conformance/aggregate-budget-v0`
- classification: **POINTER-ONLY SEMANTIC MAINTENANCE**

The new commit is the direct child of the previous pin and its complete upstream
delta contains only:

- `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md`
- `conformance/aggregate-budget-v0/suite.json`

No gate, runner, vector, schema, fixture, PQ, TEE, v0.7, RSF, or PDF material
is part of this pin update.

Historical previous pin:

- previous immutable commit: `b672bbfa2f888237c6c4e7623510d4f02f48ad39`
- previous suite SHA-256: `c3fa2881b6892bfab1c1cf3f6a1c9f051e660b6d69a41581083a09d765a7f979`
- previous spec SHA-256: `55d6fb1721ba2885e78722012b6e291d94072551e5fe5534859ebbb45dfc2f18`

The old pin was valid, but it became semantically stale after the upstream
specification was strengthened. The conformance claim does not move, the vector
oracle does not move, the executable gate does not move, and the conformance
runner does not move. Only the immutable pointer and spec identity move, and
the strengthened specification now states constructive unreachability
explicitly.

## Pinned upstream files and exact identities

| Upstream path at pinned commit | Bytes | SHA-256 | Classification |
|---|---:|---|---|
| `conformance/aggregate-budget-v0/suite.json` | 433 | `b451e4b00c9355af513d0c8ed0534673338da885c8eba3f763728367da969c0d` | CHANGED |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md` | 5093 | `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c` | CHANGED |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json` | 7165 | `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85` | UNCHANGED |
| `conformance/aggregate-budget-v0/gate.ts` | 3305 | `c448464ef3b3e3fffebdcec676a3c7d6e2f576df70fe0522d0ac976222935126` | UNCHANGED |
| `bin/conformance-suite` | 6534 | `2215081e780cb250cbfd1eb19aff2dc845e41b9df6ee503400f9f5d9832c5ebe` | UNCHANGED |

All upstream paths in this pin are interpreted only at immutable commit
`dfc0351834f744268a089cfbf90117841d604d11`. Any later `main` state is
non-authoritative for this ReceiptOS pin.

## suite.json identity and declared links

Pinned suite path: `conformance/aggregate-budget-v0/suite.json`

Pinned `suite.json` identity:

- SHA-256: `b451e4b00c9355af513d0c8ed0534673338da885c8eba3f763728367da969c0d`
- bytes: `433`

Pinned suite declarations:

- vectors path: `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json`
- declared vectors SHA-256: `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`
- spec path: `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md`
- declared spec SHA-256: `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c`
- adapter command in suite: `bun gate.ts --grade`

The suite-declared vectors SHA-256 matches the independently recomputed raw blob
identity exactly.

## Pinned predicate and bounded interpretation

Pinned predicate:

```text
admittedSum =
 sum of admitted Drawn amounts for the pinned (rootId, periodIndex)

conserves =
 admittedSum <= pinned root cap
```

ReceiptOS interpretation of that predicate is bounded as follows:

- the conserved carrier is **one root-keyed meter**;
- edge/node is **attribution only**;
- per-edge accounting treated as the aggregate is **non-conformant**;
- the load-bearing vector is `fanout-exceeds-root-cap`:
  `900 + 800 + 700 = 2400 > 2000`;
- only **metered admitted draws** are covered;
- **non-bypassability is not proved**;
- the claim is scoped only to the pinned `rootId` and `periodIndex`;
- no claim is made here about global conservation, authorization,
  settlement, or storage-slot equivalence.

The conformance counterexample remains a valid predicate-level discriminator,
while the corresponding 2400 admitted execution trace is unproducible on the
sound reference implementation. The strengthened specification makes this
constructive-unreachability boundary explicit.

On the sound reference execution boundary described by the pinned spec:

- `_draw(900)` succeeds;
- `_draw(800)` succeeds;
- `_draw(700)` reverts with `RootBoundExceeded`;
- `spentRoot` remains exactly `1700`;
- the rejected 700 draw produces no admitted event corresponding to a 2400
  cumulative trace;
- the 2400 admitted execution is unreachable by construction.

This pin therefore accepts the upstream profile only as a bounded event-log
conformance artifact for the pinned root/period predicate above.

## Recorded acceptance results

The following results were recomputed against immutable commit
`dfc0351834f744268a089cfbf90117841d604d11` from exact raw Git blob bytes:

- honest adapter result: **7/7 reproduced**, **0 failed**, verdict **PASS**;
- known wrong/tamper adapter result: **2/7 reproduced**, **5/7 failed**,
  verdict **FAIL AS EXPECTED**;
- suite checker result: **7/7 accepted/reproduced**, verdict **PASS**.

The required vectors SHA-256 was independently recomputed and confirmed:

- `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

## Constructive-unreachability evidence boundary

The strengthened specification explicitly states constructive unreachability at
immutable commit `dfc0351834f744268a089cfbf90117841d604d11`.

A short external replay reference `afab44c` appears in the upstream prose, but a
full immutable evidence commit and exact replay path were not resolved in this
pinning pass. Accordingly, any external execution replay beyond what is stated
in the pinned specification is treated as **non-pinned supporting evidence** and
not as part of the immutable ReceiptOS authority set.

## Hash-audit scope note

Pre-PR audit scope for this maintenance update:

`SCOPE: docs/ only — fixture manifests under tests/fixtures/** were not audited in this pass.`

That docs-only audit found no aggregate-track blocker and no confirmed phantom,
malformed, or undefined current-pin hashes in the aggregate-budget pin
documents.

## Normative pin vs non-normative audit basis

This document is the canonical ReceiptOS pin.

Supporting audit basis:

- `docs/analysis/aggregate-budget-v0-external-conformance-acceptance.md`

That analysis is explicitly non-normative. It supports this pin but does not
expand the pin's scope.

## ReceiptOS acceptance statement

ReceiptOS accepts the upstream `aggregate-budget-v0` profile only as an
immutable external/conformance reference anchored to:

- repository: `trustless-ai/recompute-kit`
- commit: `dfc0351834f744268a089cfbf90117841d604d11`
- profile directory: `conformance/aggregate-budget-v0`
- suite SHA-256:
  `b451e4b00c9355af513d0c8ed0534673338da885c8eba3f763728367da969c0d`
- spec SHA-256:
  `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c`
- vectors SHA-256:
  `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

No broader authority is adopted.
