# STEALTH_EVIDENCE_CAPSULE_ADAPTER_V0

## Purpose

This document defines the **adapter boundary** for mapping Stealth receipt/evidence output into Crystal Receipt's `receiptos.evidence_capsule.v0` proof substrate.

The goal is to specify a small, producer-neutral bridge **before** any production adapter code is introduced.

The adapter is intended to:
- preserve existing Stealth receipt semantics
- preserve existing `receipt_root` semantics
- emit a schema-valid `receiptos.evidence_capsule.v0` object
- keep Crystal Receipt proof-first and consumer-oriented

## Non-goals

This adapter spec does **not** introduce:
- Stealth core changes yet
- new policy or authorization semantics
- settlement logic
- reputation logic
- scoring logic
- ATP dependencies
- visual/crystal fields in the proof substrate
- Stealth integration into Crystal Receipt runtime flows yet

## Project boundary

Crystal Receipt is an independent proof-substrate repository.
Stealth / ReceiptOS are separate systems.
This document is only a future adapter note.

It does **not** mean:
- Stealth core changes are being introduced
- ReceiptOS semantics are being changed
- Crystal Receipt depends on Stealth
- Stealth depends on Crystal Receipt

## Source format

The initial source format is:
- **Stealth `HandoffEvidence`**
- schema:
  - `stealth.session.evidence.v1`

Expected source categories include:
- task / prompt context
- commands
- execution records
- authorization state
- changes / diff hash
- anchor / proof fields
- metadata

## Target format

The adapter target is:
- **Crystal Receipt `receiptos.evidence_capsule.v0`**

Required top-level proof objects are:
1. `action`
2. `evidence`
3. `receipt_root`
4. `proof_refs`
5. `verifier_result`
6. `capsule`
7. `replay_manifest`

## Mapping table

| Stealth field | Evidence Capsule v0 field | Notes |
|---|---|---|
| `task.title`, `task.prompt`, `commands`, `execution` | `action` | Build a minimal summary plus source field refs |
| `changes.files_changed`, `changes.diff_sha256`, `metadata.diff_count`, `metadata.message_count`, `execution` | `evidence` | Summary + status + source field refs |
| `anchor.receipt_root` + recomputed root | `receipt_root` | Preserve current receipt semantics exactly |
| `anchor.merkle_*`, `anchor.onchain_anchor_status`, `anchor.network`, `anchor.contract`, `anchor.tx_hash` | `proof_refs` | Reduce to portable proof references |
| verifier result from existing Stealth recomputation | `verifier_result` | Independent proof result, not trusted producer output |
| whole interpreted receipt state | `capsule` | Reuse the current Evidence Capsule section model |
| `session_id`, `directory`, `task`, `commands`, `changes.diff_sha256`, `anchor.receipt_root`, `anchor.merkle_root`, `anchor.tx_hash`, `metadata.generated_by` | `replay_manifest` | Replay-relevant summary only |

## receipt_root semantics

The adapter must preserve current semantics exactly:

- `stored` = `anchor.receipt_root`
- `computed` = recomputed via the existing Stealth verifier logic
- `match` = comparison result between `stored` and `computed`
- `status` = one of:
  - `verified`
  - `mismatch`
  - `missing`

The adapter must not redefine canonicalization, hash derivation, or anchor-stripping behavior.

## proof_refs mapping

### Local Merkle

Map Stealth local Merkle fields into the substrate as:

- `proof_refs.merkle.present`
- `proof_refs.merkle.status`

Recommended interpretation:
- `present = true` when local Merkle proof is attached
- `status = valid` when the local proof verifies
- `status = invalid` when proof data is present but fails verification
- `status = missing` when no proof is attached
- `status = pending` only when preserving an existing intermediate proof state is necessary

### Anchor status

Map Stealth anchor state into:

- `proof_refs.anchor.status`

Recommended values:
- `anchored`
- `pending`
- `missing`
- `unknown`

This keeps proof references portable without leaking viewer- or chain-specific presentation fields into the substrate.

## replay_manifest mapping

The adapter should expose a minimal replay-oriented summary using existing Stealth evidence fields.

It should not invent a new replay protocol object.

Minimal output should contain:
- `summary`
- `source_fields`

Suggested source fields include:
- `session_id`
- `directory`
- `task`
- `commands`
- `changes.diff_sha256`
- `anchor.receipt_root`
- `anchor.merkle_root`
- `anchor.tx_hash`
- `metadata.generated_by`

## Adapter location recommendation

The first adapter should live **outside Stealth core**.

Recommended initial location:
- Crystal Receipt side
- script-level or adapter-layer only

Why:
- avoids Stealth core changes while schema v0 is still stabilizing
- avoids premature coupling between Stealth runtime and Crystal Receipt proof substrate
- keeps the adapter reviewable and reversible

Later, once the schema and mapping are stable, Stealth can emit the same substrate natively if desired.

## Risks / open questions

### 1. Semantic drift
If the adapter reinterprets `receipt_root` or proof state differently from Stealth, the substrate will be misleading.

### 2. Overfitting to current Stealth shape
The first adapter should tolerate optional/missing fields and avoid over-assuming current UI-side convenience types.

### 3. Anchor ambiguity
The adapter must distinguish clearly between:
- local proof attached
- anchor pending
- anchor anchored
- imported anchor overlay state

### 4. Schema inflation
The adapter must not leak settlement, reputation, scoring, or presentation fields into the substrate.

### 5. Location drift
If the adapter starts as a Crystal Receipt script, later migration into Stealth should remain optional, not assumed.

## Recommended first implementation approach

When implementation begins, the smallest path is:
- parse Stealth `stealth.session.evidence.v1`
- recompute receipt verification using existing logic
- derive the seven substrate objects
- validate against `schemas/evidence-capsule.v0.schema.json`

This keeps the adapter:
- proof-first
- modular
- producer-neutral
- non-invasive to Stealth core
