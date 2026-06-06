# crystal-receipt

Crystal Receipt turns verifiable execution receipts into deterministic bismuth-inspired visual artifacts.

**Stronger framing:** Crystal Receipt is a deterministic visual fingerprint layer for execution receipts: receipt evidence becomes a reproducible crystal artifact, with optional NFT export later.

## What this is

Crystal Receipt is an experiment in turning execution receipts into deterministic visual artifacts.

Every meaningful execution receipt contains evidence of a specific action: what session it belonged to, what changed, what hash was produced, what event root was recorded, what agent performed the action, what authority/scope existed, what verifier result was produced, and what signature/trust data was attached.

Crystal Receipt takes that receipt evidence and turns it into a unique visual fingerprint inspired by bismuth crystal growth.

The goal is **not** to replace cryptographic verification.
The goal is to make receipt evidence visible, recognizable, portable, and human-readable as a visual artifact.

## Core flow

```text
Receipt
-> Evidence
-> Verifier
-> Canonical Hash / EventRoot
-> Derived Seeds
-> Crystal Artifact
-> Metadata
-> Optional NFT Export
```

The crystal is the visible artifact.
The verifier remains the source of truth.

## How it works

A receipt contains structured evidence, for example:

- `session_id`
- `receiptHash`
- `diffHash`
- `eventRoot`
- `agent_id`
- `scope / authority`
- `changed files`
- `timestamp`
- `verifier result`
- `signature / trust block`

This data is first canonicalized into a deterministic JSON representation.
From that canonical receipt object, Crystal Receipt derives a canonical receipt hash.
Then it derives named deterministic seeds:

- `master_seed`
- `shape_seed`
- `palette_seed`
- `symmetry_seed`
- `layer_seed`
- `oxide_seed`
- `trait_seed`

Those seeds control the crystal generation.

The same receipt evidence always produces the same crystal.
Different receipt evidence produces a different crystal: different shape, colors, layers, symmetry, oxide effect, fracture pattern, shard count, and traits.

## Deterministic visual identity rule

```text
same receipt.json -> same crystal
changed receipt.json -> different crystal
```

That means:
- the same receipt evidence always reproduces the same crystal
- changed receipt evidence should change the resulting crystal identity
- uniqueness comes from receipt evidence, not random generation
- the crystal can be regenerated on another machine from the same receipt evidence and ruleset

## Why bismuth crystals?

Bismuth crystals are a good metaphor because they are structured but unique.
They do not grow as pure random noise. They grow according to physical rules, but small differences in the environment produce different final forms.

Crystal Receipt uses the same idea digitally:

```text
same rules
+ deterministic receipt evidence
= unique reproducible visual form
```

So the crystal is not just generative art.
It is a visual receipt fingerprint.

The renderer is bismuth-inspired, not a physical simulation.
Its visual identity remains deterministic and reproducible from the same receipt evidence.

## What the crystal represents

The crystal represents the identity and structure of a specific execution receipt.

For example:

- receipt identity can influence core geometry
- authority/scope can influence the outer shell or boundary
- verifier/trust data can influence clarity, glow, or seal-like accents
- changed files can influence shard count or growth steps
- diffHash/eventRoot can influence fracture and growth patterns
- timestamp/session data can influence layer ordering or symmetry

This makes the artifact not only unique, but semantically connected to the receipt.

## Important security boundary

The crystal is not the security verifier.
It does not replace:

- signature verification
- hash checks
- replay protection
- eventRoot validation
- policy checks
- scope/authority checks
- trust-chain verification

The crystal is a visual artifact derived from receipt evidence.
The actual truth of the receipt must still be checked by an independent verifier.

**Correct statement:**

> The crystal does not prove the work by itself.  
> The crystal represents receipt evidence that can be independently verified.

## NFT boundary

If the crystal is later exported as an NFT, the NFT is also not the verifier by itself.

The NFT layer is useful for:
- portability
- public display
- provenance
- ownership
- discovery
- artifact history
- certificate-like presentation

The NFT can store or reference:

- `receiptHash`
- `eventRoot`
- `diffHash`
- `verifier result`
- `verifier version`
- `crystal image hash`
- `crystal metadata hash`
- `provenance fields`
- optional receipt reference

But the NFT itself does not automatically prove the work.

**Correct statement:**

> The NFT does not prove the work by itself.  
> The NFT represents a receipt whose evidence can be independently verified.

## What this is not

Crystal Receipt is not:

- a blockchain verifier
- an NFT marketplace
- a replacement for ReceiptOS verification
- a replacement for Stealth receipt checks
- a trust oracle
- a security proof by image
- "AI art with metadata"

It is a deterministic visual grammar for receipt evidence.

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

## Future direction

Future optional layer:

```text
crystal artifact
-> NFT metadata export
-> optional minting later
```

## Product meaning

Crystal Receipt turns invisible execution evidence into a visible artifact.

For agentic systems, this matters because future agents will perform actions, call tools, change files, spend money, deploy code, trade, sign messages, or make decisions.
Those actions need receipts.
But raw receipts are hard for humans to understand.

Crystal Receipt gives each receipt a visual form.

A human can see:
- "This action produced this crystal."

A system can verify:
- "This crystal came from this receipt evidence."

A verifier can check:
- "This receipt evidence is valid or invalid."

That separation is the key:

- verifier checks truth
- receipt stores evidence
- crystal makes it visible
- optional NFT makes it portable

## Notes

- No blockchain yet
- No NFT minting code yet
- No Stealth integration yet
- No external paid APIs
- Minimal dependencies: Python standard library only

## Related docs

- `docs/RECEIPT_DERIVATION.md`
- `docs/METADATA_SCHEMA_V0_2.md`
- `docs/ROADMAP.md`

## Tests

```bash
python -m unittest discover -s tests -p "test_*.py"
```
