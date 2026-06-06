# Share and Scan Model

Crystal Receipt can later be shared as a PNG or SVG receipt card.

In that model, the crystal is the human-facing visual fingerprint.
A QR or deep-link marker can be added later for machine scanning.

Scanning should open one of the following:

- metadata
- a receipt reference
- a verifier page

The scanned image or QR is not the verifier by itself.
Verification still comes from receipt evidence, hashes, signatures, `eventRoot`, and verifier logic.

## Purpose

The share-and-scan layer is about portability and usability.
It gives people something simple to send, post, preview, or archive without confusing the card with the underlying proof.

The design goal is:

- humans see a recognizable crystal receipt card
- machines get a stable pointer into metadata or verification
- verification remains separate from the card image itself

## Future card components

A future shareable receipt card can include:

- crystal visual
- receipt id
- `canonical_receipt_hash`
- artifact hash
- verifier result
- QR/deep link
- short boundary text: `Visual artifact, not verifier`

## Card roles

### Crystal visual
The human-facing fingerprint layer.
This is the recognizable artifact people associate with the receipt.

### Receipt id
A short human-readable identifier for reference, sharing, or lookup.

### `canonical_receipt_hash`
The main deterministic receipt-derived identity anchor for reproducibility.

### Artifact hash
A stable hash for the generated image or card payload so shared artifacts can be compared or rechecked.

### Verifier result
A compact summary of current verifier state, presented as status information rather than proof by itself.

### QR / deep link
A machine-readable pointer that opens richer metadata, a receipt reference, or a verifier page.

### Boundary text
The card should visibly state its limit:

> Visual artifact, not verifier

That makes the trust boundary explicit even when the card is shared outside the original system context.

## Future share flow

```text
Receipt evidence
-> Crystal artifact
-> Receipt card
-> User shares card
-> Receiver scans QR/deep link
-> Metadata/verifier opens
-> Receipt evidence can be independently checked
```

## Scanning model

The QR or deep-link target can later resolve to:

- a metadata document
- a receipt reference record
- a verifier page
- a local or hosted verification view

The important rule is that scanning opens a path to verification.
Scanning is not itself verification.

## Verification boundary

The card image does not prove the work.
The QR does not prove the work.
The deep link does not prove the work.

They are all pointer or presentation layers.

Actual verification still comes from:

- receipt evidence
- canonical hashes
- signatures / trust data
- `eventRoot`
- verifier logic
- policy checks

## Why this model fits Crystal Receipt

Crystal Receipt already separates visible artifact from verifier truth.
A shareable card keeps that same architecture intact.

That means:

- the crystal stays human-facing
- the QR/deep link stays machine-facing
- the verifier stays the source of truth

## Current boundary

This is a docs-only future model.
It does not add export code, QR generation, deep-link generation, verifier hosting, or scan behavior yet.
