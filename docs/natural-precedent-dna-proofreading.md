# Natural Precedent Note: DNA Proofreading as the Biological Analog of Evidence Capsule Model

## Context

The Evidence Capsule Model (ReceiptOS core design — payload → policy boundary → authorization → controlled execution → evidence record → receipt root → anchor → verification) was developed independently, but its underlying intuition maps closely onto a well-known biological mechanism: DNA replication proofreading and mismatch repair.

This note captures the analogy for reference in future strategic, technical, or communications work (e.g. positioning language, outreach, conceptual framing).

## The Biological Mechanism

Layer 1 — Polymerase proofreading (in-line, real-time check):
DNA polymerase does not merely copy each base and move on. Immediately after adding a nucleotide, it uses 3'→5' exonuclease activity to check whether the just-copied base is correctly paired. If it detects an error, it stops, excises the incorrect base, and corrects it before continuing synthesis.

Layer 2 — Mismatch repair (independent, post-hoc re-verification):
After replication completes, a separate, independent system (mismatch repair, MMR) re-scans the entire newly synthesized strand — checking it again, independently of the first pass, before the copy is treated as reliable.

Key property: Neither layer *trusts* that the copy is correct because a competent process produced it. Each layer *independently re-derives* whether the copy matches what it should be — and only accepts it if that re-derivation succeeds.

Biology does not preserve trust. Biology preserves the ability to re-derive correctness.

A copied strand is not accepted because polymerase is trusted. It is accepted because correctness can be independently re-established.

## The Structural Parallel to ReceiptOS

| DNA Proofreading | ReceiptOS / Evidence Capsule Model |
|---|---|
| Polymerase checks base before proceeding | Local recompute of receipt_root before accepting a claim |
| Mismatch repair re-verifies the whole strand independently | Independent party recomputes the full receipt / Merkle path, not just trusts the issuer |
| Error found → excise and correct, do not propagate | Recompute mismatch → classify below admissibility floor (e.g. not PROOF), do not propagate as valid |
| No central "quality score" — binary pass/fail per base | "Gates, not scores" — receipts are admissible or not, not probabilistically ranked |
| Verification is intrinsic to the copying process itself, not bolted on after | Verification is designed into the receipt structure itself (recomputable by construction), not an external audit layer |

## Why This Matters as a Framing Device

1. Long before digital trust systems existed, biology converged on the same solution: independent re-verification. "Recompute, not trust" is not a novel engineering preference — it is one of the oldest known solutions to the problem of faithfully propagating information under the threat of corruption.

2. It reinforces the "gates, not scores" principle with a natural precedent, which is useful in technical conversations touching on emergent competence, reliability gradients, or biological analogies for computational trust.

3. It distinguishes real-time vs. independent re-verification as two necessary layers — a distinction that maps onto the difference between an issuer's own internal checks (polymerase-level) and a third party's independent recompute (mismatch-repair-level, i.e. RAILS' PROOF class or ReceiptOS's verifier role).

In one line: ReceiptOS does not ask anyone to trust that a receipt is correct because a competent system produced it. It asks only that correctness remain independently re-derivable — the same bar biology has held for three billion years.

## The Authority/Provenance Bridge (to Chronicle)

Biology does not preserve authority. It preserves lineage.
ReceiptOS does not preserve authority. It preserves provenance.

