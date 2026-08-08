# Counterfactual Audit Boundary v0

Frozen profile: `counterfactual-audit-boundary-v0`

This package freezes only the reserved-field audit-metadata boundary from
ReceiptOS Verifier Challenge Set working draft §14.1 and the existing helpers
`snapshotCounterfactualSemanticJson` and `computeCounterfactualManifestFileSha256`.

It does **not** freeze Counterfactual Conformance v0, semantic neighbors,
Deterministic Counterfactual Neighborhood, Verifier Challenge Set v0,
verifier-of-verifier, or Verifier Conformance Run.

## Domains

### Semantic input domain

Semantic artifact input is caller-owned JavaScript/JSON-like data presented to
`snapshotCounterfactualSemanticJson`. The snapshot operation:

- constructs a fresh strict-JSON snapshot by descriptor inspection;
- traverses own string keys in lexicographic ascending order;
- captures each accepted data-property value exactly once;
- never silently strips reserved audit metadata;
- rejects any own property named `audit_timestamp` at any object depth before
  accepting semantic input;
- returns a newly allocated null-prototype object graph for accepted input.

Root inspection path prefix: `$semantic_artifact`.

Accepted scalar domain: `null`, finite numbers, booleans, strings.

Rejected without silent repair: accessor properties, symbol-keyed own properties,
non-enumerable own properties, inherited enumerable state, sparse arrays, extra
array string properties, non-JSON containers, cyclic values, and unstable own-key
snapshots.

### Audit metadata domain

`audit_timestamp` is non-semantic audit metadata.

It MAY exist outside the semantic artifact object, for example in an enclosing
review or packaging manifest. Such metadata MUST NOT affect semantic identity,
semantic mutation meaning, challenge semantics, or verifier-profile semantics.

### Manifest file-byte domain

Manifest file bytes are an exact byte sequence domain separate from semantic
bytes.

- A `string` manifest input is encoded as UTF-8 exactly once before SHA-256.
- A `Uint8Array` manifest input is hashed as the exact supplied bytes with no
  re-encoding.

Changing or removing `audit_timestamp` in serialized manifest bytes MAY change
the manifest file hash without changing the semantic identity of the described
artifact.

## Reserved field

Reserved field name: `audit_timestamp`

Rule:

- forbidden at every object depth inside semantic artifact input;
- never silently stripped from semantic input;
- presence inside semantic input is malformed and MUST be rejected with an
  error naming the inspection path and stating that non-semantic audit metadata
  is forbidden in semantic input.

## Frozen expected-outcome vocabulary

| Outcome | Meaning |
| --- | --- |
| `rejected` | Operation MUST throw; vector specifies path/message constraints |
| `accepted_snapshot` | Operation MUST succeed; vector specifies canonical JSON of snapshot |
| `manifest_hash_differs` | Two manifest byte inputs MUST produce different SHA-256 hex digests |
| `manifest_hash_equals` | Two manifest byte inputs MUST produce identical SHA-256 hex digests |
| `manifest_hash_value` | One manifest byte input MUST produce the given SHA-256 hex digest |

## Vector execution classes

| Class | Meaning |
| --- | --- |
| `semantic-snapshot` | Execute reserved-field snapshot rule on semantic input |
| `manifest-file-hash` | Execute manifest file-byte SHA-256 rule |
| `package-integrity-only` | No semantic execution; package byte integrity only |

## Package digest recipes

Member inventory digest (`fixture_set_sha256`):

- Sort member paths lexicographically by UTF-8 byte order.
- For each member except `manifest.json`, emit `<path>\t<file-sha256>\n`.
- `file-sha256` is lowercase hex SHA-256 over exact member bytes.
- `fixture_set_sha256` is lowercase hex SHA-256 over the concatenated UTF-8
  rows.
- `manifest.json` lists all other members and carries `fixture_set_sha256`; it
  is excluded from its own digest input.

Expected-result-set digest (`expected_result_set_sha256`):

- Sort vector IDs lexicographically.
- For each vector, emit `<vector-id>\t<sha256(canonical UTF-8 expected JSON)>\n`.
- Canonical JSON here is stable pretty-less JSON with UTF-8 encoding of the
  vector's `expected` object only.
- `expected_result_set_sha256` is lowercase hex SHA-256 over the concatenated
  UTF-8 rows.

Hash algorithm everywhere: SHA-256, lowercase hex, no prefix.
