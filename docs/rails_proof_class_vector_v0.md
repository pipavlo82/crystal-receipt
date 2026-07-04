# RAILS PROOF-Class Conformance Vector v0

This vector shows one ReceiptOS receipt entering a RAILS Evidence Envelope as a
**PROOF**-class item under RAILS §5.1, while staying outside RAILS Obligation
Object / Clearing Decision semantics.

## Source object

ReceiptOS source fixture:
- `src/receiptos/fixtures/session-evidence.with-local-merkle.sample.json`

Authoritative values in that fixture:

- `anchor.receipt_root`
  - `0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`
- `anchor.merkle_root`
  - `0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc`
- `anchor.merkle_leaf_index`
  - `0`
- `anchor.merkle_proof`
  - `[]`

This is the explicit one-leaf genesis case:
- no sibling hashes
- root equals leaf
- proof still exists and is checkable

## Projected Evidence Envelope entry

```json
{
  "kind": "receiptos.proof_entry.v0",
  "receipt_root": {
    "stored": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    "computed": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    "match": true,
    "status": "verified"
  },
  "merkle_proof": {
    "merkle_root": "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    "leaf_index": 0,
    "siblings": []
  },
  "sig_pq": {
    "type": "fips-204/ml-dsa-65",
    "signerHashed": "0x4e7bb6a3f4c36d9f0f6d7d4ab1b7c2ec7e297d51f6039f0a2f9d4e8c67ab3c10"
  },
  "verification_procedure": [
    "canonicalize the ReceiptOS evidence body",
    "recompute receipt_root",
    "require stored == computed",
    "verify one-leaf Merkle path (leaf_index=0, siblings=[])",
    "require merkle_root == receipt_root",
    "verify ML-DSA-65 signer metadata / signature material under the active pq-receipt-profile"
  ]
}
```

## Why the correct class is PROOF

Under RAILS §5.1, `PROOF` is the top class for a **cryptographic proof of
correctness**.

This vector satisfies that definition because the consumer can:

1. deterministically recompute the ReceiptOS `receipt_root`;
2. verify equality between stored and recomputed roots;
3. verify the Merkle proof from the recomputed root to the committed
   `merkle_root`;
4. verify signer / provenance metadata separately via the ML-DSA-65 profile.

The envelope item is therefore not just a signed statement about correctness;
it is a **cryptographically checkable correctness artifact**.

## Why the correct class is not ATT

It is not merely an attested runtime output. Even if the source runtime was
attested, the classing here is earned by the consumer’s successful execution of
a deterministic proof procedure (`recompute + Merkle path verification`).

## Why the correct class is not REC

It is not merely a signed receipt from an external system. The item does not
ask the consumer to trust an issuer’s receipt; it asks the consumer to verify a
cryptographic proof path.

## Why the correct class is not SIGN

The signature metadata is not the basis of correctness. A signature can tell a
consumer who vouched for the item, but not whether the root recomputes or the
Merkle path closes.

## RAILS section citations

- §5.1 supports the `PROOF` classification because the item is a
  cryptographic proof of correctness.
- §5.6 creates a guardrail: a generic receipt verifier would usually land in
  `REC` or `ATT`, so this item must be classified as a proof artifact, not as a
  plain receipt-verifier input.

## Expected admissibility result

- admissibility class: `PROOF`
- narrow proved claim:
  - “this ReceiptOS receipt body recomputes exactly and is correctly committed
    under the stated Merkle root”
- claims **not** proved by this vector:
  - that a RAILS Obligation Object was satisfied
  - that a Clearing Decision should release funds
  - that a Settlement Instruction should execute

## Non-trivial Merkle vector (≥2 leaves)

To avoid overfitting the mapping to the one-leaf genesis case, the same ReceiptOS
claim can be projected into a non-trivial Merkle proof with at least two leaves.

Example 2-leaf tree:

- `leaf_0 = receipt_root_a`
- `leaf_1 = receipt_root_b`
- `merkle_leaf_index = 0`
- `merkle_proof = [receipt_root_b]`
- `merkle_root = H(receipt_root_a || receipt_root_b)`

Illustrative envelope entry:

```json
{
  "kind": "receiptos.proof_entry.v0",
  "receipt_root": {
    "stored": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "computed": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "match": true,
    "status": "verified"
  },
  "merkle_proof": {
    "merkle_root": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "leaf_index": 0,
    "siblings": [
      "0x2222222222222222222222222222222222222222222222222222222222222222"
    ]
  },
  "sig_pq": {
    "type": "fips-204/ml-dsa-65",
    "signerHashed": "0x4e7bb6a3f4c36d9f0f6d7d4ab1b7c2ec7e297d51f6039f0a2f9d4e8c67ab3c10"
  },
  "verification_procedure": [
    "canonicalize the ReceiptOS evidence body",
    "recompute receipt_root_a",
    "require stored == computed",
    "hash leaf_0 with sibling leaf_1 in canonical Merkle order",
    "require derived merkle_root == stated merkle_root",
    "verify ML-DSA-65 signer metadata / signature material under the active pq-receipt-profile"
  ]
}
```

This second vector matters because the PROOF claim should survive a real
membership proof, not only the degenerate one-leaf case. The admissibility claim
is the same narrow claim as above: the receipt body recomputes correctly and is
correctly committed under the stated Merkle root.

