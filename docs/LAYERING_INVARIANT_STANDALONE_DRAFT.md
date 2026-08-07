# The Layering Invariant — factual record, judgment, consequence (draft v0)

**Status:** DRAFT for co-drafting. **Authors:** Pavlo (`@pipavlo82`) · Tiago Merlini (`@TMerlini`). **Proposed home:** standalone, CC0 — not inside ReceiptOS, ERC-8183, the Console, or any other leg, for the same reason the invariant itself gives: filing it under one leg implies it belongs to that leg.

**How this draft is meant to be used:** First commit scope is §0–§2 only. §1 and §2 are drafted from verified provenance (second-pass audit, Aug 7, 2026). Later sections (external instances, failure-mode tests, implementation checks) are deferred. Nothing here is settled.

---

## 0 · The invariant, in one line

> **References point backward. Authority flows nowhere. Nothing upstream is ever mutated.**

Three layers, always distinguishable, never collapsed:

```
   factual record   →   judgment   →   consequence
   (what was captured)  (what was decided)  (what was enforced)
```

Each layer may **cite** the one before it. No layer **inherits validity** from the one before it. No layer **rewrites** the one before it.

## 1 · Provenance / lineage

**Authority:** second-pass audit, Aug 7, 2026 (revised).

This invariant was not invented as a single document. It converged in parallel on two legs — a public [ERC-8183](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902) thread and ReceiptOS work in [`pipavlo82/crystal-receipt`](https://github.com/pipavlo82/crystal-receipt) — without shared vocabulary until the rule was named. The sections below preserve that parallel history and label each claim by maturity.

---

### Leg A — ReceiptOS / Crystal Receipt

**1. Observation and timing are not validity**
*(Normative + tested in repo)*

ReceiptOS separated receipt validity from source observation and timing facts before the invariant had a name. Normative prose appears in `docs/EVIDENCE_CAPSULE_SCHEMA_V0.md` (PRs [#92](https://github.com/pipavlo82/crystal-receipt)/[#93](https://github.com/pipavlo82/crystal-receipt)), `docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`, and Chronicle admission gating (PR [#112](https://github.com/pipavlo82/crystal-receipt)). Normative witness vectors pin historical retention when a later terminal resolves after a proven overdue interval (`CO-LATE-TERMINAL-AFTER-OVERDUE` in `tests/receiptos/unanchored-issuance-witness-vectors.test.ts`). Tiago Merlini's independent blind-diff harnesses (PR [#120](https://github.com/pipavlo82/crystal-receipt); `tests/blind-diff/README.md`) re-derived witness admission results from specification text alone and preserved visible disagreement when a corrected §11 coexistence rule surfaced ambiguity — they are non-production, non-reference research tools, not the normative conformance surface.

**2. Async Decision Write v0**
*(Normative prose only — not implemented as wire artifact)*

[`docs/ASYNC_DECISION_WRITE_V0.md`](https://github.com/pipavlo82/crystal-receipt/blob/main/docs/ASYNC_DECISION_WRITE_V0.md) (PR [#117](https://github.com/pipavlo82/crystal-receipt), Jul 26, 2026) pins evaluation order so decision view, landing view, validity, admission, timing, observation, and persistence remain orthogonal. Same identity with non-identical canonical content is explicit conflict, never silent merge. The document is normative but documentation-only: no dedicated async-write schema, persistence layer, or enum set exists in the repository yet.

**3. Semantic non-elevation (research record)**
*(Non-normative)*

[`docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md`](https://github.com/pipavlo82/crystal-receipt/blob/main/docs/EXECUTABLE_SEMANTIC_NON_ELEVATION_PROFILES_WORKING_RECORD.md) (PR [#121](https://github.com/pipavlo82/crystal-receipt)) generalizes the pattern: no semantic dimension elevates into another without an explicit, independently verifiable transition rule. It does not define conformance and does not allocate normative reason codes.

**4. Recursive aggregate / read-side seam**
*(Non-normative draft)*

[`docs/RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md`](https://github.com/pipavlo82/crystal-receipt/blob/main/docs/RECURSIVE_AGGREGATE_BOUNDARY_V0_WORKING_DRAFT.md) (PR [#125](https://github.com/pipavlo82/crystal-receipt)) and [`docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md`](https://github.com/pipavlo82/crystal-receipt/blob/main/docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md) (PR [#126](https://github.com/pipavlo82/crystal-receipt)) instantiate the read-side fold: aggregated does not automatically become reputation truth, comparability, or terminal judgment. Structural Chronicle aggregates are explicitly not semantic fold comparability.

**5. Executable RSF positions 1–28**
*(Implemented + tested on `main` @ `7dbedb1f`)*

Recursive Singleton Fold is the narrowest executable profile: one admitted `chronicle_entry.v0` evaluated through 28 ordered positions. Prefix positions 1–17 (PRs [#137](https://github.com/pipavlo82/crystal-receipt)–[#151](https://github.com/pipavlo82/crystal-receipt)); positions 18–28 normative package (PR [#155](https://github.com/pipavlo82/crystal-receipt)), production evaluator (PR [#156](https://github.com/pipavlo82/crystal-receipt)), stage-continuation classification (PR [#157](https://github.com/pipavlo82/crystal-receipt)). Public entrypoint: `evaluateCompleteRsf`. Position 28 owns complete-aggregate validation and is the sole reachability site for the `accepted` evaluation envelope (`completedThrough: 28`). Position 24 owns mechanical no-class-promotion: `no_stronger_semantic_class_created` is recomputed, not trusted from caller-supplied booleans. Position 25 owns transition: `transition_result` must derive to the pinned success object. Positions 1–13 independently recompute Chronicle admission before any aggregate judgment is constructed.

**6. Adversarial closure**
*(Implemented + tested — PR [#158](https://github.com/pipavlo82/crystal-receipt))*

Hardening at `7dbedb1f`: Proxy rejection before reflection (`strict-json-snapshot.ts`); mutation guards on positions 18–28; 34 conformance vectors; 11 isolated mutants caught by named tests (early acceptance, reordered positions, trusted candidate booleans at position 24, reconstruction reuse, Proxy attacks). Final verification on merge: 734 `tests/receiptos` pass (per PR #158 body).

---

### Leg B — ERC-8183 thread (commerce articulation)

The same rule was derived independently in public discussion on [Ethereum Magicians ERC-8183](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902), in exchange with Aziz and other implementers, Jul 20 – Aug 6, 2026.

| Stage | EM posts | Maturity |
|---|---|---|
| Timing ⊥ validity | [#324](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/324), [#325](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/325) | **Independently reviewed** (Aziz names and blesses invariant) |
| Async write boundary | [#335](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/335), [#336](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/336) | **Independently reviewed** (Aziz confirms degenerate collapse to sync path) |
| Aggregate / read-side fold | [#337](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/337)–[#346](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/346), [#355](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/355) | **Independently reviewed** (Aziz confirms recursive rule + singleton identity test) |
| Evidence / arbitration / collateral | [#347](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/347)–[#349](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/349) | **Public design** (Pavlo pins three-layer boundary; Idios walkthrough) |
| RSF prefix + full closure | [#358](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/358)–[#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361) | **Independently reviewed closure** (Aziz #361) |

**Evidence / arbitration / collateral** was pinned in [post #347](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/347) (Jul 28, 2026): phase-separated evidence commitments; boundary that economic resolution states (`ResolvedToAlice`, `ResolvedToBob`) must not become evidence-validity verdicts. This is historical public provenance for the three-layer naming — not a retrospective mapping onto ReceiptOS.

---

### Convergence

The two legs are parallel, not sequential dependencies:

```
ReceiptOS repo                          ERC-8183 thread
─────────────────                       ─────────────────
observation/timing ≠ validity    ←──→   #324–325
Async Decision Write v0          ←──→   #335–336
aggregate / read-side fold       ←──→   #337–346, #355
(evidence / arbitration /         ←──→   #347–349
 collateral — commerce naming)
RSF 1–28 + adversarial closure    ←──→   #358–361
```

The standalone primitive should not be scoped as belonging exclusively to either leg. Filing it under ReceiptOS or ERC-8183 alone would violate the rule the invariant states.

---

### Aziz — precise attribution

**Aziz** ([EM user `aziz`](https://ethereum-magicians.org/u/aziz)) is an **independent principle and closure reviewer** on the ERC-8183 thread. Public record confirms:

- He named and blessed the timing-vs-validity invariant ([#324](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/324), [#326](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/326)).
- He pressure-tested Async Decision Write against terminal-state escrow ([#336](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/336)).
- He confirmed the recursive aggregate boundary and singleton-fold identity test ([#355](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/355)).
- He reviewed the RSF prefix evaluator ([#359](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/359)).
- He confirmed full 1–28 closure as enforced reachability, not documentation ([#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361)).

He is **not** a co-author of ReceiptOS repository artifacts, **not** attested as having run the repository test suite on public record ([#357](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/357) offered to run implementation; [#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361) validates Pavlo's reported mutant results and states the general lesson). The repository working record explicitly disclaims that Aziz accepted the full semantic non-elevation record or RSF profile as normative conformance ([`RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md`](https://github.com/pipavlo82/crystal-receipt/blob/main/docs/RECURSIVE_SINGLETON_FOLD_PROFILE_V0_WORKING_DRAFT.md) status section).

**Tiago Merlini** contributed independent blind-diff verification (PR [#120](https://github.com/pipavlo82/crystal-receipt)): spec-from-text re-derivation and preserved disagreement visibility. The non-elevation working record credits him accordingly — not endorsement of the full record.

## 2 · The invariant

### Compact formulation

> **References point backward. Authority flows nowhere. Nothing upstream is ever mutated.**

Three layers, always distinguishable, never collapsed:

```
factual record  →  judgment  →  consequence
(what was captured)  (what was decided)  (what was enforced)
```

Each layer may **cite** the layer before it. No layer **inherits validity** from the layer before it. No layer **rewrites** the layer before it.

---

### Two directions (both are the same violation, mirrored)

**1. Downward invalidation**

A later judgment or consequence **must not** retroactively invalidate or rewrite an earlier artifact that was valid under the state available at the time it was produced.

Examples of violation:

- "The outcome proved wrong, therefore the evidence was fake."
- "The action reverted, therefore the signature was invalid."
- "The dispute resolved against the worker, therefore the delivery record was never authentic."

Conforming behavior: what fails is the **premise for the later action**, not the **authenticity of the earlier record**. A historically valid artifact remains historically valid; consumers must distinguish "authentic then" from "sufficient for this later question now."

ReceiptOS precedent (tested): normative witness vectors retain `resolution_overdue` alongside `late_resolution` with `supersession: false` when a late terminal follows a proven overdue interval (`CO-LATE-TERMINAL-AFTER-OVERDUE`, `tests/receiptos/unanchored-issuance-witness-vectors.test.ts`). Async Decision Write v0 (normative): a superseded record remains historically what it was under its declared basis (PR [#117](https://github.com/pipavlo82/crystal-receipt), `docs/ASYNC_DECISION_WRITE_V0.md`).

ERC-8183 precedent (public design): `ResolvedToAlice` and `ResolvedToBob` remain **economic resolution states** and do not automatically become evidence-validity verdicts ([#347](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/347)).

**2. Upward inheritance**

An earlier admission, observation, timing fact, prefix success, or caller-supplied claim **must not** authorize a later judgment or consequence unless the boundary that **owns** that decision independently earns it.

Examples of violation:

- "It was admitted, therefore it is valid."
- "A verdict exists, therefore execute."
- "The prefix matched, therefore the aggregate is accepted."
- "The evaluator signed a ratio, therefore the ratio is correct."

Conforming behavior: each boundary recomputes what it claims to know. Admission is not validity. Observation is not validation. Settlement is not truth. Persistence is not comparability.

ReceiptOS implementation (tested on `main` @ `7dbedb1f`): RSF positions 1–13 independently recompute Chronicle admission; positions 18–28 earn aggregate **judgment**; position 24 recomputes `no_stronger_semantic_class_created` (caller booleans cannot serve as proof); position 25 derives `transition_result`; position 28 alone validates the complete aggregate and reaches the `accepted` evaluation envelope. RSF **earns the judgment** at its boundary; a separate consumer — escrow release, bond slash, reputation write, execution gate — **may apply a consequence**. RSF does not own downstream enforcement. Aziz independently confirmed the principle on closure ([#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361)): validity is earned at the last step of the owning boundary, never inherited from an earlier one.

ERC-8183 articulation (public design): evidence commitments establish and preserve the factual record; arbitration determines the contested economic outcome; collateral enforces the economic consequence — three roles, three layers ([#347](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/347)). Aziz's "stake, not truth" framing ([#322](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/322)) is the upward-inheritance antidote for settlement-derived reputation: money moved on an evaluator's commitment is non-repudiable, not recomputable as correctness.

---

### Commerce leg vs implementation leg

| | **ERC-8183 (commerce leg)** | **RSF (ReceiptOS judgment leg)** |
|---|---|---|
| **Role** | Names the three layers in agentic commerce and dispute context | Mechanically enforces upward-inheritance for one aggregate **judgment** fold |
| **Factual record** | Phase-separated evidence commitments; filing-time roots inert on resolution path ([#347](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/347), [#352](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/352)) | Independent `receipt_root` recomputation; source observation ≠ verifier result (`EVIDENCE_CAPSULE_SCHEMA_V0`) |
| **Judgment** | Evaluator `complete`/`reject`; bonded arbitration; compliance ratio as evaluator assertion, not inherited truth ([#322](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/322)) | Positions 18–28: semantic statement, eligibility, transition (25), no-class-promotion (24), complete-aggregate validation; `accepted` only at 28 |
| **Consequence** | Escrow release, refund, bond slash; terminal economic states | **Out of RSF scope** — applied by separate consumers after judgment is earned |
| **Maturity** | Public thread design + independent review | Implemented + tested on canonical `main` |

The legs share one invariant; they do not share one codebase. ERC-8183 does not implement RSF; RSF does not implement escrow. Composition is by rule, not by import.

---

### General rule (cross-leg)

> In any settlement or evaluation pipeline, **validity must be earned at the boundary that owns the judgment** — never inherited from an earlier admission, timing fact, prefix label, or caller-supplied success state.

Stated independently by Aziz on RSF closure ([#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361)). Enforced in RSF at the judgment boundary: a verified aggregate cannot be returned before position 28 completes; mutants that attempt early acceptance fail committed tests with non-zero exit (PR [#158](https://github.com/pipavlo82/crystal-receipt); reported [#360](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/360), reviewed [#361](https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902/361)). Consequence remains downstream.

---
*§1 and §2 drafted 2026-08-07 from verified provenance. Corrections by re-derivation preferred, as usual.*
