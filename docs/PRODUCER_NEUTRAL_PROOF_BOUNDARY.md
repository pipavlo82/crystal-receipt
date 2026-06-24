# PRODUCER_NEUTRAL_PROOF_BOUNDARY

Different systems can produce different kinds of work while sharing the same verifiable proof boundary.

## Thesis

Producer shapes may vary.

Examples:
- Stealth / handoff evidence
- CYPHES-like workflow evidence
- generic agent / tool-run evidence

But the portable proof boundary should remain stable.

## What varies by producer

The source system may differ in:
- task or workflow model
- execution/runtime environment
- contribution / claim / credit semantics
- human-readable source context
- orchestration or coordination logic

These are producer-level concerns.

## What stays invariant at the proof boundary

All producers should be able to map into the same receipt-facing proof substrate:
- `receiptos.evidence_capsule.v0`
- `receiptos.provenance_summary.v0`

The following semantics remain stable:
- `receipt_root` derivation and status
- verifier result semantics
- Merkle proof reference semantics
- anchor status semantics
- replay manifest boundary

## Boundary rule

Producer-specific fields must not be required by the shared Evidence Capsule schema.

The proof boundary should not require:
- CYPHES workflow objects
- Stealth-specific runtime internals
- credit aggregation
- reputation or scoring
- workflow-chain semantics

Those stay outside the shared receipt/evidence boundary.

## Why this matters

If the proof boundary is stable across producers, then:
- different systems can produce work
- receipts become portable durable objects
- verification does not depend on a single producer
- higher-order workflow or credit layers can evolve independently above the substrate
