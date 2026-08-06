# Recursive Singleton Fold v0 normative fixtures

These 34 vectors freeze the adopted positions 18–28 contract. They are
normative data, not a production evaluator. Expected commitments are generated
by `conformance/recursive-singleton-fold-v0/generate_expected.py`, which does
not import ReceiptOS implementation helpers, and are independently audited by
the TypeScript script beside it.

The manifest hashes exact LF UTF-8 Git candidate bytes. Its `fixture_set_sha256`
is SHA-256 over sorted `<path>\t<file-sha256>\n` records and excludes the
manifest itself. Semantic commitments hash independently canonicalized JSON,
never checkout or file bytes.
