# Independent blind-diff harnesses — Unanchored Issuance-Time Witness v0

**Status: non-production, non-reference, independent blind-diff harnesses.**
These detectors are NOT a production witness evaluator and NOT a reference
implementation. They exist only to *independently* re-derive each vector's
`admission_result` from the specification text and diff it against the pinned
expected output — the "future implementation" the fixture README anticipates.
They were built **from the spec text alone** and **frozen before any vector's
`.expected` was read**. The repository's deliberate absence of a production
evaluator is preserved.

Two independent implementations (Python + TypeScript), built in isolation. Their
agreement is positive evidence the spec is unambiguous; their one historical
disagreement surfaced a real §11 ambiguity (below), which was corrected narrowly
in the specification/fixtures (separate PR).

## Layer 1 — frozen historical detectors + preserved evidence

Built against the **pre-correction** spec (`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`
@ sha256 `24fdf071…`). **Byte-frozen; do not modify.**

| detector | sha256 |
|---|---|
| `detector.py` (Python) | `02bdef9e350642cdf3bee2c7d334ec70a2a439829d7b78748df0349868faf238` |
| `detector.ts` (TypeScript) | `1bd5e7513371ff123f01d60bcb405e2c6ffd6549d8c629a31a682f2339331c7c` |

**Historical rerun** against the correction candidate `bf8b22f3`:

- Python **15/16**, TypeScript **16/16**.
- Sole residual: `co-late-terminal-after-overdue` — frozen Python emits the
  pre-correction §11 reading `findings=[late_resolution]`,
  `primary_reason_code=late_resolution`; the corrected expected is
  `findings=[resolution_overdue, late_resolution]`,
  `primary_reason_code=resolution_overdue`, `resolution_timing=late`.

This residual is **preserved as evidence, not presented as a failure**: a frozen
detector cannot retroactively adopt a spec correction, so its persistence
documents that the original §11 ambiguity was real.

## Layer 2 — post-correction Python detector

Derived from frozen `detector.py` with **exactly two disclosed semantic deltas**,
both implementing the corrected §11 coexistence rule:

1. **resolution coexistence** — a late terminal after a previously-proven overdue
   interval retains `resolution_overdue` + `late_resolution` (§13.4 order
   (15,1) < (15,2) ⇒ `resolution_overdue` primary; `resolution_timing` stays `late`).
2. **publication coexistence** — the symmetric rule for `publication_overdue` +
   `late_publication` (§13.4 (16,0) < (16,1)). **The current 16-vector package does
   not exercise this branch**; it is present for spec-faithful symmetry and is
   inert on these vectors.

| detector | sha256 |
|---|---|
| `detector-postcorrection.py` | `6a9f43857b7e61700abefa6251f17183649a9c4af9fb0578cd35b79e72b89f37` |

Exact delta from frozen Python: [`postcorrection.delta.diff`](postcorrection.delta.diff).

**Corrected-package rerun** — post-correction Python **16/16**, frozen TypeScript
(unchanged) **16/16**, against both:

- candidate `bf8b22f3`
- canonical merged main `91b948728cc42896f25b1065d5e80e6043aaff72`
  - Specification SHA-256 `34de6694e6fb28b6d521a3314c0454f4639dfaba7d29dc0fb217244970e0536a` (independently recomputed)
  - Fixture-set SHA-256 `f20aa3f045f2bb55b40ab3c34ed6921dce5e3d05afa58ed7877d09d9ded04622` (independently recomputed)

No previously-passing output changed: post-correction Python differs from frozen
Python on exactly one vector (`co-late-terminal-after-overdue`); the publication
delta is inert on all 16.

## Reproduce

```sh
python3 tests/blind-diff/run.py   # Python detectors always; TypeScript if `bun` is installed
```
