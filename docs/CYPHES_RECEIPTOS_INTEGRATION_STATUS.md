# CYPHES ↔ ReceiptOS Integration Status

## Purpose

This document summarizes what ReceiptOS already provides to CYPHES today under the existing agreed boundary:

- **CYPHES owns workflow meaning and decisions**
- **ReceiptOS owns proof packaging and proof presentation**

It does **not** introduce a new architecture, schema, or runtime design.
It only records the current implementation status of the existing agreement.

## 1. What is already implemented

ReceiptOS already provides the following substrate capabilities that CYPHES can use today:

- producer-neutral proof boundary
- explicit producer proof contract
- external producer integration guide
- integration manifest
- stable portable evidence envelope input path (`stealth.session.evidence.v1`)
- anchor-independent `receipt_root`
- self-defending receipt root computation inside the root function itself
- portable verifier-facing root recomputation and mismatch detection
- `receiptos.capsule_summary.v0`
- `receiptos.evidence_capsule.v0`
- `receiptos.provenance_summary.v0`
- replay-manifest boundary generation
- proof refs / Merkle refs / anchor refs presentation
- static ReceiptOS Viewer
- local artifact loading in the Viewer
- folder-based local artifact loading for extracted artifact bundles
- Electron desktop wrapper for the Viewer
- external producer normalization/import path
- generic producer import
- concrete external producers already demonstrated:
  - `external.coding_run.v0`
  - `github.actions_run.v0`
  - `claude.code.session.v0`
  - Stealth handoff evidence via `stealth-handoff`
- internal producer adapter interface and registry
- GitHub Actions export workflow for generating downloadable ReceiptOS artifact bundles

These capabilities are already sufficient to package proof-oriented evidence from multiple producer systems into the same shared ReceiptOS proof boundary.

## 2. How this maps onto the CYPHES boundary

### CYPHES owns

CYPHES remains the system of record for:

- campaigns
- work units
- claims
- contributions
- verifier decisions
- credits
- reports
- settlement
- workflow policy
- workflow runtime semantics

### ReceiptOS owns

ReceiptOS remains responsible for:

- proof packaging
- evidence normalization
- `receipt_root`
- Evidence Capsule generation
- Provenance Summary generation
- verifier-facing proof state
- replay metadata
- `proof_refs`
- Merkle refs / anchor refs presentation
- proof-oriented Viewer / Desktop inspection surface

### Boundary interpretation

ReceiptOS can package evidence **about** CYPHES workflow objects and decisions.
ReceiptOS does **not** become the CYPHES workflow engine, credit engine, settlement engine, or verifier policy owner.

## 3. Current integration path

The current intended path is:

```text
CYPHES producer
→ ReceiptOS adapter
→ normalized evidence
→ receipt_root
→ Evidence Capsule
→ Provenance Summary
→ Viewer/Desktop
→ settlement-facing references back to CYPHES
```

More concretely:

```text
CYPHES workflow evidence
→ ProducerAdapter normalize(...)
→ stealth.session.evidence.v1
→ receipt_root recomputation
→ receiptos.capsule_summary.v0
→ receiptos.evidence_capsule.v0
→ receiptos.provenance_summary.v0
→ ReceiptOS Viewer / Desktop wrapper
→ downstream references into CYPHES reports / credits / settlement surfaces
```

This means CYPHES does not need a custom proof output schema.
It only needs a producer adapter that maps CYPHES evidence into the existing portable envelope.

## 4. Remaining work

Only the genuinely missing CYPHES-specific integration work remains:

- native CYPHES producer adapter
- sanitized CYPHES source fixture(s)
- ATP-like or real CYPHES example receipts routed through ReceiptOS
- explicit settlement reference mapping from ReceiptOS artifacts back to CYPHES report / credit / settlement objects
- verifier decision references in a CYPHES adapter that preserve CYPHES ownership without leaking workflow semantics into shared ReceiptOS outputs
- optional on-chain settlement integration later, if CYPHES needs it

The shared proof layer itself does **not** need a redesign first.

## 5. Explicit non-goals

ReceiptOS does **not** own:

- campaigns
- economics
- reputation
- credits
- settlement logic
- verifier policy
- CYPHES runtime
- workflow orchestration semantics
- report-generation semantics

ReceiptOS should not compute or reinterpret CYPHES business outcomes.
It should package and present proof-carrying evidence around those outcomes.

## Summary

ReceiptOS is already far enough along to serve as CYPHES's portable proof packaging and proof presentation layer **today**.

What remains is not a new architecture.
What remains is a **CYPHES-native producer adapter and example evidence path** that feeds the existing ReceiptOS substrate.
