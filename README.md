# crystal-receipt

![Crystal Receipt architecture hero](docs/crystal_receipt_mobile_flow.svg)

Crystal Receipt is a portable receipt and evidence surface for agent actions.
It consumes verifiable execution evidence, preserves ReceiptOS-compatible proof semantics, and can present that evidence as an Evidence Capsule, a replayable proof summary, and optionally a deterministic visual artifact.

## What this is

Crystal Receipt is no longer just a visual experiment.
Its current direction is:

- portable execution receipts
- Evidence Capsule interpretation
- ReceiptOS-compatible verification
- receipt root recomputation
- local Merkle proof attachment and checking
- external anchor import / anchor-path support
- optional visual rendering as a secondary presentation layer

The core idea is simple:
- an agent action produces evidence
- the evidence can be verified and replayed
- the evidence can be summarized into an Evidence Capsule
- the same evidence can optionally be rendered into a deterministic crystal artifact

The goal is **not** to replace cryptographic verification.
The goal is to make execution evidence portable, inspectable, verifiable, and human-readable.

## Current product direction

Crystal Receipt now includes a portable ReceiptOS-aligned proof core in `src/receiptos`.

That proof core supports:

- portable evidence JSON
- schema-preserving receipt interpretation
- canonical `receipt_root` recomputation
- local Merkle proof helpers
- Sepolia anchor payload/result helpers
- Evidence Capsule view-models
- a non-visual capsule demo CLI

The visual renderer still exists and still works, but it is no longer the only or primary product story.
The receipt and proof layer comes first.

## Core flow

```text
Agent action
-> portable evidence
-> receipt_root
-> Merkle proof
-> anchor / proof references
-> verifier
-> Evidence Capsule
-> optional crystal surface
```

A more concrete interpretation path in the current repo is:

```text
payload
-> policy boundary
-> authorization
-> decision trace
-> execution
-> evidence record
-> receipt root
-> Merkle proof
-> anchor
-> replay manifest
-> verification
-> optional visual presentation
```

## ReceiptOS compatibility

Crystal Receipt is designed to stay compatible with ReceiptOS-style proof flows.

That means:
- evidence remains portable JSON
- receipt roots remain recomputable
- proof helpers remain deterministic
- Merkle / anchor state remains inspectable
- verification remains separate from presentation

Crystal Receipt does **not** redefine receipt truth.
It consumes receipt evidence and presents it.

## Evidence Capsule

Evidence Capsule is now a first-class concept in the repo.

The capsule is a non-breaking interpretation layer over portable receipt evidence.
It does not mutate the evidence document and it does not change receipt semantics.

The current capsule model summarizes sections such as:

- payload
- policy boundary
- authorization
- decision trace
- execution
- evidence
- counterfactual / denied-action interpretation
- result
- receipt root
- Merkle proof
- anchor
- replay manifest
- verifier

Useful starting points:
- `docs/EVIDENCE_CAPSULE_MODEL_V0.md`
- `docs/CRYSTAL_RECEIPT_MAPPING_V0.md`

## Verification, Merkle, and anchor path

A receipt contains structured execution evidence, for example:

- `session_id`
- task / prompt context
- execution records
- commands
- changed files
- `diff_sha256`
- `anchor.receipt_root`
- `anchor.merkle_root`
- `anchor.tx_hash`
- verifier-facing status fields

The portable proof flow is:

1. canonicalize receipt evidence
2. recompute `receipt_root`
3. compare against stored `anchor.receipt_root`
4. attach / verify local Merkle proof when present
5. prepare anchor payloads or import anchor results when needed
6. summarize the result as a capsule / proof surface

The verifier remains the source of truth.
The capsule and crystal layers are interpretive and presentational.

## Important security boundary

Crystal Receipt is not the security verifier.
It does not replace:

- signature verification
- hash checks
- replay protection
- policy checks
- scope / authority checks
- Merkle verification
- anchor verification
- trust-chain verification

Correct statement:

> The artifact does not prove the work by itself.  
> It represents receipt evidence that can be independently verified.

## Current CLI modes

### Hash mode

The original MVP remains available:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

This produces a deterministic crystal from a single hash input.

### Receipt mode

Receipt-derived generation is now available:

```bash
python generate.py --receipt examples/receipt-demo/receipt.json --out examples/receipt-demo
```

This loads receipt JSON, canonicalizes it, derives seeds and visual traits, and writes:
- `crystal.svg`
- `crystal.metadata.json`

