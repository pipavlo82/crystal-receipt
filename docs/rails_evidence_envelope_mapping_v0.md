# RAILS PROOF-Class Mapping v0

This note maps the current ReceiptOS / Crystal Receipt proof substrate into a
RAILS Evidence Envelope entry, targeting the **PROOF** admissibility class
from RAILS §5.1 (`SELF ⪯ SIGN ⪯ {WIT, REC} ⪯ ATT ⪯ PROOF`).

Scope boundary: this document maps a **receipt proof artifact** into an
Evidence Envelope item. It does **not** redefine the RAILS Obligation Object,
Verification Mesh, Clearing Decision, or Settlement Instruction.

## 1. Authoritative ReceiptOS fields in this repo

For this mapping draft, the authoritative receipt proof fields live in
`crystal-receipt`, not `pq-receipt-profile`:

- `schemas/evidence-capsule.v0.schema.json`
  - `receipt_root.{stored,computed,match,status}`
  - `proof_refs.merkle.{present,status}`
  - `proof_refs.anchor.status`
- `src/receiptos/fixtures/session-evidence.with-local-merkle.sample.json`
  - `anchor.receipt_root`
  - `anchor.merkle_root`
  - `anchor.merkle_leaf_index`
  - `anchor.merkle_proof`
- `src/receiptos/verify/verify-receipt.ts`
  - local recompute of `receipt_root`
- `src/receiptos/merkle/local-merkle.ts`
  - one-leaf local Merkle proof construction / verification

`pq-receipt-profile` remains authoritative only for the **PQ signature slot
principle** (`sig_pq.type + signerHashed`), not for `receipt_root` or Merkle
semantics.

## 2. RAILS constraints that matter

RAILS §5.1 defines **PROOF** as a “cryptographic proof of correctness,” above
`ATT`, and says the admissibility classes are a **partial order**, not a score.
RAILS §5.6 separately says a stock **receipt verifier** typically carries a
basis class of `REC` or `ATT`, depending on receipt origin.

That creates the key discipline for this mapping:

- A ReceiptOS item is **not** `PROOF` merely because it is a receipt.
- A ReceiptOS item reaches `PROOF` only when the envelope entry contains a
  **cryptographically checkable proof artifact plus a deterministic
  verification procedure**.
- Therefore the RAILS consumer must classify the item by the proof it verifies,
  **not** by the generic “receipt verifier” bucket from §5.6.

This is a mapping choice, not a rewrite of RAILS: the item remains an Evidence
Envelope entry; the Mesh / Clearing Decision stay outside scope.

## 3. Target Evidence Envelope entry shape

A ReceiptOS item enters the RAILS Evidence Envelope as a single proof-carrying
entry with three layers:

1. **Canonical receipt claim**
   - the recomputable `receipt_root`
2. **Membership / commitment proof**
   - the Merkle path proving how that `receipt_root` sits under the committed
     `merkle_root`
3. **Signer / verifier metadata**
   - ML-DSA-65 profile metadata carried in the reserved `sig_pq` slot shape

Expressed schematically:

```json
{
  "kind": "receiptos.proof_entry.v0",
  "receipt_root": {
    "stored": "0x…",
    "computed": "0x…",
    "match": true,
    "status": "verified"
  },
  "merkle_proof": {
    "merkle_root": "0x…",
    "leaf_index": 0,
    "siblings": []
  },
  "sig_pq": {
    "type": "fips-204/ml-dsa-65",
    "signerHashed": "0x…"
  },
  "verification_procedure": [
    "canonicalize evidence under ReceiptOS rules",
    "recompute receipt_root",
    "require stored == computed",
    "verify Merkle path from receipt_root to merkle_root",
    "verify ML-DSA-65 metadata / signature profile out-of-band or in-profile"
  ]
}
```

The shape above is an **envelope-entry projection**, not a replacement for the
native ReceiptOS JSON or the RAILS Envelope object.

## 4. Exact field mapping (no shorthand)

| ReceiptOS source | RAILS Evidence Envelope entry field | Mapping rule |
|---|---|---|
| `receipt_root.stored` (or `anchor.receipt_root` in source evidence) | `entry.receipt_root.stored` | Copy verbatim as 32-byte `0x` hex root. |
| `receipt_root.computed` (from local recompute) | `entry.receipt_root.computed` | Copy verbatim; must be produced by the consumer or verifier from canonical evidence, not trusted from issuer prose. |
| `receipt_root.match` | `entry.receipt_root.match` | `true` iff `stored == computed`. |
| `receipt_root.status` | `entry.receipt_root.status` | `verified` iff `stored == computed`; otherwise `mismatch` or `missing`. |
| `anchor.merkle_root` | `entry.merkle_proof.merkle_root` | Copy verbatim as commitment root. |
| `anchor.merkle_leaf_index` | `entry.merkle_proof.leaf_index` | Copy verbatim as zero-based index. |
| `anchor.merkle_proof[]` | `entry.merkle_proof.siblings[]` | Copy verbatim, preserving order. Empty list is meaningful; see genesis case below. |
| `proof_refs.merkle.present` | `entry.proof_status.merkle_present` | `true` only when a Merkle proof object is actually carried. |
| `proof_refs.merkle.status` | `entry.proof_status.merkle_status` | Mirrors Merkle verification result (`valid`, `invalid`, `missing`, `pending`). |
| `proof_refs.anchor.status` | `entry.proof_status.anchor_status` | Preserve anchor-state semantics only; do not reinterpret as settlement or adjudication. |
| Reserved `sig_pq.type` | `entry.sig_pq.type` | Use profile value for ML-DSA-65, e.g. `fips-204/ml-dsa-65`. |
| Reserved `sig_pq.signerHashed` | `entry.sig_pq.signerHashed` | Copy / derive exactly as the profile’s signer hash slot; this is signer metadata, not the root itself. |
| ReceiptOS recompute procedure | `entry.verification_procedure[]` | List deterministic replay steps explicitly so the RAILS consumer verifies, not trusts. |

