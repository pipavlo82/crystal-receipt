# Receipt Derivation v0.2

## Goal

Move Crystal Receipt from a simple `receiptHash -> crystal` proof-of-concept toward a stronger model:

```text
Receipt -> Evidence -> Hash/EventRoot -> Crystal -> NFT metadata -> optional mint
```

This does **not** mean adding NFT minting now. It means designing the crystal as a deterministic visual artifact of executed work.

## Input layer

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

Not every field needs to be required in v0.2, but this is the intended semantic input space.

## Derivation layer

Instead of a single flat seed, use a composed seed model:

- `master_seed`
- `shape_seed`
- `palette_seed`
- `symmetry_seed`
- `layer_seed`
- `oxide_seed`
- `trait_seed`

### Suggested approach

1. canonicalize the selected receipt evidence fields
2. derive a stable root digest
3. split that digest into sub-seeds for different visual systems
4. keep all mapping deterministic and versioned

This allows the crystal to be both:
- deterministic
- semantically tied to different kinds of receipt evidence

## Canonical hash -> seed material

A future receipt-aware flow can use:
- `canonical_receipt_hash(receipt)` as the deterministic digest of the canonicalized evidence object
- `derive_seed_material(canonical_hash)` as the next derivation step

In that model:
- `master_seed` is the root deterministic seed
- named sub-seeds keep visual axes independent
- canonical hashing and seed derivation are still **not** verification

This is only preparation for stable mapping from receipt fields into visual traits.

## Visual mapping

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

## Honesty principle

The visual artifact should communicate receipt-derived structure, but it should not pretend to be a verifier.

The verifier remains separate.
The crystal remains:
- deterministic
- human-facing
- receipt-derived
- provenance-friendly

## CLI evolution

Current CLI remains unchanged:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

A later v0.2 can add a receipt-aware mode:

```bash
python generate.py --receipt path/to/receipt.json --out examples/receipt-demo
```

## Out of scope for v0.2

- NFT minting code
- blockchain integration
- direct Stealth integration
- marketplace flows