### ReceiptOS Capsule Demo

A non-visual proof/capsule summary can also be generated from the portable ReceiptOS evidence fixtures:

```bash
bun scripts/receiptos-capsule-demo.ts --evidence src/receiptos/fixtures/session-evidence.with-local-merkle.sample.json --out examples/receiptos-capsule-demo/capsule-summary.json
```

Input fixture:
- `src/receiptos/fixtures/session-evidence.with-local-merkle.sample.json`

Output artifacts:
- `examples/receiptos-capsule-demo/capsule-summary.json`
- `examples/receiptos-capsule-demo/evidence-capsule.v0.json`

Schema v0:
- `schemas/evidence-capsule.v0.schema.json`
- `docs/EVIDENCE_CAPSULE_SCHEMA_V0.md`

The schema-valid `evidence-capsule.v0.json` file is proof-first and non-visual.
This demo does not change the SVG renderer and does not change receipt root semantics.

## Optional visual renderer

The crystal artifact remains relevant, but now as an optional presentation layer on top of the portable receipt/proof core.

The visual side still provides:
- deterministic rendering from stable evidence-derived inputs
- a human-facing artifact layer
- an optional certificate / collectible style surface

But the visual layer is secondary to:
- receipt evidence
- proof verification
- Merkle / anchor path
- Evidence Capsule interpretation

## Bismuth / crystal background

Earlier versions of Crystal Receipt led with the renderer and the bismuth metaphor.
That history is still relevant, but it is no longer the primary narrative.

Bismuth crystals remain a useful visual metaphor because they are structured but unique.
They grow according to rules, and small differences in conditions lead to different final forms.

Crystal Receipt uses that metaphor in a deterministic way:

```text
same evidence
+ same rules
= same artifact
```

So the crystal remains a meaningful visual fingerprint — just not the core trust layer.

## NFT boundary

If a crystal is later exported as an NFT, the NFT is also not the verifier by itself.

The NFT layer is useful for:
- portability
- public display
- provenance
- ownership
- discovery
- artifact history
- certificate-like presentation

But the NFT itself does not automatically prove the work.

Correct statement:

> The NFT does not prove the work by itself.  
> It represents a receipt whose evidence can be independently verified.

## What this is not

Crystal Receipt is not:

- a blockchain verifier
- a replacement for ReceiptOS verification
- a replacement for Stealth receipt checks
- a trust oracle
- a security proof by image
- “AI art with metadata”

It is a portable receipt/presentation layer with an optional deterministic visual grammar.

## Future direction

Future directions can still include:

```text
portable evidence
-> proof capsule
-> optional visual artifact
-> optional export / collectible layer
```

But verification remains separate and must still come from receipt evidence, hashes, proofs, anchors, and verifier logic.

## Product meaning

Crystal Receipt turns invisible execution evidence into a reusable proof surface.

For agentic systems, this matters because agents perform actions:
- call tools
- change files
- spend money
- deploy code
- trade
- sign messages
- make decisions

Those actions need receipts.
Those receipts need verification.
Those verified receipts benefit from a portable, inspectable presentation layer.

A human can see:
- “This action produced this capsule / artifact.”

A system can verify:
- “This capsule came from this receipt evidence.”

A verifier can check:
- “This receipt evidence is valid or invalid.”

That separation is the key:

- verifier checks truth
- receipt stores evidence
- capsule interprets it
- crystal can present it
- optional export can make it portable

## Notes

- No blockchain submit path here
- No NFT minting code yet
- No Stealth integration yet
- No external paid APIs
- Visual generator remains available
- Proof/capsule layer is now first-class

## Architecture overview

Crystal Receipt now spans both:
- a portable ReceiptOS-aligned proof core
- and a deterministic visual artifact layer

The proof layer handles evidence interpretation, root verification, Merkle state, anchor state, and capsule summaries.
The image remains the human-facing fingerprint.

- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/crystal_receipt_mobile_flow.svg` — mobile-friendly README hero diagram
- `docs/crystal_receipt_architecture.svg` — Detailed architecture diagram

## Related docs

- `docs/EVIDENCE_CAPSULE_MODEL_V0.md`
- `docs/CRYSTAL_RECEIPT_MAPPING_V0.md`
- `docs/RECEIPT_DERIVATION.md`
- `docs/METADATA_SCHEMA_V0_2.md`
- `docs/ROADMAP.md`

## Tests

```bash
python -m unittest discover -s tests -p "test_*.py"
bun test tests/receiptos
```
