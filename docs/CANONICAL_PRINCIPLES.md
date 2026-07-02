# ReceiptOS — Canonical Principles

Formulations locked from the Ethereum Magicians ReceiptOS thread and the
Composition Note (Step 5). Use these verbatim in READMEs, specs, and replies.

1. The receipt gates; it does not score.
 Step 5 determines admissibility only — never soundness, quality, score,
 payout, or reputation weight.

2. Canonicalization is a determinism contract.
 Same action → same bytes → same hash for any party. Orthogonal to
 execution ordering; it sits beside an execution layer, not inside it.
 (Formulation credit: TMerlini, ReceiptOS thread.)

3. The receipt recomputes; the anchor is pluggable.
 Conformance tests the recompute, never the anchor. The anchor is a
 commitment target — an instantiation slot, not a defined meaning.

4. Eligibility is receipt-derived, never issuer-approved.
 A verifier recomputes it from public commitments alone — no trusted
 backend, no mutable flag, no private state.

5. Attribution is scheme-agnostic and long-lived.
 The capsule reserves the signature slot shape (sig_pq.type +
 signerHashed); which scheme fills it is an implementation profile.
 Hashes survive Q-day as-is; signatures need the slot.
 See: pq-receipt-profile.
