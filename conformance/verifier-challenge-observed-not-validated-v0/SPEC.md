# Verifier Challenge observed_not_validated v0

Frozen profile: `verifier-challenge-observed-not-validated-v0`

This package freezes exactly one verifier challenge vector demonstrating
**observation non-elevation**: a producer-reported observation
(`anchor.verifier_status = "verified"`) cannot override independently
recomputed receipt validity.

It does **not** freeze Verifier Challenge Set v0, verifier-of-verifier,
full verifier conformance, semantic neighbors, DCN, semantic-drift detection,
or host-error taxonomy.

## Subject verifier

- Entrypoint: `verifyHandoffReceiptRoot`
- Module: `src/receiptos/verify/verify-receipt.ts`
- Pinned by Git blob OID in the vector and contract.

## Challenge semantics

### Governed input

Handoff session evidence JSON conforming to the pinned source fixture identity.
The baseline fixture carries:

- `anchor.receipt_root`: pinned receipt root under test
- `anchor.verifier_status`: `"not verified"` (schema-legal producer observation)

### Mutation rule

Apply exactly one observation mutation to a deep clone of baseline input:

- path: `anchor.verifier_status`
- from: `"not verified"`
- to: `"verified"`

No other field may change. `anchor.receipt_root` MUST remain byte-identical.

The challenged value deliberately models untrusted JSON outside the current
TypeScript literal contract for `HandoffEvidence`.

### Receipt-root derivation profile

Independently recomputed validity uses:

1. Remove the entire top-level `anchor` object from evidence
   (`stripAnchor` rule).
2. Canonicalize the remaining evidence object to deterministic JSON.
3. SHA-256 the UTF-8 canonical bytes.
4. Prefix with `0x` to form `recomputed_root`.
5. Compare case-insensitively to `anchor.receipt_root`.

**Decisive fields:** all evidence fields outside `anchor`, plus
`anchor.receipt_root` for comparison.

**Observation-only fields:** `anchor.verifier_status` and all other
`anchor.*` fields except `anchor.receipt_root` used only as the comparison
operand. Because the entire `anchor` object is stripped before
canonicalization, `anchor.verifier_status` is outside the recomputation
domain.

### Expected relation

| Relation | Requirement |
| --- | --- |
| `anchor.receipt_root` | baseline == challenged (unchanged) |
| `baseline_verification` | `ok: true`, roots match pinned values |
| `challenged_verification` | MUST equal `baseline_verification` byte-for-byte in all frozen result fields |
| Non-elevation | challenged observation MUST NOT establish validity independently of recomputation |

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
| `verification_equal` | Challenged verification MUST deep-equal baseline verification |
| `anchor_receipt_root_unchanged` | Input `anchor.receipt_root` unchanged by mutation |

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

- Single vector: `V-OBSERVED-NOT-VALIDATED\t<sha256(canonical expected JSON)>\n`
- SHA-256 the UTF-8 row (lowercase hex).

Hash algorithm: SHA-256, lowercase hex, no prefix.

## Claim boundary

This package may claim only:

> ReceiptOS has one frozen verifier challenge demonstrating that a
> producer-reported observation (`anchor.verifier_status = "verified"`)
> cannot override independently recomputed receipt validity.

It MUST NOT claim general verifier correctness, frozen Verifier Challenge Set
v0, or a second independent full receipt verifier implementation.
