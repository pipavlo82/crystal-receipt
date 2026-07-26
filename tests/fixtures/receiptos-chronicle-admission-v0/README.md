# ReceiptOS → Chronicle admission vectors v0

This self-contained package pins the shared producer/consumer admission seam:

`original evidence + portable proof object → independent receipt-root recomputation → consistency and identity checks → chronicle_entry.v0 or deterministic rejection`.

The package is implementation-neutral. Expected results are semantic outcomes, not host-language exception strings. Producer-reported verifier state is checked as evidence and never replaces independent recomputation.

## Integrity

`manifest.json` hashes the schema and every vector. The aggregate `fixture_set_sha256` is SHA-256 over:

```text
<sorted package-relative path><TAB><lowercase SHA-256><LF>
```

`manifest.json` is excluded from its own aggregate.
