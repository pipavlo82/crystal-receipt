# Verifier Challenge missing_required_input_unverifiable v0

Frozen profile: `verifier-challenge-missing-required-input-unverifiable-v0`

This package freezes exactly one verifier challenge vector demonstrating
**missing-required-input unverifiability**: absent required `anchor.receipt_root`
must not be reported as valid receipt-root verification.

It does **not** freeze Verifier Challenge Set v0, verifier-of-verifier,
full verifier conformance, semantic neighbors, DCN, semantic-drift detection,
host-error taxonomy, general malformed-input validation, or schema validation.

Missing `anchor.receipt_root` is classified by this package as insufficient
input for receipt-root verification. This package does not call arbitrary
malformed JSON “unverifiable”.

## Subject verifier

- Entrypoint: `verifyHandoffReceiptRoot`
- Module: `src/receiptos/verify/verify-receipt.ts`
- Pinned by Git blob OID in the vector and contract.

Git blob pins in this package refer to tracked Git index/object-store blob
identities. They do not refer to platform-normalized working-tree bytes.
Independent auditors resolve pins with `git rev-parse :<repository-relative-path>`.

## Challenge semantics

### Governed input

Handoff session evidence JSON conforming to the pinned source fixture identity.
The baseline fixture carries:

- `anchor.receipt_root`: pinned receipt root under test

### Mutation rule

Apply exactly one mutation to a deep clone of baseline input:

- path: `anchor.receipt_root`
- from: pinned baseline receipt root
- to: `null`

No other field may change.

The challenged value deliberately models untrusted JSON outside the current
TypeScript literal contract for `HandoffEvidence`.

### Receipt-root derivation profile

When `anchor.receipt_root` is present and truthy, independently recomputed
validity uses:

1. Remove the entire top-level `anchor` object from evidence
   (`stripAnchor` rule).
2. Canonicalize the remaining evidence object to deterministic JSON.
3. SHA-256 the UTF-8 canonical bytes.
4. Prefix with `0x` to form `recomputed_root`.
5. Compare case-insensitively to `anchor.receipt_root`.

When `anchor.receipt_root` is absent or falsy, the verifier returns
`{ ok: false, receipt_root: null, recomputed_root: null }` without throwing.
Receipt-root recomputation is not treated as successful when the comparison
operand is absent.

**Required decisive operand:** `anchor.receipt_root`

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_verification` | `ok: true`, roots match pinned values |
| `challenged_verification` | `ok: false`, `receipt_root: null`, `recomputed_root: null` |
| Non-elevation | missing required input MUST NOT establish validity |
| Fail-closed | verifier MUST NOT throw on challenged input |
| Difference | challenged verification MUST differ from baseline verification |

### Frozen verifier result shape

Only the fields returned by `verifyHandoffReceiptRoot` are in scope:

```json
{
  "ok": boolean,
  "receipt_root": string | null,
  "recomputed_root": string | null
}
```

Host-error taxonomy and capsule summary outputs remain outside this package.

## Frozen expected-outcome vocabulary

| Outcome | Meaning |
| --- | --- |
| `verification_differs` | Challenged verification MUST differ from baseline verification |
| `missing_input_unverifiable` | Absent required operand yields null roots and `ok: false` |
| `non_throwing_fail_closed` | Verifier returns failure result without throwing |

## Vector execution classes

| Class | Meaning |
| --- | --- |
| `production-verifier-binding` | Execute `verifyHandoffReceiptRoot` on baseline and challenged inputs |

## Package digest recipes

Member inventory digest (`fixture_set_sha256`):

- Sort member paths lexicographically by UTF-8 byte order.
- For each member except `manifest.json`, emit `<path>\t<file-sha256>\n`.
- SHA-256 the concatenated UTF-8 rows (lowercase hex).

Expected-result-set digest (`expected_result_set_sha256`):

- Single vector: `V-MISSING-REQUIRED-INPUT\t<sha256(canonical expected JSON)>\n`
- SHA-256 the UTF-8 row (lowercase hex).

Hash algorithm: SHA-256, lowercase hex, no prefix.

## Claim boundary

This package may claim only:

> ReceiptOS has a frozen verifier challenge demonstrating that absent required
> `anchor.receipt_root` yields a non-throwing unverifiable result and cannot
> be reported as valid receipt-root verification.

It MUST NOT claim general malformed-input handling, schema validation,
Chronicle admission semantics, timing non-elevation, or Verifier Challenge Set
v0 completeness.
