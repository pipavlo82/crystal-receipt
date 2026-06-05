# Proposed `crystal.metadata.json` Schema v0.2

This is a docs-first proposal for a richer metadata shape.
It does **not** change the current MVP generator yet.

## Design goals

- preserve deterministic generation
- reference receipt/evidence provenance clearly
- separate derived seeds from visual traits
- support a future optional NFT metadata export layer
- avoid pretending that the crystal itself is the verifier

## Proposed shape

```json
{
  "version": "0.2",
  "source_receipt": {
    "session_id": "sess_123",
    "receiptHash": "...",
    "diffHash": "...",
    "eventRoot": "...",
    "agent_id": "agent-1",
    "scope": {
      "authority": "...",
      "permission": "..."
    },
    "changed_files": ["src/app.ts", "README.md"],
    "timestamp": "2026-06-04T20:00:00Z",
    "verifier_result": {
      "status": "OK",
      "reason_code": "OK"
    },
    "trust_block": {
      "algorithm": "demo-hmac",
      "key_id": "key-1",
      "signer_id": "agent-1",
      "trust_mode": "signature_extension"
    }
  },
  "derived_seeds": {
    "master_seed": "...",
    "shape_seed": "...",
    "palette_seed": "...",
    "symmetry_seed": "...",
    "layer_seed": "...",
    "oxide_seed": "...",
    "trait_seed": "..."
  },
  "visual_traits": {
    "geometry_style": "stepped",
    "palette_name": "oxide_rainbow",
    "symmetry": "high",
    "layer_count": 11,
    "shard_count": 28,
    "oxide_intensity": 0.7421,
    "edge_bias": 0.3815,
    "rarity": "uncommon"
  },
  "provenance": {
    "generator": "crystal-receipt",
    "generator_version": "0.2-draft",
    "derivation_mode": "receipt-derived",
    "visual_role": "receipt-fingerprint",
    "security_note": "Visual artifact only; not the verifier itself."
  },
  "nft_metadata_preview": {
    "name": "Crystal Receipt #sess_123",
    "description": "A deterministic visual artifact derived from execution receipt evidence.",
    "attributes": [
      { "trait_type": "Geometry Style", "value": "stepped" },
      { "trait_type": "Palette", "value": "oxide_rainbow" },
      { "trait_type": "Layer Count", "value": 11 },
      { "trait_type": "Rarity", "value": "uncommon" }
    ]
  }
}
```

## Field groups

### `source_receipt`
The receipt/evidence identity layer.
This anchors the crystal back to real execution evidence.

### `derived_seeds`
Split deterministic seeds for visual systems.
This keeps generation structured and extensible.

### `visual_traits`
Human-readable traits extracted from deterministic derivation.
These traits should be deterministic, reproducible, and suitable for future SVG shaping.
They are not verifier conclusions.

### `provenance`
Clarifies generator version, mode, and the fact that the crystal is not a verifier.

### `nft_metadata_preview`
Optional future-facing shape only.
This is a preview/export concept, not minting logic.

## Notes

- v0.2 should remain deterministic
- CLI behavior can stay hash-based until receipt-input mode is added
- NFT metadata remains optional and downstream
- no blockchain assumptions are required for this schema
