# Runnable Ecosystem E2E Status v0

## Verified main commit

- `1e74a63` — `feat: add portable proof object export script (#75)`

## Runnable path

```text
Stealth evidence JSON
→ ReceiptOS portable_proof_object.v0
→ Chronicle POST /import/receipt
→ Entry / Artifact / Collection / Portfolio
```

## Verified commands and results

### Tests

The following tests passed:

```text
bun test tests/receiptos/portable-proof-object-export-cli.test.ts tests/receiptos/portable-proof-object-v0.test.ts
```

### Export script

The export script accepted:

```text
src/receiptos/fixtures/session-evidence.sample.json
```

The emitted output schema was:

```text
receiptos.portable_proof_object.v0
```

### Chronicle import

Chronicle import returned:

- `ok: true`
- `imported: true`

### Chronicle stack creation

Chronicle created the full current stack:

- Entry
- Artifact
- Collection
- Portfolio

## Boundaries preserved

This runnable ecosystem path was verified without:

- Stealth changes
- Chronicle changes
- new proof semantics
- scoring
- reputation
- ownership logic
- NFT logic

## Summary

The first runnable ecosystem E2E path is now working on `main`.

It confirms a real code path from:

- Stealth evidence
- to ReceiptOS portable proof object export
- to Chronicle history import and stack composition
