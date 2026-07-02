# Crystal Receipt — Schema Overview (external orientation)

One page for readers arriving from the Ethereum Magicians ReceiptOS thread
or the composition note. What the capsule schema contains today, what is
pinned but not yet landed, and how this format relates to receiptos-mvp.

## What the schema contains today (v0, shipping)

schemas/evidence-capsule.v0.schema.json — eight required top-level objects:

| Object | Role |
|---|---|
| schema | Format identifier + version |
| action | What happened (action-type agnostic) |
| evidence | The captured evidence body |
| receipt_root | {stored, computed, match, status} — the recompute core |
| proof_refs | {merkle, anchor} — anchor is a pluggable slot, not a fixed chain |
| verifier_result | {ok, status} — admissibility verdict, never a score |
| capsule | {sections} — the sectioned capsule body |
| replay_manifest | What a verifier needs to recompute from scratch |

Derivation: receipt_root = sha256(canonicalize(stripAnchor(evidence))) —
the anchor field is always excluded so the root never depends on its own
anchored value. Canon = sorted keys, compact separators, UTF-8.
See docs/RECEIPT_DERIVATION.md.

## Pinned in the EM thread, landing in v0.next

Two reserved slots, agreed publicly (ReceiptOS thread + composition note
Step-3×Step-5 row) but not yet in the shipping schema:

- **input_commitment** — named sub-object carrying WYRIWE's
 raw_input_hash + sanitization_pipeline_hash verbatim, with
 requires: erc-8299. Checkable in isolation before the rest of the
 receipt. Conformance vector already green across three independent
 implementations (see the composed-vector gist).
- **sig_pq** — scheme-agnostic post-quantum attestation slot
 (sig_pq.type + signerHashed). The slot's *shape* is deliberately
 deferred to the ERC-8313 author; the reserve-the-slot principle is
 agreed. Reference instantiation (ML-DSA-65, costed):
 [pq-receipt-profile](https://github.com/pipavlo82/pq-receipt-profile).

## Two capsule formats, one discipline

| | crystal-receipt (this repo) | receiptos-mvp |
|---|---|---|
| Chain model | Merkle root + pluggable anchor | Hash-chain (prev_receipt_sha256) |
| Receipt hash | receipt_root over canonicalized evidence | sha256(utf8(decision_hex + "\|" + prev_hex)) |
| Genesis case | n/a (no chaining) | prev_hex = "", delimiter retained — pinned by elimination |
| Where pinned | docs/RECEIPT_DERIVATION.md | recompute-kit receiptos/receipt-hash + composition note + vector gist |

Both formats hold the same principles: the receipt gates, it does not
score; the receipt recomputes, the anchor is pluggable; eligibility is
receipt-derived, never issuer-approved. See docs/CANONICAL_PRINCIPLES.md.
