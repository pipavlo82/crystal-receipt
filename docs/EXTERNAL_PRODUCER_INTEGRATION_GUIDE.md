# EXTERNAL_PRODUCER_INTEGRATION_GUIDE

## 1. Purpose

This guide explains how an external producer system integrates with the current ReceiptOS proof substrate.

It is intentionally practical.

The goal is to help an external integrator understand:
- what minimum evidence a producer must export
- how that evidence moves through the current ReceiptOS pipeline
- what stays the producer's responsibility
- what ReceiptOS guarantees in return
- what does **not** belong inside the shared proof boundary

This guide does not replace the producer contract or the boundary docs.
It is the practical entry point for using them.

## 2. Who is this guide for

This guide is for teams or developers building external systems that want to emit execution evidence into the current ReceiptOS proof boundary.

Examples include:
- agent runtimes
- workflow systems
- tool-run systems
- coordination systems
- future execution platforms that want portable, verifier-facing proof artifacts

It is not specific to Stealth, CYPHES, or any single producer.
Those are examples of producer shapes, not special cases in the shared proof boundary.

## 3. Producer → ReceiptOS flow

At a high level, the integration flow is:

```text
producer system
-> export execution evidence
-> prepare evidence compatible with the current ReceiptOS input path
-> ReceiptOS summary/build steps
-> Evidence Capsule v0
-> Provenance Summary v0
-> optional viewer / rendering layer
```

The producer owns the upstream workflow and execution semantics.
ReceiptOS owns the proof-facing reduction and presentation boundary.

A producer may differ in:
- workflow model
- runtime environment
- task semantics
- contribution / claim / credit semantics
- human-readable source context

But once the evidence enters ReceiptOS, the target proof boundary remains stable.

For the architectural boundary, see:
- `docs/receiptos_integration_manifest_v0.md`
- `docs/PRODUCER_NEUTRAL_PROOF_BOUNDARY.md`
- `docs/PRODUCER_PROOF_CONTRACT_V0.md`

## 4. Minimum producer evidence

A producer does not need to match another producer's workflow model.
It does need to export enough evidence for the current ReceiptOS implementation to reduce it into the shared proof boundary.

At a practical minimum, a producer must export evidence covering these categories:

### Identity and context
- schema or source-format identity
- session, run, or execution identity
- working context or target context

### Payload / action evidence
- title, prompt, action description, or equivalent payload marker

### Execution context
- execution records, commands, or enough equivalent information to summarize what ran

### Evidence record
- changed files, changed artifacts, diff identity, or equivalent evidence trace

### Root and proof material
- stored `receipt_root`
- enough source content to recompute the canonical root independently
- Merkle and anchor fields when present

### Metadata
- enough metadata to support replay summary / manifest generation

The current fixtures in the repo satisfy this with portable evidence fields such as:
- task / prompt context
- commands
- execution records
- changes / diff identity
- anchor / Merkle / verifier-facing fields
- source metadata

For the formal contract, see:
- `docs/PRODUCER_PROOF_CONTRACT_V0.md`

## 5. ReceiptOS processing pipeline

Once a producer has emitted compatible evidence, the current ReceiptOS processing pipeline is:

### `createCapsuleSummary()`

Purpose:
- read producer evidence
- recompute and compare `receipt_root`
- summarize Merkle status
- build capsule sections
- prepare replay-relevant and render-relevant summary outputs

What it produces:
- `receiptos.capsule_summary.v0`

This is the first reduction step from raw producer evidence into a shared ReceiptOS summary shape.

### `createEvidenceCapsuleV0()`

Purpose:
- reduce the summary into the current stable proof-facing boundary

What it produces:
- `receiptos.evidence_capsule.v0`

This artifact is the current shared Evidence Capsule proof substrate.
It keeps the top-level proof boundary stable across producer shapes.

### `createProvenanceSummaryV0()`

Purpose:
- derive an interpretive operational summary from the Evidence Capsule

What it produces:
- `receiptos.provenance_summary.v0`

This summary is derived-only.
It is not the verifier and not a new source of proof truth.

## 6. Producer responsibilities

The producer remains responsible for:
- workflow semantics
- task semantics
- execution semantics
- authorization intent
- claim / contribution semantics
- credit policy
- report generation logic
- the truth of upstream source evidence

ReceiptOS does not take ownership of those producer-specific meanings.
It may present evidence about them, but it does not become the source of truth for them.

In practical terms, the producer is responsible for exporting evidence that is:
- stable enough to package
- traceable enough to summarize
- complete enough to recompute `receipt_root`
- honest about missing, pending, or mismatched states

## 7. ReceiptOS responsibilities

ReceiptOS is responsible for:
- reducing compatible producer evidence into the existing shared proof boundary
- recomputing and comparing `receipt_root`
- presenting verifier-facing proof status
- presenting Merkle and anchor status
- generating the current Evidence Capsule v0 shape
- generating the current Provenance Summary v0 shape
- preserving the proof/presentation boundary between producer workflow logic and shared proof semantics

In the current implementation, ReceiptOS guarantees:
- stable `receiptos.evidence_capsule.v0` output shape
- stable `receiptos.provenance_summary.v0` output shape
- independently recomputed `receipt_root` comparison
- stable verifier-facing proof status semantics
- stable Merkle proof reference semantics
- stable anchor status semantics
- replay-manifest boundary generation from source evidence

`receipt_root` computation ignores the top-level `anchor`, so producers should expect the same root whether normalized evidence is anchor-less or already carries a top-level anchor.

ReceiptOS does **not** guarantee producer workflow truth beyond what the source evidence itself supports.

## 8. Example end-to-end flow

A practical end-to-end integration flow looks like this:

1. A producer system runs work in its own runtime.
2. The producer exports portable execution evidence with enough source fields to support the current ReceiptOS boundary.
3. ReceiptOS reads that evidence via `createCapsuleSummary()`.
4. ReceiptOS reduces the summary into `receiptos.evidence_capsule.v0` via `createEvidenceCapsuleV0()`.
5. ReceiptOS derives `receiptos.provenance_summary.v0` via `createProvenanceSummaryV0()`.
6. Crystal Receipt or another viewer may present those artifacts visually, but visual presentation is downstream of the proof substrate.

Current repo examples already cover multiple producer shapes, including:
- Stealth / handoff evidence
- CYPHES-like workflow evidence
- generic tool-run evidence
- `external.coding_run.v0` as the first concrete external coding-agent/tool-run import example

Those source shapes differ.
The shared proof boundary does not.

## 9. Non-goals

This guide does **not** define:
- a new schema
- a new verifier
- new `receipt_root` semantics
- new canonicalization rules
- workflow-chain semantics
- reputation semantics
- score computation
- credit aggregation across receipts
- settlement logic
- on-chain expansion beyond the current proof surface
- producer runtime integration code

It also does not turn Crystal Receipt into the trust layer.
The verifier and proof semantics remain the trust layer.
Crystal Receipt remains a presentation / inspection layer around that boundary.

## 10. Related docs

For the architecture and rules behind this guide, see:
- `README.md`
- `docs/EXECUTION_PROVENANCE_FRAMING.md`
- `docs/EVIDENCE_CAPSULE_MODEL_V0.md`
- `docs/CYPHES_EVIDENCE_CAPSULE_ADAPTER_V0.md`
- `docs/PRODUCER_NEUTRAL_PROOF_BOUNDARY.md`
- `docs/PRODUCER_PROOF_CONTRACT_V0.md`
