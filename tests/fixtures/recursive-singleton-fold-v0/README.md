# Recursive Singleton Fold v0 normative fixtures

These 34 vectors freeze the adopted positions 18–28 contract. They are
normative data, not a production evaluator. Python and TypeScript independently
reconstruct expected facts without production helpers or candidate-as-expected
copying.

The manifest hashes exact Git-index/blob bytes. Package model A owns 40
repository-relative artifacts: this README, `contract.json`, four schemas, and
34 vectors. `fixture_set_sha256` is SHA-256 over sorted
`<repository-path>\t<file-sha256>\n` records and excludes the manifest itself.
Semantic commitments hash canonical JSON, never file or checkout bytes.
Verification is read-only; only `--generate` intentionally writes artifacts.
