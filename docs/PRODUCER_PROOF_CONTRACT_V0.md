# PRODUCER_PROOF_CONTRACT_V0

## 1. Purpose

This document defines the explicit **v0 producer contract** for the ReceiptOS proof substrate.

Its purpose is to make the multi-producer proof boundary practical for external integrators.

After reading this document, a producer author should be able to answer three questions without additional explanation:

1. What must I provide as a producer?
2. What does ReceiptOS guarantee in return?
3. What is explicitly outside the proof boundary?

This document does **not** introduce a new runtime, a new verifier, or a new schema. It formalizes the rules that already make the current boundary work.

## 2. Scope

This contract applies to producers that want to map their execution evidence into the current ReceiptOS proof substrate.

It is concerned with:
- producer input obligations
- proof-boundary guarantees
- boundary invariants
- interpretation limits
- failure and mismatch handling

It is not concerned with:
- settlement
- reputation
- scoring
- workflow-chain semantics
- producer-specific runtime orchestration
- on-chain expansion beyond the current proof surface

## 3. Target artifacts

The v0 contract targets two shared artifacts:

1. `receiptos.evidence_capsule.v0`
2. `receiptos.provenance_summary.v0`

These artifacts are the shared proof-facing boundary.

Producer source shapes may differ, but the target proof boundary must remain stable.

## 4. Producer obligations

A producer must provide source evidence that the current ReceiptOS implementation can reduce into the existing proof boundary.

Practically, that means providing enough source evidence for ReceiptOS to:
- identify the payload or unit of work
- identify execution or equivalent action context
- identify the evidence record
- derive a canonical `receipt_root`
- compare stored and recomputed root values
- expose verifier-facing proof status
- expose replay-relevant summary fields

A producer is responsible for the truth of its own workflow, task, or runtime semantics.
ReceiptOS does not invent or repair missing workflow truth.

Producer obligations therefore include:
- provide a stable evidence document shape before proof packaging
- provide source fields required for canonicalization and root derivation
- preserve source traceability for major proof sections
- separate workflow claims from proof claims
- avoid passing computed reputation, scoring, or settlement semantics as shared proof truth

## 5. Minimum required source fields

A producer must provide source evidence sufficient to support the current shared proof boundary.

At a practical minimum, the producer must provide source fields covering these categories:

### Identity and context
- schema or source format identity
- session, run, or execution identity
- working context or target context

### Payload / action evidence
- a title, prompt, action description, or equivalent payload marker

### Execution context
- execution records, commands, or enough equivalent source information to summarize what ran

### Evidence record
- changed files, changed artifacts, diff identity, or equivalent evidence trace

### Root and proof material
- stored `receipt_root`
- enough source content to recompute the canonical root independently
- Merkle and anchor fields when present

### Metadata
- enough metadata to support replay summary / manifest generation

In the current implementation, these obligations are satisfied through portable evidence fields such as:
- task / prompt context
- commands
- execution records
- changes / diff identity
- anchor / Merkle / verifier-facing proof fields
- source metadata

## 6. Optional source fields

A producer may additionally provide source fields for richer interpretation, as long as they do not change the shared proof semantics.

Examples include:
- workflow objects
- authorization detail
- policy references
- claim / contribution / verification references
- report summaries
- producer-specific execution metadata
- richer human-readable context

These fields may enrich presentation, section summaries, or replay context.
They must not redefine the canonical proof boundary.

## 7. ReceiptOS guarantees

For producer inputs that fit the current implementation model, ReceiptOS guarantees reduction into the existing shared proof boundary.

In the current implementation, ReceiptOS guarantees:
- a stable `receiptos.evidence_capsule.v0` output shape
- a stable `receiptos.provenance_summary.v0` output shape
- independently recomputed `receipt_root` comparison
- stable verifier-facing proof status semantics
- stable Merkle proof reference semantics
- stable anchor status semantics
- replay-manifest boundary generation from source evidence

ReceiptOS also guarantees that:
- producer-specific fields are not required by the shared Evidence Capsule schema
- derived summaries do not overwrite stored proof values
- the verifier remains the source of truth for proof validity
- derived provenance summaries remain interpretive, not canonical truth

## 8. Boundary invariants

The following invariants must remain stable across producers.

### Top-level artifact invariants

