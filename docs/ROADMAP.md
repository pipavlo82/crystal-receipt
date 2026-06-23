# Roadmap

## Product architecture direction

The intended long-term architecture is:

```text
Agent execution
-> portable evidence
-> receipt_root
-> verifier result
-> Evidence Capsule
-> provenance artifact
-> optional visual / export layer
```

This project is therefore aimed first at **portable execution provenance artifacts**.
Receipt-derived deterministic visual artifacts remain part of the project, but as an optional presentation layer on top of the provenance substrate, not as the primary deliverable.

See `docs/EXECUTION_PROVENANCE_FRAMING.md` and `docs/EVIDENCE_CAPSULE_MODEL_V0.md` for the substrate-level framing this roadmap follows.

## Provenance substrate track

This is the primary track. It covers the portable ReceiptOS-aligned proof core (`src/receiptos`), the Evidence Capsule model, and producer-neutral adapters.

### Already in place

- schema-valid receipts
- canonicalization
- receipt root recomputation
- verifier result
- local Merkle proof helpers
- anchor state / proof refs
- Evidence Capsule view-models (`evidence-capsule.v0`)
- replay summary / manifest fields
- invariant validation (`scripts/evidence-capsule-invariants.ts`)
- browser-inspectable proof view
- producer-adapter boundary spec for Stealth (`docs/STEALTH_EVIDENCE_CAPSULE_ADAPTER_V0.md`)

### Next steps

- stabilize `evidence-capsule.v0` schema and naming conventions
- implement the first external producer adapter (Stealth) per the adapter boundary spec
- handoff chain summaries between agent sessions
- provenance graph experiments (receipts referencing receipts) — sandboxed, no schema commitments until field shapes are stable
- import/export between execution systems and proof viewers
- hold schema/field changes pending clarity on ERC-8275 and BeTrueCore field requirements

## Visual / export track

This track is secondary. It produces an optional, deterministic visual presentation layer on top of the provenance substrate above. Nothing here changes receipt root semantics or verifier behavior.

### MVP

- [x] deterministic seed from receipt hash
- [x] crystal-like SVG generator
- [x] metadata JSON output
- [x] CLI entrypoint
- [x] example output
- [x] determinism tests

Current visual scope remains deliberately secondary:
- hash mode remains supported for deterministic baseline examples
- receipt mode is implemented for receipt-derived visual identity
- visual output remains downstream from receipt evidence and proof semantics

### v0.2 direction

#### Receipt-derived generation
- derive crystal structure from richer receipt evidence, not only a single hash
- preserve determinism for the same receipt evidence bundle
- keep the crystal as a visual fingerprint, not as the verifier itself

#### Proposed flow
- input receipt/evidence fields
- derive a master seed and sub-seeds
- map evidence categories into visual traits
- emit richer metadata with provenance and optional export-preview fields

#### Planned CLI evolution
Hash mode remains supported:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

Receipt mode is now implemented:

```bash
python generate.py --receipt path/to/receipt.json --out examples/receipt-demo
```

### Next small planning steps

#### v0.2a
- add a receipt fixture and schema notes
- document receipt-derived input planning without changing the generator

#### v0.2b
- add `--receipt path/to/receipt.json` mode later
- canonicalize receipt evidence before seed derivation
- **implemented**

#### v0.2c
- add deterministic visual identity tests
- prove same receipt-derived input gives the same seeds/traits
- prove modified receipt-derived input gives different seeds/traits
- require future `--receipt` generation to preserve same/different visual identity behavior

#### v0.3
- map receipt fields into visual traits and crystal structure
- keep deterministic output for the same receipt evidence bundle

#### Future optional layers
- export metadata (e.g. NFT-style metadata) as one possible export target
- no minting by default

#### v0.4
- shareable receipt card

#### v0.5
- QR/deep-link export

#### v0.6
- scan-to-verify flow

### Next possible steps

#### Better visuals
- richer palettes
- more crystal growth rules
- layered lighting/shadow effects
- optional PNG export

#### Stronger metadata
- shape/version fields
- generator version pinning
- compact visual summary fields
- receipt-derived provenance
- visual trait schema

#### Receipt-aware derivation
- receipt identity -> core geometry
- authority/scope -> outer shell / boundary
- verifier/trust -> clarity / glow / seal accents
- changeset -> growth steps / shard count
- diff/eventRoot -> fracture/growth pattern

#### Product integration
- optional embedding into receipt viewers
- side-by-side receipt + crystal display
- receipt gallery / explorer concepts

#### Optional future layers
- export metadata formats (NFT-style metadata is one option among others)
- optional mint pipeline, if ever pursued, stays outside this repo's core scope

## Explicit non-goals

These apply to the project as a whole, not only the visual track:

- settlement
- reputation
- scoring
- trusted-producer claims
- UI-only receipt display in place of verification

The verifier remains the truth source; nothing in either track should change that.

Visual/export-specific non-goals for now:

- NFT minting code
- marketplaces
- blockchain storage
- wallet integration
- token gating
- paid external APIs
- direct Stealth integration into Crystal Receipt runtime flows (the adapter spec is documented, not yet implemented)
