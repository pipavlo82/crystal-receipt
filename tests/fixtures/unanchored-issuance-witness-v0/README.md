# Unanchored issuance witness v0 normative vectors

This directory pins the normative vector set required by
`docs/UNANCHORED_ISSUANCE_WITNESS_V0.md`.

The package contains the complete A–K state matrix, with G1/G2 and K1/K2 as
separate cases, plus co-occurrence cases for late terminal after overdue,
equivocation admissible-prefix boundaries, and multiple ordered violations.

The vectors are specification-derived fixtures, not output captured from a
witness evaluator. No production findings detector is included. A future
implementation can use these files for an independent blind diff.

`manifest.json` binds the frozen specification hash, every vector, every
normative schema dependency, and the complete fixture-set hash. The
fixture-set hash is SHA-256 over UTF-8 lines of:

```text
<sorted relative path><TAB><lowercase file SHA-256><LF>
```

The manifest file itself and this README are intentionally outside the pinned
set, avoiding a self-referential hash.

Run the focused integrity suite with:

```sh
bun test tests/receiptos/unanchored-issuance-witness-vectors.test.ts
```
