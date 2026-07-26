# Unanchored Issuance Witness v0 implementation status

> **Non-normative implementation status**

This document reports repository implementation status. It does not modify,
extend, or override the frozen normative specification in
`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`.

## Published normative artifacts

The Unanchored Issuance Witness v0 specification is published and frozen at:

```text
SHA-256 24fdf071008638c5c0198dc80d94be4ae3a8e31f072b41009ded71ea7d49ffa4
```

The following witness-related schemas are published:

- `src/receiptos/schemas/issuance-coverage-profile-v0.schema.json`
- `src/receiptos/schemas/issuance-record-v0.schema.json`
- `src/receiptos/schemas/issuance-result-commitment-v0.schema.json`
- `src/receiptos/schemas/witness-receipt-v0.schema.json`
- `src/receiptos/schemas/witness-log-checkpoint-v0.schema.json`
- `src/receiptos/schemas/admission-result-v0.schema.json`

The normative vector package under
`tests/fixtures/unanchored-issuance-witness-v0/` publishes the complete A–K
matrix, including separate G1/G2 and K1/K2 cases, plus co-occurrence vectors.
Its manifest pins every normative dependency and the fixture set:

```text
SHA-256 cf6136a129e1657ea7e4ff61e16e7c33be377339089ec3fa6e63f55cd4a5767e
```

The vector package is a conformance oracle derived from the specification. It
is not captured output from a production witness evaluator.

## Current implementation boundary

No production evaluator currently consumes witness artifacts, performs the
complete normative admission-check sequence, and emits
`admission_result.v0`.

Schema validity does not imply semantic admission. Matching a normative vector
shape does not itself prove that an implementation independently evaluated the
underlying evidence. A future evaluator must derive its result by applying the
declared normative rules and must be tested independently against the pinned
oracle.

Implementation status must not be confused with normative specification
status: the specification, schemas, and vectors are published, while the
complete production findings evaluator remains absent.
