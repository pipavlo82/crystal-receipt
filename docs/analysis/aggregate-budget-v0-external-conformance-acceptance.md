# aggregate-budget-v0 external conformance acceptance

> **Non-normative audit basis**
>
> This analysis records a bounded external audit used to justify a separate
> ReceiptOS external/conformance pin. It does not itself define ReceiptOS
> canon, does not override any normative ReceiptOS specification, and does not
> promote upstream bytes into ReceiptOS authority.

Verdict: **ACCEPTED FOR RECEIPTOS EXTERNAL/CONFORMANCE PINNING**

Date: 2026-07-29
Audited repository: `trustless-ai/recompute-kit`
Pinned branch target: public `main`
Immutable audited commit: `b672bbfa2f888237c6c4e7623510d4f02f48ad39`
Target suite directory: `conformance/aggregate-budget-v0`

## Scope and method

I worked read-only against the public repository, immediately resolved `origin/main` to the immutable commit above, and audited the suite from **exact Git blob bytes**, not from a potentially line-ending-normalized Windows worktree.

This distinction mattered: a normal checkout on this host produced a vectors hash mismatch before execution because the checked-out bytes were not identical to the committed blob bytes. All acceptance conclusions below are therefore based on a blob-extracted raw tree recreated from `git show <commit>:<path>`.

## Exact pinned files, Git blobs, byte counts, and SHA-256

| Path | Git blob | Bytes | SHA-256 |
|---|---:|---:|---|
| `conformance/aggregate-budget-v0/suite.json` | `765859dfdecbc410269c1573ff119f85e2516967` | 403 | `c3fa2881b6892bfab1c1cf3f6a1c9f051e660b6d69a41581083a09d765a7f979` |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md` | `6b106cab935e4b6032d584365ae3a5683927ad07` | 4050 | `55d6fb1721ba2885e78722012b6e291d94072551e5fe5534859ebbb45dfc2f18` |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json` | `380619d0661868b6bd95c4844dd46277fa171ea3` | 7165 | `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85` |
| `conformance/aggregate-budget-v0/gate.ts` | `c60f9815c51de6bd9f560962dea4b7895ad09d93` | 3305 | `c448464ef3b3e3fffebdcec676a3c7d6e2f576df70fe0522d0ac976222935126` |
| `bin/conformance-suite` | `1dc59ba36481cf46691dc762a3835e576f99aaf8` | 6534 | `2215081e780cb250cbfd1eb19aff2dc845e41b9df6ee503400f9f5d9832c5ebe` |

## Required confirmations

### 1) Recomputed spec and vectors SHA-256

- `aggregate-budget-v0.spec.md` SHA-256: `55d6fb1721ba2885e78722012b6e291d94072551e5fe5534859ebbb45dfc2f18`
- `aggregate-budget-v0.vectors.json` SHA-256: `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

### 2) Confirm vectors hash

Confirmed exactly:

`ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

### 3) Confirm vector count

Confirmed: there are exactly **7** vectors.

## Honest suite run

