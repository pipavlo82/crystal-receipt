# EVIDENCE_CAPSULE_SCHEMA_V0

This document defines a minimal JSON Schema for the **proof substrate** of an Evidence Capsule.

It is intentionally narrower than the current viewer/demo artifact shape.
It does **not** describe visual rendering, crystal mapping, settlement, reputation, scoring, or ATP-linked behavior.

## Purpose

The schema provides a small, modular structure that can be consumed without trusting the producer.
Each layer is independently inspectable and recomputable from receipt evidence and proof references.

The schema is for the portable proof substrate, not for the full viewer payload.

## Top-level objects

The schema requires these seven top-level proof objects:

1. `action`
2. `evidence`
3. `receipt_root`
4. `proof_refs`
5. `verifier_result`
6. `capsule`
7. `replay_manifest`

## Design constraints

This schema:
- preserves current `receipt_root` semantics
- stays modular and consumer-neutral
- avoids producer-trust assumptions
- does not require settlement fields
- does not require reputation fields
- does not require scoring fields
- does not require ATP dependencies
- does not include crystal / visual fields

## Object meanings

### `action`
A minimal summary of what was attempted or performed, with source field references.

### `evidence`
A minimal summary of execution evidence state, again with source field references and status.

### `receipt_root`
The stored root, recomputed root, and whether they match.

### `proof_refs`
References to proof-adjacent substrate such as local Merkle state and anchor state.

### `verifier_result`
The independent verifier outcome for the receipt root.

### `capsule`
The interpreted capsule sections emitted by the portable proof layer.

### `replay_manifest`
A minimal summary of replay-relevant inputs and references.

## Why this is separate from the current demo JSON

The current `examples/receiptos-capsule-demo/capsule-summary.json` file is a richer viewer-oriented artifact.
This schema intentionally narrows that richer shape into a proof-first substrate.

The validation test derives a minimal schema-conformant substrate object from the current example summary without changing production logic or generation scripts.
