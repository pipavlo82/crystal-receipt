# Receipt Fixture v0

## Purpose

This fixture is a planning artifact for future receipt-derived crystal generation.

It is meant to help shape the next stage of the project:

```text
receipt.json -> canonicalized receipt evidence -> derived seeds -> crystal.svg + crystal.metadata.json
```

## Important boundaries

This fixture is **not**:
- a Stealth integration
- a verifier
- a live receipt pipeline
- a blockchain/NFT implementation

It is only:
- a local example input shape
- a schema-thinking aid
- a docs-first bridge toward future `--receipt` support

## Current MVP remains unchanged

The current generator still uses hash-only input:

```bash
python generate.py --hash <receiptHash> --out examples/demo
```

No `--receipt` mode is implemented yet.

## Fixture contents

Example path:

```text
examples/receipt-demo/receipt.json
```

The fixture includes realistic but fake/local fields such as:
- `session_id`
- `receiptHash`
- `diffHash`
- `eventRoot`
- `agent_id`
- `scope`
- `authority`
- `changed_files`
- `timestamp`
- `verifier_result`
- `signature_trust_block`

## Canonicalization note

Canonicalization is a preparation step for future `--receipt` mode.

A helper like `canonical_receipt_hash(receipt)` is **not** a verifier result.
It is only a deterministic digest of the local receipt fixture / evidence object.

Its purpose is to support a stable derivation flow from receipt evidence into seeds and traits.

## Why this exists

The long-term goal is to make crystal generation come from receipt evidence rather than from a single abstract hash.

That enables a future visual mapping model where:
- receipt identity influences geometry
- authority/scope influences shell/boundary
- verifier/trust influences clarity/glow
- changed files influence growth steps and shard structure

## Near-term intended flow

### Today
- `receiptHash -> seed -> crystal`

### Later
- `receipt.json -> canonicalized evidence -> master/sub-seeds -> visual traits -> crystal outputs`

## Non-goals

This fixture does not introduce:
- NFT minting
- blockchain storage
- wallet integration
- Stealth wiring
- external API usage
