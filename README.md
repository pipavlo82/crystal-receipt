# crystal-receipt

A tiny proof-of-concept for turning a receipt hash into a deterministic crystal-like visual fingerprint.

## Idea

- `receipt hash -> deterministic seed`
- the **same hash** always produces the **same visual crystal**
- a **different hash** produces a **different visual crystal**
- this is a **visual receipt fingerprint**, **not** a security verifier

## What it does

Given a `receiptHash` string, the generator:

1. hashes it with SHA-256
2. derives a deterministic numeric seed
3. generates a crystal-inspired 2D SVG composition
4. writes:
   - `crystal.svg`
   - `crystal.metadata.json`

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
A deterministic crystal-like visual.

### `crystal.metadata.json`
Contains:
- original `receiptHash`
- `sha256`
- numeric `seed`
- canvas size
- palette
- crystal parameter summary

## Notes

- No blockchain
- No NFT logic
- No Stealth integration yet
- No external paid APIs
- Minimal dependencies: Python standard library only

## Tests

```bash
python -m unittest discover -s tests -p "test_*.py"
```