## 5. Why this is PROOF, not ATT / REC / SIGN

Per RAILS §5.1, `PROOF` is reserved for a **cryptographic proof of
correctness**. This mapping qualifies only when all of the following are true:

1. The consumer **recomputes** the canonical `receipt_root` from the evidence
   object under ReceiptOS canonicalization rules.
2. The recomputed root equals the stored root.
3. A Merkle path verifies from that root to the claimed `merkle_root`.
4. The proof artifact is carried with an explicit verification procedure.
5. Any ML-DSA-65 signature metadata is treated as **signer / provenance
   metadata**, not as a substitute for steps 1–4.

Why it is **not `SIGN`**:
- a signature alone is non-repudiation, not correctness.

Why it is **not `REC`**:
- the class is not resting on “a signed receipt from a non-interested external
  system” alone.

Why it is **not `ATT`**:
- the class is not resting on TEE hardening alone.
- `ATT` can carry the runtime that emitted the evidence, but the top-class claim
  here comes from the **cryptographic proof path** (`recompute + Merkle
  verification`), which is stronger than merely trusting the runner.

Operationally: the ML-DSA-65 slot strengthens attribution longevity, but the
**PROOF** classification is earned by the deterministic proof object and its
verification procedure.

## 6. Verification procedure the RAILS consumer runs

A compliant Evidence Envelope consumer should verify the item in this order:

1. Parse the native ReceiptOS evidence object.
2. Canonicalize it under the ReceiptOS rules used by local recompute.
3. Compute `receipt_root_computed = H(canonicalized_evidence_without_anchor)`.
4. Compare `receipt_root_computed` to `receipt_root_stored`.
5. If unequal: classify the item below PROOF and stop.
6. Verify the Merkle path:
   - leaf = `receipt_root_computed`
   - index = `merkle_leaf_index`
   - siblings = `merkle_proof[]`
   - expected root = `merkle_root`
7. If the path fails: classify below PROOF and stop.
8. Verify `sig_pq` metadata / signature material according to the
   ML-DSA-65 profile in force.
9. If steps 1–8 succeed, the envelope entry is a candidate `PROOF`-class item
   for the narrow claim: **this receipt body recomputes and belongs to this
   committed Merkle root**.
10. The RAILS consumer should classify it as `PROOF` only when its envelope
    policy treats this replayable cryptographic artifact as a proof item rather
    than as a generic receipt-verifier input.

The narrow claim matters. The entry proves receipt correctness / commitment
binding. It does **not** by itself prove that the broader obligation was
satisfied; that remains RAILS Mesh / Clearing Decision territory.

## 7. Genesis / empty case (must be pinned, not implied)

The one-leaf local Merkle case is the explicit genesis / empty-sibling case.
It must be encoded, not hand-waved:

- `merkle_leaf_index = 0`
- `merkle_proof = []`
- `merkle_root = receipt_root`

In this case the verification procedure is still non-empty:

1. recompute `receipt_root`
2. require stored == computed
3. verify that the one-leaf Merkle construction yields `merkle_root`
4. require `merkle_root == receipt_root`

So the empty sibling list is **not** “missing proof.” It is the canonical
single-leaf proof case.

## 8. What the ML-DSA-65 field does — and does not do

The ML-DSA-65 slot maps into RAILS as signer / verification metadata for the
entry:

- `sig_pq.type` tells the consumer which PQ signature profile is in force.
- `sig_pq.signerHashed` binds the signer identity slot to the PQ profile.

This field does **not** change the ReceiptOS root derivation and does **not**
upgrade a non-proof item into `PROOF` on its own. It is attribution metadata,
not a substitute for recomputation or Merkle verification.

## 9. RAILS §8 findings / tensions

### 9.1 No direct contradiction

RAILS §8 does not contradict this mapping. Its worked scenario is about how the
Mesh enforces an admissibility floor and excludes a weak semantic basis.
Nothing in §8 forbids a proof-carrying Evidence Envelope item.

### 9.2 But §8 does not instantiate PROOF

The canonical worked scenario in §8 sets the operative fee-release floor to
`ATT`, and the concrete evidence items are `ATT`, `WIT`, and `SELF`.
It does **not** show a `PROOF`-class item or a proof-native verifier class.
So §8 cannot be cited as a worked example of this mapping; it only confirms the
floor-enforcement behavior around lower classes.

### 9.3 Important tension with §5.6

RAILS §5.6 says a stock **receipt verifier** typically has basis class `REC` or
`ATT` depending on origin. Therefore, if an implementation ingests a ReceiptOS
object merely as “an external receipt,” it should **not** be classified as
`PROOF`.

This mapping stays sound only if the ReceiptOS item is treated as a
**cryptographic proof artifact with a deterministic verification procedure**,
not as a generic receipt-verifier input. That is why step 9 above is phrased as
a classification condition, not an automatic upgrade rule.

