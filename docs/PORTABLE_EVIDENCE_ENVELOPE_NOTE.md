# PORTABLE_EVIDENCE_ENVELOPE_NOTE

## Purpose

This note explains why the current ReceiptOS input envelope id remains:

- `stealth.session.evidence.v1`

and what that does **not** mean.

## Historical/current envelope id

`stealth.session.evidence.v1` remains the current historical portable evidence envelope id used by the ReceiptOS input path.

It is preserved for compatibility.

This note does **not** rename the schema and does not change any proof behavior.

## What this does not imply

The historical envelope id does **not** imply that:
- only Stealth can produce compatible evidence
- the ReceiptOS proof boundary is Stealth-only
- ReceiptOS verifies producer branding or vendor identity by name alone

The envelope id is a compatibility marker for the current input path, not the definition of the trust boundary.

## Where producer identity actually lives

In the current architecture, producer identity is carried by:
- `agent.runtime`
- `metadata.generated_by`
- source evidence and upstream system context

That is where a producer distinguishes itself from other producer systems while still targeting the same proof boundary.

`stealth.session.evidence.v1` therefore remains the historical/current portable envelope id, while root computation stays anchor-independent and producer identity remains in runtime, `generated_by`, and source metadata.

## ReceiptOS trust boundary

ReceiptOS verifies:
- evidence reduction into the current proof boundary
- `receipt_root` derivation and comparison
- verifier-facing proof state
- Merkle proof semantics
- anchor semantics

ReceiptOS does **not** treat producer naming alone as proof truth.

It verifies evidence and proof semantics, not producer branding.

## Current practical consequence

This means that:
- Stealth is one producer shape, not the only producer shape
- CYPHES-like workflow systems are another producer shape
- generic producer import now exists
- generic producer import participates in the same producer-neutral, anchor-independent `receipt_root` semantics
- future producer systems may target the same current input path

## Non-goals

This note does **not**:
- rename the current schema
- change the verifier
- change canonicalization
- change `receipt_root` behavior
- expand runtime integration
- claim that field-level CYPHES runtime mapping is implemented
