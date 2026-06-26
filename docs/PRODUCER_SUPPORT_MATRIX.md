# Producer Support Matrix

## Purpose

This document summarizes the producer coverage that already exists in the current Crystal Receipt / ReceiptOS repository.

Core message:

```text
Same proof pipeline.
Different producers.
One portable receipt model.
```

The point of this matrix is not to claim that every producer has a dedicated custom proof model.
The point is the opposite: multiple producers already map into the same ReceiptOS proof boundary.

## Shared proof boundary

Across supported producers, ReceiptOS keeps the same core proof-facing outputs and invariants:

- producer-neutral evidence ingestion
- canonical `receipt_root` recomputation
- top-level `anchor` ignored during root computation
- `receiptos.capsule_summary.v0`
- `receiptos.evidence_capsule.v0`
- `receiptos.provenance_summary.v0`
- verifier-facing proof status
- replay-oriented evidence summaries

Producer identity remains provenance metadata, not proof truth.

## Current producer set

| Producer | Source shape / adapter path | Current status | Notes |
| --- | --- | --- | --- |
| Stealth handoff | `stealth-handoff` | Supported | Historical/current portable envelope path remains `stealth.session.evidence.v1`; naming does not create a Stealth-only trust boundary. |
| GitHub Actions | `github.actions_run.v0` / `github-actions` | Supported | GitHub Actions UI remains source of truth for final workflow conclusion when export occurs mid-run. |
| Claude Code session | `claude.code.session.v0` / `claude-code-session` | Supported | Session-oriented producer path normalized into the shared ReceiptOS proof model. |
| Cursor session | `cursor.session.v0` / `cursor-session` | Supported | Cursor-specific session evidence reduces into the same proof-facing artifacts. |
| Codex session | `codex.session.v0` / `codex-session` | Supported | Codex session evidence follows the same shared proof pipeline. |
| generic producer | `generic` | Supported | Producer-neutral import path for systems that can export compatible execution evidence without a custom adapter story. |
| external coding run | `external.coding_run.v0` / `external-coding-run` | Supported | First concrete external coding-agent/tool-run producer path beyond generic import. |

## What “supported” means here

For this matrix, “supported” means the repository already contains the relevant current-surface adapter, fixture, import path, tests, or demo coverage needed to route that producer shape into the existing ReceiptOS proof boundary.

It does **not** mean:

- producer workflow semantics become identical
- producer trust semantics are elevated above proof verification
- every producer already has a dedicated committed Viewer example bundle
- ReceiptOS becomes the upstream workflow engine for that producer

## Example and Viewer status

The committed Viewer example index currently focuses on proof-state examples such as:

- clean local proof
- tampered mismatch
- anchored proof

It should be read as a stable Viewer/demo bundle index, not as an exhaustive list of every currently supported producer integration.

Producer-specific committed Viewer bundles for Stealth handoff, GitHub Actions, Claude Code, Cursor, Codex, and generic producer runs are future example/documentation work.

`external.coding_run.v0` already has runnable demo/import coverage and is the clearest current non-Stealth external coding-run example.

## Summary

ReceiptOS already supports multiple producer shapes without changing the proof substrate.

That is the architectural point:

- same proof pipeline
- different producers
- one portable receipt model