### Command

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade'
```

### Environment actually used

- `bun --version` → `1.3.14`
- `python --version` → `Python 3.12.10`
- `PYTHONIOENCODING=utf-8` set for execution to preserve the suite script's Unicode status output on this Windows host
- Working tree for execution: blob-extracted raw copy reconstructed from commit `b672bbfa2f888237c6c4e7623510d4f02f48ad39`

### Output

```text
suite: aggregate_budget.v0
✓ vectors  sha256 ac6f6efd485e887a… — matches declared
✓ spec     sha256 55d6fb1721ba2885… — matches declared
────────────────────────────────────────────────────────────
✓ single-edge-within-cap                               -> {"admittedSum":"1200","conserves
✓ multi-edge-attributed-within-cap                     -> {"admittedSum":"1400","conserves
✓ fanout-exceeds-root-cap                              -> {"admittedSum":"2400","conserves
✓ exact-cap-boundary                                   -> {"admittedSum":"2000","conserves
✓ unadmitted-draws-excluded                            -> {"admittedSum":"1500","conserves
✓ period-index-isolation                               -> {"admittedSum":"1800","conserves
✓ cross-root-isolation                                 -> {"admittedSum":"1900","conserves
────────────────────────────────────────────────────────────
7/7 reproduced
✓ CONFORMANT — every vector reproduced
```

### Exit code

- Honest suite exit code: **0**

### Result

Confirmed actual honest-suite result: **7/7 reproduced**.

## Documented `--tamper` per-edge run

### Command

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade --tamper'
```

### Output

```text
suite: aggregate_budget.v0
✓ vectors  sha256 ac6f6efd485e887a… — matches declared
✓ spec     sha256 55d6fb1721ba2885… — matches declared
────────────────────────────────────────────────────────────
✓ single-edge-within-cap                               -> {"admittedSum":"1200","conserves
✗ multi-edge-attributed-within-cap                     -> {"admittedSum":"600","conserves"
    expected {"admittedSum":"1400","conserves":true}
    got      {"admittedSum":"600","conserves":true}
✗ fanout-exceeds-root-cap                              -> {"admittedSum":"900","conserves"
    expected {"admittedSum":"2400","conserves":false}
    got      {"admittedSum":"900","conserves":true}
✗ exact-cap-boundary                                   -> {"admittedSum":"1000","conserves
    expected {"admittedSum":"2000","conserves":true}
    got      {"admittedSum":"1000","conserves":true}
✓ unadmitted-draws-excluded                            -> {"admittedSum":"1500","conserves
✗ period-index-isolation                               -> {"admittedSum":"1000","conserves
    expected {"admittedSum":"1800","conserves":true}
    got      {"admittedSum":"1000","conserves":true}
✗ cross-root-isolation                                 -> {"admittedSum":"1000","conserves
    expected {"admittedSum":"1900","conserves":true}
    got      {"admittedSum":"1000","conserves":true}
────────────────────────────────────────────────────────────
2/7 reproduced
✗ 5/7 vector(s) FAILED — not conformant
```

### Exit code

- Tampered suite exit code: **1**

### Result

The actual `--tamper` run does **not** produce `5/7 reproduced`; it produces:

- **2/7 reproduced**
- **5/7 vector(s) FAILED**

So the expectation should be interpreted as **5 failures out of 7**, not **5 reproduced out of 7**.

## Independent clean Python recomputation

I independently recomputed every vector with a separate small Python checker that implements only this rule:

```text
sum admitted amounts for the pinned (rootId, periodIndex), then compare the root sum with cap
```

### Independent per-vector results

| Vector | Independent admittedSum | Independent conserves | Expected | Match |
|---|---:|---:|---|---:|
| `single-edge-within-cap` | `1200` | `true` | `{"admittedSum":"1200","conserves":true}` | yes |
| `multi-edge-attributed-within-cap` | `1400` | `true` | `{"admittedSum":"1400","conserves":true}` | yes |
| `fanout-exceeds-root-cap` | `2400` | `false` | `{"admittedSum":"2400","conserves":false}` | yes |
| `exact-cap-boundary` | `2000` | `true` | `{"admittedSum":"2000","conserves":true}` | yes |
| `unadmitted-draws-excluded` | `1500` | `true` | `{"admittedSum":"1500","conserves":true}` | yes |
| `period-index-isolation` | `1800` | `true` | `{"admittedSum":"1800","conserves":true}` | yes |
| `cross-root-isolation` | `1900` | `true` | `{"admittedSum":"1900","conserves":true}` | yes |

Independent result: **all 7/7 expected outputs match**.

## Fan-out counterexample verification

Confirmed exactly:

- `fanout-exceeds-root-cap` uses admitted draws `900 + 800 + 700 = 2400 > 2000`
- The incorrect per-edge method in `gate.ts --tamper` computes the **maximum per-edge subtotal** as the aggregate
- In this vector that wrong method yields `max(900, 800, 700) = 900`, therefore `900 <= 2000`, which falsely passes

This is the load-bearing counterexample proving that root-keyed aggregation is being pinned, not merely a set of output numbers.

## Bounded-claim confirmation

Confirmed from the pinned spec and vectors:

1. **Metered admitted draws only** are covered for the pinned `(rootId, periodIndex)`.
2. **Non-bypassability is not proved** by this recompute. The spec expressly bounds the claim to draws routed through the meter and states that proving all consuming paths emit an admitted `Drawn` is a substrate obligation, not something this profile recomputes.

This bounded claim is stated clearly and honestly in the pinned spec.

## Commands run

### Resolve immutable commit from public main

```bash
git clone --quiet --no-checkout https://github.com/trustless-ai/recompute-kit.git recompute-kit
git fetch --quiet origin main
git rev-parse origin/main
# => b672bbfa2f888237c6c4e7623510d4f02f48ad39
git checkout --quiet b672bbfa2f888237c6c4e7623510d4f02f48ad39
```

### Identify audited Git objects

```bash
git ls-tree -r b672bbfa2f888237c6c4e7623510d4f02f48ad39 -- conformance/aggregate-budget-v0 bin/conformance-suite
```

Observed:

```text
100755 blob 1dc59ba36481cf46691dc762a3835e576f99aaf8	bin/conformance-suite
100644 blob 6b106cab935e4b6032d584365ae3a5683927ad07	conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md
100644 blob 380619d0661868b6bd95c4844dd46277fa171ea3	conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json
100644 blob c60f9815c51de6bd9f560962dea4b7895ad09d93	conformance/aggregate-budget-v0/gate.ts
100644 blob 765859dfdecbc410269c1573ff119f85e2516967	conformance/aggregate-budget-v0/suite.json
```

### Recreate raw audited files from exact blob bytes

```bash
git show b672bbfa2f888237c6c4e7623510d4f02f48ad39:bin/conformance-suite
git show b672bbfa2f888237c6c4e7623510d4f02f48ad39:conformance/aggregate-budget-v0/suite.json
git show b672bbfa2f888237c6c4e7623510d4f02f48ad39:conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md
git show b672bbfa2f888237c6c4e7623510d4f02f48ad39:conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json
git show b672bbfa2f888237c6c4e7623510d4f02f48ad39:conformance/aggregate-budget-v0/gate.ts
```

### Run conformance suite on exact blob bytes

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade'
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade --tamper'
```

## Acceptance conclusion

The pinned suite is internally consistent and externally reproducible from immutable Git blob bytes at commit `b672bbfa2f888237c6c4e7623510d4f02f48ad39`.

- Spec hash matches declaration
- Vectors hash matches declaration
- Vector count is exactly 7
- Honest implementation reproduces **7/7** with exit code **0**
- Documented wrong `--tamper` method fails as intended: **5/7 failed**, **2/7 reproduced**, exit code **1**
- Independent clean Python recomputation confirms all 7 expected results
- The fan-out counterexample is valid and load-bearing
- The bounded claim is explicit and appropriately limited: only metered admitted draws for the pinned root and period are covered; non-bypassability is not proved

## Final verdict

**ACCEPTED FOR RECEIPTOS EXTERNAL/CONFORMANCE PINNING**
