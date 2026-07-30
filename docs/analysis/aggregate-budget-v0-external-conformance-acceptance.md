# aggregate-budget-v0 external conformance acceptance

> **Non-normative audit basis**
>
> This analysis records a bounded external audit used to justify a separate
> ReceiptOS external/conformance pin. It does not itself define ReceiptOS
> canon, does not override any normative ReceiptOS specification, and does not
> promote upstream bytes into ReceiptOS authority.

Verdict: **ACCEPTED FOR RECEIPTOS EXTERNAL/CONFORMANCE PINNING**

Date: 2026-07-30
Audited repository: `trustless-ai/recompute-kit`
Pinned branch target: public `main`
Current authoritative immutable commit: `dfc0351834f744268a089cfbf90117841d604d11`
Historical previous immutable commit: `b672bbfa2f888237c6c4e7623510d4f02f48ad39`
Target suite directory: `conformance/aggregate-budget-v0`

## Pointer-only semantic maintenance proof

The current authoritative pin is a **POINTER-ONLY SEMANTIC MAINTENANCE** update.

Required proof was verified:

- `dfc0351834f744268a089cfbf90117841d604d11` is the direct child of
  `b672bbfa2f888237c6c4e7623510d4f02f48ad39`;
- the complete upstream delta contains only:
  - `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md`
  - `conformance/aggregate-budget-v0/suite.json`
- no vectors changed;
- no executable gate changed;
- no conformance runner changed;
- no shared helper, schema, fixture, PQ, TEE, v0.7, RSF, or PDF material changed.

The old pin was valid, but it became semantically stale after the upstream
specification was strengthened. The conformance claim does not move, the vector
oracle does not move, the executable gate does not move, and the conformance
runner does not move. Only the immutable pointer and spec identity move, and
the strengthened specification now states constructive unreachability
explicitly.

## Scope and method

I worked read-only against the public repository and audited the suite from
**exact Git blob bytes**, not from a potentially line-ending-normalized Windows
worktree.

This distinction mattered: a normal checkout on this host produced a vectors
hash mismatch before execution because the checked-out bytes were not identical
to the committed blob bytes. All acceptance conclusions below are therefore
based on a blob-extracted raw tree recreated from `git cat-file blob
<commit>:<path>` and independently checked again from exact bytes via Python.

## Exact pinned files, byte counts, SHA-256, and change status

| Path | Bytes | SHA-256 | Status vs previous pin |
|---|---:|---|---|
| `conformance/aggregate-budget-v0/suite.json` | 433 | `b451e4b00c9355af513d0c8ed0534673338da885c8eba3f763728367da969c0d` | CHANGED |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md` | 5093 | `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c` | CHANGED |
| `conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json` | 7165 | `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85` | UNCHANGED |
| `conformance/aggregate-budget-v0/gate.ts` | 3305 | `c448464ef3b3e3fffebdcec676a3c7d6e2f576df70fe0522d0ac976222935126` | UNCHANGED |
| `bin/conformance-suite` | 6534 | `2215081e780cb250cbfd1eb19aff2dc845e41b9df6ee503400f9f5d9832c5ebe` | UNCHANGED |

## Required confirmations

### 1) Recomputed spec and vectors SHA-256

- `aggregate-budget-v0.spec.md` SHA-256: `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c`
- `aggregate-budget-v0.vectors.json` SHA-256: `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

### 2) Confirm vectors hash

Confirmed exactly:

`ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`

### 3) Confirm vector count

Confirmed: there are exactly **7** vectors.

### 4) Confirm suite declaration

The authoritative `suite.json` at commit
`dfc0351834f744268a089cfbf90117841d604d11` declares:

- vectors path: `aggregate-budget-v0.vectors.json`
- vectors SHA-256: `ac6f6efd485e887a7f82140ac5be234643af17efb24506d9cd40e87ecd2bcb85`
- spec path: `aggregate-budget-v0.spec.md`
- spec SHA-256: `874e92ab93541ae3d9893f1603945b5e86ac568cd1fe14ad31047b2cdf8f699c`
- adapter command: `bun gate.ts --grade`

The suite declaration matches the independently recomputed raw vector blob.

## Honest suite run

### Command

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade'
```

### Environment actually used

- `bun --version` → `1.3.14`
- `python --version` → `Python 3.12.10`
- `PYTHONIOENCODING=utf-8` set for execution to preserve the suite script's
  Unicode status output on this Windows host
- Working tree for execution: blob-extracted raw copy reconstructed from commit
  `dfc0351834f744268a089cfbf90117841d604d11`

### Output

```text
suite: aggregate_budget.v0
✓ vectors  sha256 ac6f6efd485e887a… — matches declared
✓ spec     sha256 874e92ab93541ae3… — matches declared
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

### Result

