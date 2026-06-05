# crystal-receipt

A tiny proof-of-concept for turning receipt evidence into a deterministic crystal-like visual artifact.

## Framing

Crystal Receipt is not meant to be "just hash-based generative art." The stronger long-term direction is:

```text
Receipt -> Evidence -> Hash/EventRoot -> Crystal -> NFT metadata -> optional mint
```

The current MVP stays intentionally simple:
- `receiptHash -> deterministic seed -> crystal`

But the project is framed as a **visual artifact for execution receipts**, not a standalone artwork generator.

## Core ideas

- the **same receipt evidence** should produce the **same crystal**
- **different receipt evidence** should produce a **different crystal**
- over time, receipt-derived fields should influence:
  - shape
  - color
  - symmetry
  - growth layers
  - traits
- the crystal is a **visual fingerprint**, **not** the security verifier itself
- NFT / minting is an **optional future layer**, not the core product

## MVP behavior today

Given a `receiptHash` string, the current generator:

1. hashes it with SHA-256
2. derives a deterministic numeric seed
3. generates a crystal-inspired 2D SVG composition
4. writes:
   - `crystal.svg`
   - `crystal.metadata.json`

This keeps the first version local, deterministic, and easy to test.

## CLI

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

Example:

```bash
python generate.py --hash demo-receipt-hash-001 --out examples/demo
```

## Output

### `crystal.svg`
A deterministic crystal-like visual artifact.

### `crystal.metadata.json`
The current MVP metadata contains:
- original `receiptHash`
- `sha256`
- numeric `seed`
- canvas size
- palette
- crystal parameter summary

A future v0.2 can evolve this into receipt-derived metadata while keeping deterministic generation.

## v0.2 direction

Planned next-step architecture/docs direction:
- receipt-derived input fields
- composed seeds (`master_seed`, `shape_seed`, `palette_seed`, etc.)
- visual traits mapped from receipt evidence
- optional NFT metadata preview layer

See:
- `docs/RECEIPT_DERIVATION.md`
- `docs/METADATA_SCHEMA_V0_2.md`
- `docs/ROADMAP.md`

## Notes

- No blockchain yet
- No NFT minting code yet
- No Stealth integration yet
- No external paid APIs
- Minimal dependencies: Python standard library only

## Tests

```bash
python -m unittest discover -s tests -p "test_*.py"
```
