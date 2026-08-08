# Verifier Challenge integrity_mismatch_rejected v0

Frozen profile: `verifier-challenge-integrity-mismatch-rejected-v0`

This package freezes exactly one verifier challenge vector demonstrating
**integrity mismatch rejection**: mutation of a decisive receipt-body field
must be detected by independent receipt-root recomputation and must not retain
valid receipt-root verification while `anchor.receipt_root` remains unchanged.

It does **not** freeze Verifier Challenge Set v0, verifier-of-verifier,
full verifier conformance, semantic neighbors, DCN, semantic-drift detection,
host-error taxonomy, general tamper-proofing, schema validation, or Chronicle
admission semantics.

This challenge is distinct from:

- **observed_not_validated v0**: observation-only anchor mutation leaves
  verification equal.
- **missing_required_input_unverifiable v0**: absent `anchor.receipt_root`
  yields `ok:false` with null roots.

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

- `task.title`: decisive receipt-body field under test
- `anchor.receipt_root`: pinned receipt root comparison operand

### Receipt-root derivation profile

Independently recomputed validity uses:

1. Remove the entire top-level `anchor` object from evidence
   (`stripAnchor` rule).
2. Canonicalize the remaining receipt body to deterministic JSON.
3. SHA-256 the UTF-8 canonical bytes.
4. Prefix with `0x` to form `recomputed_root`.
5. Compare case-insensitively to `anchor.receipt_root`.

`task.title` is inside the decisive receipt body for this profile. The entire
`anchor` object is removed before canonicalization. `anchor.receipt_root`
remains the comparison operand and is not part of the recomputed body content.

### Mutation rule

Apply exactly one mutation to a deep clone of baseline input:

- path: `task.title`
- from: `CYPHES workflow proof boundary sample`
- to: `CYPHES workflow proof boundary sample (tampered)`

No other field may change. `anchor.receipt_root` MUST remain byte-identical.

### Field classification

| Field | Classification |
| --- | --- |
| `task.title` | decisive receipt-body field inside derivation domain |
| `anchor.receipt_root` | required comparison operand |
| other `anchor.*` fields | outside recomputation domain |

### Expected relation

| Relation | Requirement |
| --- | --- |
| `baseline_verification` | `ok: true`, roots match pinned values |
| `challenged_verification` | `ok: false`, pinned `receipt_root` unchanged, `recomputed_root` differs |
| Integrity mismatch | challenged body recomputes to a different deterministic root |
| Non-elevation | mismatch MUST NOT retain `ok: true` |
| Fail-closed | verifier MUST NOT throw |
| Non-null roots | both challenged roots remain non-null because the comparison operand is present |

Because the required comparison operand remains present, both challenged roots
remain non-null even though verification fails.

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
| `integrity_mismatch_detected` | Recomputed root MUST differ from pinned anchor root |
| `anchor_receipt_root_unchanged` | Input `anchor.receipt_root` unchanged by mutation |
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

- Single vector: `V-INTEGRITY-MISMATCH\t<sha256(canonical expected JSON)>\n`
- SHA-256 the UTF-8 row (lowercase hex).

Hash algorithm: SHA-256, lowercase hex, no prefix.

## Claim boundary

This package may claim only:

> ReceiptOS has a frozen verifier challenge demonstrating that mutation of a
> decisive receipt field (`task.title`) is detected by independent
> receipt-root recomputation and cannot retain valid receipt-root verification
> while the pinned `anchor.receipt_root` remains unchanged.

It MUST NOT claim general tamper-proofing, schema validation, Chronicle
admission semantics, timing non-elevation, observation non-elevation already
covered by challenge #1, missing-input behavior already covered by challenge
#2, or Verifier Challenge Set v0 completeness.
