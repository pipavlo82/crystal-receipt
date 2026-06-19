# EVIDENCE_CAPSULE_MODEL_V0

ReceiptOS creates the capsule. Crystal Receipt makes the capsule visible. The verifier proves the capsule is real.

## Purpose

This document defines an internal product model and a non-breaking interpretation layer over the portable ReceiptOS evidence document already present in `src/receiptos`.

This is not a public biology metaphor and not a new protocol schema. It is an internal way to interpret portable execution evidence for Crystal Receipt.

ReceiptOS is not just an audit log. In this model, each agent action becomes a verifiable execution capsule with payload, boundary, authorization, execution, evidence, root, proof, anchor, and verification stages.

It does **not** change:
- schema name
- canonicalization
- receipt root semantics
- anchor semantics
- renderer or visual layout
- ERC-8275 fields
- BeTrueCore fields

## Capsule flow

```text
payload
-> policy boundary
-> authorization/context match
-> controlled execution
-> evidence record
-> receipt root
-> Merkle proof
-> anchor
-> verification
```

## Capsule sections

The v0 capsule model summarizes evidence into these sections:

1. `payload`
2. `policy_boundary`
3. `authorization`
4. `decision_trace`
5. `execution`
6. `evidence`
7. `counterfactual`
8. `result`
9. `receipt_root`
10. `merkle`
11. `anchor`
12. `replay_manifest`
13. `verifier`

Each section exposes:
- `id`
- `label`
- `status`
- `summary`
- `sourceFields`

## Allowed statuses

- `present`
- `missing`
- `valid`
- `invalid`
- `pending`
- `anchored`
- `verified`
- `mismatch`
- `unknown`

## Design constraints

The current model is a non-breaking interpretation layer only:
- consumes portable evidence JSON
- may verify using existing helpers
- may summarize Merkle / anchor state
- may derive decision-trace, replay-manifest, and denied-action interpretations from existing evidence
- must not mutate evidence
- must not change stored roots
- must not introduce new canonical fields
- must not invent denied-action protocol fields not present in the receipt
- must not change schema/root behavior yet
- must not change ERC-8275 / BeTrueCore fields yet

## Verifier behavior

The capsule can recompute verification state using the existing portable verifier.
That derived view status is interpretive only; it does not rewrite the evidence document.
