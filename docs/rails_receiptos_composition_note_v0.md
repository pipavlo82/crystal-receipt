# Composition Note — ReceiptOS → RAILS PROOF Entry v0

## 1. What is being composed

A ReceiptOS receipt can drop into a RAILS Evidence Envelope as a **PROOF-class
item** when the consumer verifies three things together:

1. the receipt body recomputes to the same `receipt_root`;
2. the `receipt_root` closes under the stated Merkle path to the committed
   `merkle_root`;
3. signer / verifier metadata is carried in the reserved PQ slot shape
   (`sig_pq.type + signerHashed`).

## 2. What is not being redefined

This composition note does **not** redefine:

- the RAILS Obligation Object,
- the RAILS Clearing Decision,
- the RAILS Settlement Instruction,
- or the ReceiptOS root derivation rules.

ReceiptOS contributes a proof-bearing evidence item.
RAILS still decides what obligations require and what downstream settlement
follows.

## 3. Why the item can be PROOF-class

RAILS §5.1 places `PROOF` at the top of the admissibility lattice for
cryptographic proofs of correctness.

A ReceiptOS item qualifies when the consumer does not merely ingest a receipt as
an external attestation, but instead runs the deterministic proof procedure:

- canonicalize the evidence body,
- recompute `receipt_root`,
- require stored == computed,
- verify the Merkle path,
- then evaluate PQ signer metadata under the selected profile.

That makes the item a proof artifact, not just a signed receipt.

## 4. Why this does not collapse into REC / ATT

RAILS §5.6 says stock receipt verifiers usually rest on `REC` or `ATT` bases.
That remains true for ordinary receipts.

The ReceiptOS mapping avoids that downgrade only when the consumer treats the
item as a **cryptographic proof artifact with explicit replay steps**. If an
implementation ingests it as “just another external receipt,” then `PROOF`
would be an overclaim.

## 5. Genesis / single-leaf case

The canonical one-leaf case must remain explicit:

- `merkle_leaf_index = 0`
- `merkle_proof = []`
- `merkle_root = receipt_root`

An empty sibling list is not absence of proof; it is the single-leaf proof
instance.

## 6. Practical outcome

So the composition is simple:

- ReceiptOS supplies the recomputable root and Merkle proof discipline.
- `pq-receipt-profile` supplies the long-lived signer metadata slot.
- RAILS consumes the resulting object as a PROOF-class Evidence Envelope item.

No change to obligation semantics.
No change to clearing semantics.
No change to settlement semantics.
Only a precise proof-bearing envelope entry.

## 7. Finding from RAILS worked examples

RAILS §8 does not contradict the mapping, but its canonical worked scenario is
ATT-floor, not PROOF-floor. The examples show admissibility-floor enforcement,
not proof-native receipt classification. That means this mapping is compatible
with the paper, but it is not already exemplified by its worked scenarios.