- total: **7**
- reproduced: **7**
- failed: **0**
- verdict: **PASS**

## Known wrong / tamper run

### Command

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade --tamper'
```

### Output

```text
suite: aggregate_budget.v0
✓ vectors  sha256 ac6f6efd485e887a… — matches declared
✓ spec     sha256 874e92ab93541ae3… — matches declared
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

### Result

- total: **7**
- reproduced: **2**
- failed: **5**
- verdict: **FAIL AS EXPECTED**

## Suite checker / independent clean recomputation

I independently recomputed every vector with a separate clean checker that
implements only the pinned root-keyed predicate over admitted draws for the
pinned `(rootId, periodIndex)`.

Independent result:

- accepted/reproduced: **7/7**
- verdict: **PASS**

## Predicate-level counterexample vs sound reference execution

The vector `fanout-exceeds-root-cap` remains the load-bearing
predicate-level discriminator. It is deliberately non-conserving input used to
distinguish:

- sound root-keyed aggregation; and
- the tempting but incorrect per-edge maximum method.

The vector itself remains unchanged.

The conformance counterexample remains a valid predicate-level discriminator,
while the corresponding 2400 admitted execution trace is unproducible on the
sound reference implementation. The strengthened specification makes this
constructive-unreachability boundary explicit.

On the sound reference execution boundary stated by the strengthened spec:

- `_draw(900)` succeeds;
- `_draw(800)` succeeds;
- `_draw(700)` reverts with `RootBoundExceeded`;
- `spentRoot` remains exactly `1700`;
- the rejected 700 draw produces no admitted event corresponding to a 2400
  cumulative trace;
- the 2400 admitted execution is unreachable by construction.

## Constructive-unreachability evidence boundary

The spec at commit `dfc0351834f744268a089cfbf90117841d604d11` cites
`afab44c` as supporting replay evidence, but that shortened reference was not
resolved to a full immutable commit in this pass.

Accordingly, the upstream specification itself is the pinned authority for the
constructive-unreachability statement. Any external replay beyond that spec text
is treated here as **non-pinned supporting evidence**.

## Commands run

### Resolve current upstream main and the current aggregate-budget-specific target

```bash
git fetch origin --quiet
git symbolic-ref refs/remotes/origin/HEAD
# => refs/remotes/origin/main
git rev-parse origin/main
# => 300c512f47b3e1ed1fcb5d607a2c79e41bb1dfc8
git rev-parse dfc0351834f744268a089cfbf90117841d604d11^
# => b672bbfa2f888237c6c4e7623510d4f02f48ad39
git diff --name-only b672bbfa2f888237c6c4e7623510d4f02f48ad39 dfc0351834f744268a089cfbf90117841d604d11
```

### Recreate raw audited files from exact blob bytes

```bash
git cat-file blob dfc0351834f744268a089cfbf90117841d604d11:bin/conformance-suite
git cat-file blob dfc0351834f744268a089cfbf90117841d604d11:conformance/aggregate-budget-v0/suite.json
git cat-file blob dfc0351834f744268a089cfbf90117841d604d11:conformance/aggregate-budget-v0/aggregate-budget-v0.spec.md
git cat-file blob dfc0351834f744268a089cfbf90117841d604d11:conformance/aggregate-budget-v0/aggregate-budget-v0.vectors.json
git cat-file blob dfc0351834f744268a089cfbf90117841d604d11:conformance/aggregate-budget-v0/gate.ts
```

### Run conformance suite on exact blob bytes

```bash
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade'
python bin/conformance-suite --suite conformance/aggregate-budget-v0 --adapter-cmd 'bun gate.ts --grade --tamper'
```

## Hash-audit scope note

`SCOPE: docs/ only — fixture manifests under tests/fixtures/** were not audited in this pass.`

That docs-only audit found no aggregate-track blocker and no confirmed phantom,
malformed, or undefined current-pin hashes in the aggregate-budget pin
documents.

## Acceptance conclusion

The current authoritative aggregate-budget package is internally consistent and
externally reproducible from immutable Git blob bytes at commit
`dfc0351834f744268a089cfbf90117841d604d11`.

- suite hash matches declaration
- spec hash matches declaration
- vectors hash matches declaration
- vector count is exactly 7
- honest implementation reproduces **7/7** with verdict **PASS**
- documented wrong `--tamper` method fails as intended: **2/7 reproduced**,
  **5/7 failed**, verdict **FAIL AS EXPECTED**
- independent clean recomputation confirms all **7/7** expected results
- the fan-out counterexample remains valid and load-bearing as a
  predicate-level discriminator
- the strengthened specification now states constructive unreachability
  explicitly
- vectors, gate, and runner identities are unchanged from the previous valid
  pin

## Final verdict

**ACCEPTED FOR RECEIPTOS EXTERNAL/CONFORMANCE PINNING**
