# Roadmap

## Product architecture direction

The intended long-term architecture is:

```text
Receipt -> Evidence -> Hash/EventRoot -> Crystal -> NFT metadata -> optional mint
```

This project is therefore aimed at **receipt-derived deterministic visual artifacts**, not just generic hash art.

## MVP

- [x] deterministic seed from receipt hash
- [x] crystal-like SVG generator
- [x] metadata JSON output
- [x] CLI entrypoint
- [x] example output
- [x] determinism tests

Current scope remains deliberately simple:
- one `receiptHash` in
- one deterministic crystal out

## v0.2 direction

### Receipt-derived generation
- derive crystal structure from richer receipt evidence, not only a single hash
- preserve determinism for the same receipt evidence bundle
- keep the crystal as a visual fingerprint, not as the verifier itself

### Proposed flow
- input receipt/evidence fields
- derive a master seed and sub-seeds
- map evidence categories into visual traits
- emit richer metadata with provenance and optional NFT-preview fields

### Planned CLI evolution
Current CLI stays unchanged:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

A later v0.2 may add:

```bash
python generate.py --receipt path/to/receipt.json --out examples/receipt-demo
```

## Next small planning steps

### v0.2a
- add a receipt fixture and schema notes
- document receipt-derived input planning without changing the generator

### v0.2b
- add `--receipt path/to/receipt.json` mode later
- canonicalize receipt evidence before seed derivation

### v0.3
- map receipt fields into visual traits and crystal structure
- keep deterministic output for the same receipt evidence bundle

### Future optional layers
- NFT metadata export
- no minting by default

## Next possible steps

### Better visuals
- richer palettes
- more crystal growth rules
- layered lighting/shadow effects
- optional PNG export

### Stronger metadata
- shape/version fields
- generator version pinning
- compact visual summary fields
- receipt-derived provenance
- visual trait schema

### Receipt-aware derivation
- receipt identity -> core geometry
- authority/scope -> outer shell / boundary
- verifier/trust -> clarity / glow / seal accents
- changeset -> growth steps / shard count
- diff/eventRoot -> fracture/growth pattern

### Product integration
- optional embedding into receipt viewers
- side-by-side receipt + crystal display
- receipt gallery / explorer concepts

## Explicit non-goals for now

- NFT minting code
- marketplaces
- blockchain storage
- wallet integration
- token gating
- paid external APIs
- direct Stealth integration