All producers that satisfy the contract must be reducible into:
- `receiptos.evidence_capsule.v0`
- `receiptos.provenance_summary.v0`

The top-level Evidence Capsule proof boundary remains invariant:
- `schema`
- `action`
- `evidence`
- `receipt_root`
- `proof_refs`
- `verifier_result`
- `capsule`
- `replay_manifest`

The top-level Provenance Summary boundary remains invariant:
- `schema`
- `version`
- `what_happened`
- `evidence_present`
- `verifier_status`
- `receipt_root_status`
- `anchor_status`
- `replay_status`
- `warnings`
- `risk_flags`

### Semantic invariants

The following semantics must not vary by producer:
- `receipt_root` derivation meaning
- stored vs computed root comparison meaning
- verifier result meaning
- Merkle proof status meaning
- anchor status meaning
- replay boundary meaning

### Section invariants

The current capsule model uses these stable section ids:
- `payload`
- `policy_boundary`
- `authorization`
- `decision_trace`
- `execution`
- `evidence`
- `counterfactual`
- `result`
- `receipt_root`
- `merkle`
- `anchor`
- `replay_manifest`
- `verifier`

A producer may influence section summaries through source evidence.
A producer may not require a different section model through source-specific logic.

### Status invariants

Allowed shared statuses remain invariant:
- `present`
- `missing`
- `valid`
- `invalid`
- `pending`
- `anchored`
- `verified`
- `mismatch`
- `unknown`

## 9. Producer-owned semantics

The producer owns:
- workflow semantics
- task semantics
- claim / contribution semantics
- credit policy
- authorization intent
- report generation logic
- workflow-specific business meaning

ReceiptOS may present evidence about those semantics.
ReceiptOS does not become the source of truth for them.

## 10. Proof-owned semantics

The proof boundary owns:
- canonical proof packaging
- `receipt_root` derivation and comparison
- verifier-facing proof result presentation
- Merkle proof reference presentation
- anchor status presentation
- replay-manifest boundary generation
- portable Evidence Capsule and Provenance Summary output shapes

These are shared substrate concerns, not producer workflow concerns.

## 11. Forbidden leakage into shared boundary

The shared proof boundary must not require or compute producer-specific business logic.

The proof boundary must not require:
- CYPHES workflow objects
- Stealth-specific runtime internals
- any producer-specific workflow graph
- handoff-chain semantics
- settlement-layer semantics
- reputation models
- score computation
- credit aggregation across receipts

The proof boundary must not present as shared proof truth:
- inferred deserved credit
- reputation or ranking
- settlement outcome
- workflow completion claims unsupported by source evidence

Producer-specific concepts may exist in source evidence.
They must not become required shared proof fields.

## 12. Failure / mismatch cases

The contract must hold even when source evidence is incomplete or inconsistent.

Expected v0 failure classes include:
- missing `receipt_root`
- recomputed root mismatch
- invalid or missing local Merkle proof
- missing anchor
- missing replay-manifest inputs
- producer workflow inconsistencies reflected only as source evidence

ReceiptOS behavior in these cases is:
- preserve stored proof fields
- expose mismatches explicitly
- expose missing proof material explicitly
- avoid repairing producer workflow semantics
- keep derived warnings and risk flags interpretive

A missing anchor does not by itself imply failed proof validity.
A root mismatch does imply proof mismatch according to current verifier semantics.

## 13. Examples

Current producer shapes already covered in the repository include:

1. Stealth / handoff evidence
2. CYPHES-like workflow evidence
3. generic agent / tool-run evidence

These producer shapes differ in source semantics, but all reduce into the same stable shared proof boundary.

That is the core proof of the contract.

## 14. Non-goals

This contract does **not**:
- define a new portable evidence schema
- change the verifier
- change `receipt_root` derivation
- change canonicalization
- define workflow-chain semantics
- define settlement semantics
- define reputation semantics
- define a producer runtime SDK
- define on-chain expansion beyond the current proof surface

## 15. Open questions

1. What is the minimum source field set that should be documented as a producer-facing reference shape rather than only inferred from fixtures?
2. Should a small producer adapter template be added later, once the contract text stabilizes?
3. At what point do boundary invariants become large enough to justify their own separate `PROOF_BOUNDARY_INVARIANTS_V0.md` document?
4. What future producer classes should be added beyond the current three shapes to stress-test the contract further?
