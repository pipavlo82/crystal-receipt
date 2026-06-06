# Action-to-Growth Crystal Grammar

Crystal Receipt is not random generative art.
It is a deterministic visual grammar derived from receipt evidence.

The goal is simple:

```text
same receipt evidence -> same growth history
changed receipt evidence -> changed growth history
```

That means a visible crystal feature should have a receipt-derived cause.
If the receipt changes in a meaningful way, the crystal's growth history should change in a deterministic way.

## Core rule

```text
receipt action -> crystal growth mutation
```

This is the core grammar for future renderer work.
The crystal should look like it grew from the receipt, not like decorative randomness was layered on top afterward.

## Why this matters

Bismuth-like growth works as a visual metaphor because it suggests structure, accretion, steps, fractures, shells, and directional growth.
That makes it a good fit for receipt evidence.

The crystal should communicate that:

- the artifact has a stable identity
- the growth history came from evidence
- a changed receipt changed the growth
- visual structure is traceable, not arbitrary

## Deterministic identity rule

The grammar should preserve these rules:

- same receipt evidence produces the same growth history
- changed receipt evidence changes the growth history
- visible mutations should map back to receipt evidence
- visual uniqueness should come from evidence, not randomness

## Proposed mapping

These mappings are docs-only for now.
They describe the intended grammar, not current code.

### `session_id`
Drives:
- base orientation
- initial growth origin

Meaning:
The session identity can define where and how the crystal begins growing.

### `agent_id`
Drives:
- core geometry bias

Meaning:
Different agents can nudge the crystal toward different structural tendencies while remaining deterministic.

### `receiptHash`
Drives:
- primary crystal identity

Meaning:
This is the main identity anchor for the artifact.
It should strongly influence the crystal's recognizable overall identity.

### `eventRoot`
Drives:
- global growth structure

Meaning:
The event root can influence large-scale organization, hierarchy, and overall structural coherence.

### `diffHash`
Drives:
- fracture pattern
- step pattern

Meaning:
Change structure should affect how the crystal breaks, steps, or terraces across its body.

### `changed_files`
Drives:
- terrace count
- branch count
- growth bands

Meaning:
The shape and scale of the change set should show up as visible stepped growth complexity.

### `scope`
Drives:
- outer shell
- boundary size

Meaning:
Scope can affect how large or contained the visible crystal envelope feels.

### `authority`
Drives:
- boundary strength
- edge thickness

Meaning:
Authority-related evidence can influence the firmness or emphasis of the crystal boundary.

### `verifier_result`
Drives:
- clarity
- seal
- glow state

Meaning:
Verification outcome can affect whether the crystal appears clear, sealed, muted, or visibly affirmed.

### `signature_trust_block`
Drives:
- trust ring
- edge accent

Meaning:
Trust and signature evidence can appear as ring-like or edge-level accents rather than replacing verification itself.

### `timestamp`
Drives:
- layer rhythm
- growth order

Meaning:
Time-related evidence can influence cadence, ordering, and the visual rhythm of layer formation.

## Rendering principle

A future renderer should make these mappings visible through deterministic growth changes.
That means:

- mutation families should be stable
- evidence changes should alter visible growth consistently
- visual traits should be explainable in terms of receipt evidence
- the crystal should remain reproducible across machines

## Boundary

This grammar does not change the verifier boundary.
The crystal is still a visual artifact derived from receipt evidence.
It is still not the verifier.

## Current status

This document is a design grammar only.
It does not add code, metadata fields, or CLI behavior by itself.
