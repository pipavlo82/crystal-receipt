# ReceiptOS Integration Manifest v0

Status: Draft v0
Scope: Producer-neutral ReceiptOS ingestion contract

## 1. Purpose

ReceiptOS accepts producer-neutral evidence.

The current portable envelope identifier is:

```text
stealth.session.evidence.v1
```

This identifier is historical/current envelope naming, not a Stealth-only trust boundary.
It identifies the portable evidence shape ReceiptOS can ingest today.
It does not mean ReceiptOS trusts a producer because that producer uses Stealth branding or Stealth-shaped fields.

## 1.1 Current producer coverage

The current repository already routes multiple producer shapes into the same ReceiptOS proof boundary.

Current documented producer set:

- Stealth handoff
- GitHub Actions
- Claude Code session
- Cursor session
- Codex session
- generic producer
- `external.coding_run.v0`

Core message:

```text
Same proof pipeline.
Different producers.
One portable receipt model.
```

These producers may differ substantially in workflow semantics, runtime context, and source metadata.
ReceiptOS does not give them separate proof rules.
It ingests their evidence into the same portable proof-facing boundary.

## 2. Producer responsibilities

An external producer must:

- provide evidence using the supported envelope shape
- identify producer/runtime through fields such as `agent.runtime`, `metadata.generated_by`, and other source metadata
- include enough evidence for replay, verification, or later inspection where applicable
- treat producer identity as descriptive metadata, not as proof
- avoid assuming ReceiptOS will trust producer branding, naming, or self-asserted status

In practice, a producer should make it possible for a downstream verifier to answer:

- what ran
- where it ran
- what changed
- what evidence exists
- what can be replayed or independently checked

## 3. ReceiptOS responsibilities

ReceiptOS is responsible for:

- canonicalizing evidence according to the existing ReceiptOS canonicalization rules
- computing `receipt_root`
- ignoring the top-level `anchor` field during receipt root computation
- verifying evidence and proof material according to ReceiptOS rules
- preserving the current provenance summary and evidence capsule output shapes

ReceiptOS does not change its trust model based on producer naming.
ReceiptOS consumes evidence, computes roots, verifies proofs, and emits portable verification-oriented outputs.

## 4. Root invariants

The following invariants define `receipt_root` behavior:

- `receipt_root` is deterministic for the same canonical evidence body
- object key order must not affect the root
- the top-level `anchor` field must not affect the root
- hashing/formatting remains SHA-256 with `0x`-prefixed hex output
- fixtures should remain stable unless they are intentionally migrated

The anchor-independence rule is critical:

```text
receipt_root must never depend on its own anchored value
```

This means ReceiptOS root computation must strip or ignore the top-level `anchor` object internally rather than relying on every caller to remember to do so first.

## 5. Trust model

ReceiptOS gates and verifies; it does not trust producer names.

The trust model is:

- producer identity is metadata, not proof
- evidence, proof material, and replayability determine confidence
- a producer label may help with provenance, but it is not itself a verification result
- ReceiptOS should remain producer-neutral at the ingestion boundary

Confidence comes from recomputation and verification, not branding.

## 6. Minimal integration checklist

A minimal producer-neutral ReceiptOS integration should:

1. generate producer output
2. normalize or import it into the supported portable envelope
3. compute the receipt root
4. verify the receipt root and any attached proof material
5. produce capsule and provenance summary outputs
6. test anchor-independent root behavior

A healthy integration should therefore confirm both:

- normal root computation succeeds for anchor-less evidence
- root computation remains unchanged when the same evidence is given a synthetic top-level anchor

## 7. GitHub Actions export-time conclusion semantics

For the current `github.actions_run.v0` export flow, the source artifact is generated mid-workflow.
Its `conclusion` field therefore reflects the workflow state at export time, not necessarily the final GitHub Actions workflow or job outcome shown in the GitHub UI.
The GitHub Actions UI remains the source of truth for final workflow/job conclusion.
Final-job-conclusion reconciliation via a second job and GitHub API access is intentionally deferred.

## 8. Non-goals

This document does not:

- introduce a new schema
- change canonicalization behavior
- change hashing or formatting
- change CLI output shape
- change evidence capsule output shape
- redefine producer-specific trust semantics beyond the existing ReceiptOS verification model

## 9. Summary

ReceiptOS ingests producer-neutral evidence through a portable envelope.
It computes and verifies roots deterministically.
It ignores the top-level anchor during root computation.
It preserves verification-oriented outputs.
And it treats producer identity as provenance metadata rather than proof.

Across Stealth handoff, GitHub Actions, Claude Code, Cursor, Codex, generic producer imports, and `external.coding_run.v0`, the architecture stays the same:

- same proof pipeline
- different producers
- one portable receipt model
