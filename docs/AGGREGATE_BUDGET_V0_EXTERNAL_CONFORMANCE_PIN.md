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

- does not copy upstream bytes into ReceiptOS authority;
- does not promote a moving branch such as `main` into authority;
- claim independent external reproduction;
- claim non-bypassability;
- claim global conservation beyond the pinned root and period;
- claim authorization, settlement, or storage-slot equivalence.

The upstream artifact is **same-collaboration-thread external evidence**, not
independent external reproduction.

## Immutable upstream reference

- upstream repository: `trustless-ai/recompute-kit`
- immutable commit: `b672bbfa2f888237c6c4e7623510d4f02f48ad39`
- upstream profile directory: `conformance/aggregate-budget-v0`

All upstream paths in this pin are interpreted only at that immutable commit.
Any later `main` state is non-authoritative for this ReceiptOS pin.

## Pinned upstream files and exact identities

| Upstream path at pinned commit | Git blob | Bytes | SHA-256 |
|---|---:|---:|---|
| `conformance/aggregate-budget-v0/suite.json` | `765859dfdecbc410269c1573ff119f85e2516967` | 403 | `c3fa2881b6892bfab1c1cf3f6a1c9f051e660b6d69a41581083a09d765a7f979` |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md` | `6b106cab935e4b6032d584365ae3a5683927ad07` | 4050 | `55d6fb1721ba2885e78722012b6e291d94072551e5fe5534859ebbb45dfc2f18` |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json` | `380619d0661868b6bd95c4844dd46277fa171ea3` | 7165 | `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85` |
| `conformance/aggregate-budget-v0/gate.ts` | `c60f9815c51de6bd9f560962dea4b7895ad09d93` | 3305 | `c448464ef3b3e3fffebdcec676a3c7d6e2f576df70fe0522d0ac976222935126` |
| `bin/conformance-suite` | `1dc59ba36481cf46691dc762a3835e576f99aaf8` | 6534 | `2215081e780cb250cbfd1eb19aff2dc845e41b9df6ee503400f9f5d9832c5ebe` |

## suite.json identity and declared links

Pinned suite path: `conformance/aggregate-budget-v0/suite.json`

Pinned `suite.json` identity:

- Git blob: `765859dfdecbc410269c1573ff119f85e2516967`
- SHA-256: `c3fa2881b6892bfab1c1cf3f6a1c9f051e660b6d69a41581083a09d765a7f979`

Pinned suite declarations:

- vectors path: `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json`
- declared vectors SHA-256: `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`
- spec path: `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md`
- declared spec SHA-256: `55d6fb1721ba2885e78722012b6e291d94072551e5fe5534859ebbb45dfc2f18`
- adapter command in suite: `bun gate.ts --grade`

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

This pin therefore accepts the upstream profile only as a bounded event-log
conformance artifact for the pinned root/period predicate above.

## Recorded acceptance results

The following results were recomputed against the immutable commit and the
exact pinned bytes listed above:

- honest suite result: **7/7 reproduced**, exit **0**;
- tampered per-edge method result: **2/7 reproduced**, **5/7 failed**, exit
  **1**;
- independent clean recomputation result: **all 7 vectors matched**.

The required vectors SHA-256 was independently recomputed and confirmed:

- `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

The fan-out counterexample was independently confirmed:

- `900 + 800 + 700 = 2400 > 2000`
- the incorrect per-edge method uses the largest per-edge subtotal as the
  aggregate and therefore falsely passes with `900 <= 2000`

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
- commit: `b672bbfa2f888237c6c4e7623510d4f02f48ad39`
- profile directory: `conformance/aggregate-budget-v0`
- vectors SHA-256:
  `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

No broader authority is adopted.
