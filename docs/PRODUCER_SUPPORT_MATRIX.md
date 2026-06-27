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

## Producer categories

### Verified against real producer data or real fixture shape

| Producer | Source shape / adapter path | Current status | Notes |
| --- | --- | --- | --- |
| Stealth handoff | `stealth-handoff` | Verified fixture/data shape | Historical/current portable envelope path remains `stealth.session.evidence.v1`; naming does not create a Stealth-only trust boundary. |
| GitHub Actions | `github.actions_run.v0` / `github-actions` | Verified fixture/data shape | GitHub Actions UI remains source of truth for final workflow conclusion when export occurs mid-run. |
| Claude Code session | `claude.code.session.v0` / `claude-code-session` | Verified fixture/data shape | Session-oriented producer path normalized into the shared ReceiptOS proof model. |
| generic producer | `generic` | Verified fixture/data shape | Producer-neutral import path for systems that can export compatible execution evidence without a custom adapter story. |
| external coding run | `external.coding_run.v0` / `external-coding-run` | Verified documented external schema | First concrete external coding-agent/tool-run producer path beyond generic import. |

### Schema sketch / capsule-boundary compatibility only

| Producer | Source shape / adapter path | Current status | Notes |
| --- | --- | --- | --- |
| Cursor session | `cursor.session.v0` / `cursor-session` | Boundary compatibility only | Demonstrates ReceiptOS capsule-boundary compatibility, but is not yet verified against stable, documented real Cursor main-session output. Cursor session history appears to live primarily in SQLite/state storage and undocumented serialized blobs; JSONL sub-agent transcripts are only a subset. |
| Codex session | `codex.session.v0` / `codex-session` | Boundary compatibility only | Demonstrates ReceiptOS capsule-boundary compatibility, but is not yet verified against a stable, documented real Codex session row schema. Known session formats appear to vary across versions even though an official `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` path exists. |

## What “supported” means here

For this matrix, “supported” means the repository already contains the relevant current-surface adapter, fixture, import path, tests, or demo coverage needed to route that producer shape into the existing ReceiptOS proof boundary.

It does **not** mean:

- producer workflow semantics become identical
- producer trust semantics are elevated above proof verification
- every producer already has a dedicated committed Viewer example bundle
- every adapter is already verified against stable, documented real producer output
- ReceiptOS becomes the upstream workflow engine for that producer
- Cursor or Codex should be advertised as production-grade integrations today

## Example and Viewer status

The committed Viewer example index currently focuses on proof-state examples such as:

- clean local proof
- tampered mismatch
- anchored proof

It should be read as a stable Viewer/demo bundle index, not as an exhaustive list of every currently supported producer integration.

Committed Viewer bundles now exist for Stealth handoff, GitHub Actions, Claude Code, Cursor, Codex, generic producer, and external coding run examples.

Those bundles show that these shapes can be rendered through the shared Viewer/capsule surface. They do **not** upgrade Cursor or Codex into production-grade, real-format-verified integrations by themselves.

`external.coding_run.v0` already has runnable demo/import coverage and remains the clearest current non-Stealth external coding-run example because it is backed by a documented external schema.

## Summary

ReceiptOS already supports multiple producer shapes without changing the proof substrate.

That is the architectural point:

- same proof pipeline
- different producers
- one portable receipt model
