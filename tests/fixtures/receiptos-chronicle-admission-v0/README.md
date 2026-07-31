# ReceiptOS → Chronicle admission vectors v0

This self-contained package pins the shared producer/consumer admission seam:

`original evidence + portable proof object → independent receipt-root recomputation → consistency and identity checks → chronicle_entry.v0 or deterministic rejection`.

The package is implementation-neutral. Expected results are semantic outcomes, not host-language exception strings. Producer-reported verifier state is checked as evidence and never replaces independent recomputation.

## Integrity

### Canonical member-byte domain

For every path listed as a fixture member in `manifest.json`, the recorded
member `sha256` is computed over the exact raw Git blob payload bytes stored for
that repository-relative path at the package's pinned immutable source commit.

The digest input is the blob payload only. It excludes Git object headers and
does not use working-tree or checkout bytes.

No operation is applied before hashing, including:

- line-ending normalization;
- text decoding or re-encoding;
- Unicode normalization;
- whitespace normalization;
- JSON parsing or re-serialization;
- canonical JSON transformation;
- clean or smudge filters;
- `.gitattributes` checkout transformations;
- generated-file regeneration.

The member digest operation is:

```text
SHA-256(raw Git blob payload bytes)
```

### Aggregate fixture-set recipe

`manifest.json` hashes the schema and every vector. The aggregate
`fixture_set_sha256` is SHA-256 over:

```text
<sorted package-relative path><TAB><lowercase SHA-256><LF>
```

The package-relative paths in this package are ASCII, so their bytewise order
and serialized bytes are unambiguous for this recipe. No additional Unicode
path canonicalization rule applies here.

`manifest.json` is excluded from its own aggregate. Exactly one TAB appears in
each record, exactly one LF terminates each record, the final record also ends
with LF, and no extra separators or length prefixes are used.
