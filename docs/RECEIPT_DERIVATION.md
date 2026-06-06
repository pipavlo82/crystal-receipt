# Receipt Derivation v0.2

## Goal

Crystal Receipt is about turning execution receipts into deterministic visual artifacts.

The target architecture is:

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

This does **not** mean replacing verification with visuals.
It means deriving a reproducible, human-readable artifact from receipt evidence while leaving cryptographic truth to independent verifiers.

## Receipt evidence

A future receipt-derived version can accept fields such as:

- `session_id`
- `receiptHash`
- `diffHash`
- `eventRoot`
- `agent id`
- `scope / authority`
- `changed files`
- `timestamp`
- `verifier result`
- `signature / trust block`

Not every field needs to be required at first, but this is the intended semantic input space.

## Canonicalized receipt data

Receipt evidence should first be turned into a deterministic JSON representation.
That canonical representation is the stable basis for downstream derivation.

From that canonical receipt object, the system can derive:

- a `canonical_receipt_hash(receipt)` digest
- root and named sub-seeds
- deterministic visual traits
- eventually, crystal geometry and metadata

## Deterministic visual identity rule

Crystal Receipt must preserve a strict visual identity rule:

```text
same receipt.json -> same crystal
changed receipt.json -> different crystal
```

That means:
- the same receipt evidence must always produce the same crystal
- different receipt evidence must produce a different visual crystal identity
- uniqueness comes from receipt evidence, not from random generation
- generation must be deterministic and reproducible across machines
- the same `receipt.json` tomorrow must regenerate the same SVG and metadata

If fields such as:
- `receiptHash`
- `diffHash`
- `eventRoot`
- `agent_id`
- `scope`
- `changed_files`
- `timestamp`
- `verifier_result`
- `signature_trust_block`

change, then:
- `canonical_receipt_hash` should change
- derived seed material should change
- visual traits should change
- and the future crystal output should change

This rule is the core identity guarantee for receipt-derived generation.

## Canonical hash -> seed material

A future receipt-aware flow can use:

- `canonical_receipt_hash(receipt)` as the deterministic digest of the canonicalized evidence object
- `derive_seed_material(canonical_hash)` as the next derivation step

In that model:

- `master_seed` is the root deterministic seed
- named sub-seeds keep visual axes independent
- canonical hashing and seed derivation are still **not** verification

This is only preparation for stable mapping from receipt fields into visual traits.

## Seed material -> visual traits

A future generator can map seed material into reproducible visual traits.

That means:

- the same seed material always yields the same `visual_traits`
- different seed material will usually change at least some trait values
- visual traits remain deterministic and reproducible
- visual traits are still **not** verifier conclusions

This is the layer that can later shape SVG output in a stable, explainable way.

## What the crystal can represent

The crystal should not be arbitrary decoration. It should be semantically tied to receipt structure.

For example:

### Receipt identity -> core geometry
Fields like `receiptHash`, `session_id`, and `eventRoot` can drive:

- base crystal silhouette
- shard layout
- primary crystal axis
- fracture pattern family

### Authority / scope -> outer shell / boundary
Fields like `scope` and authority data can drive:

- perimeter shell
- containment ring
- shell thickness
- boundary ornamentation

### Verifier / trust -> clarity / glow / seal accents
Fields like verifier result and trust/signature blocks can drive:

- clarity level
- glow behavior
- seal-like accents
- inner highlight treatment

### Changeset -> growth steps / shard count
Fields like `changed files` and change intensity can drive:

- number of layers
- stepped growth bands
- shard density
- local branching complexity

### Diff / eventRoot -> fracture / growth pattern
Fields like `diffHash` and `eventRoot` can drive:

- fracture orientation
- directional growth
- asymmetry pattern
- ridge repetition

### Timestamp / session structure -> ordering and symmetry
Fields like timestamps or other session-structure signals can influence:

- layer ordering
- offset patterns
- symmetry class
- growth cadence

## Why this is useful

Bismuth crystal growth is a good metaphor because it is structured but unique.
A crystal does not emerge as pure random noise; it emerges from rules plus conditions.

Crystal Receipt uses the same principle digitally:

- same derivation rules
- same receipt evidence
- same resulting crystal

Different receipt evidence yields a different but still reproducible crystal.
The renderer is bismuth-inspired, not a physical simulation, and the crystal remains a visual artifact rather than a verifier.

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
The truth of the receipt must still be checked by an independent verifier.

**Correct statement:**

> The crystal does not prove the work by itself.  
> The crystal represents receipt evidence that can be independently verified.

## NFT / export boundary

If the crystal is later exported as an NFT or another portable wrapper, that wrapper is also not the verifier by itself.

It may store or reference:

- `receiptHash`
- `eventRoot`
- `diffHash`
- `verifier result`
- `verifier version`
- `crystal image hash`
- `crystal metadata hash`
- provenance fields
- optional receipt reference

The optional NFT/export layer is useful for:

- portability
- public display
- provenance
- ownership
- discovery
- artifact history
- certificate-like presentation

But the wrapper itself does not automatically prove the work.

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

## Current CLI boundary

Current CLI remains unchanged:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

A later v0.2 can add a receipt-aware mode:

```bash
python generate.py --receipt path/to/receipt.json --out examples/receipt-demo
```

## Out of scope for now

- NFT minting code
- blockchain integration
- direct Stealth integration
- marketplace flows
