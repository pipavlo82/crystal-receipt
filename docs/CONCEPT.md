# Concept

## Crystal Receipt

The goal is to make a receipt feel visually memorable without pretending the image itself is a verifier.

A receipt hash already acts as a compact identifier. This project maps that hash into a deterministic visual object inspired by bismuth crystal growth:

- layered geometry
- stepped symmetry
- metallic / iridescent palette
- deterministic layout from a stable seed

## Properties

### Deterministic
The same input hash always yields the same metadata and the same SVG.

### Distinguishable
Different hashes should usually yield different geometry, colors, and layering.

### Non-security role
The visual is not a proof system. It is:
- a fingerprint
- a human-facing artifact
- a recognition layer

It should complement, not replace, cryptographic verification.

## MVP scope

The MVP intentionally stays simple:
- one hash in
- one deterministic SVG out
- one metadata JSON out
- no network access
- no app integration
- no wallets, chains, or marketplaces

## Why SVG first

SVG is ideal for the first version because it is:
- deterministic
- text-based
- easy to diff
- dependency-light
- portable across platforms
