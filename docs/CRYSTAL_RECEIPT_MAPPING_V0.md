# CRYSTAL_RECEIPT_MAPPING_V0

This document defines the non-visual mapping from a ReceiptOS Evidence Capsule into Crystal Receipt semantic surfaces.

## Principle

Crystal Receipt is the visual proof surface of the capsule.
Crystal Receipt should not become the verifier.
Crystal Receipt should consume the portable ReceiptOS proof core and expose a stable interpretation layer for rendering and future UI.

## Mapping

```text
core        = payload / action
inner ring  = policy boundary + authorization
facets      = execution + evidence
outer shell = result + receipt_root
anchor edge = Merkle + external anchor
seal        = verifier status
```

## Intent

This mapping is a pure view-model layer:
- no renderer changes
- no visual renderer redesign yet
- no UI framework code
- no browser code
- no schema changes
- no new receipt fields
- future renderer can consume this mapping later

## Output shape

The mapping model should provide:
- capsule sections
- grouped visual surfaces
- proof surface status
- high-level summary labels for later renderer/UI adoption

## Non-goals

This layer does not:
- redesign crystal visuals
- change receipt-card layout
- submit anchors on-chain
- add wallet/RPC/private key logic
- alter canonical receipt semantics
