# Chronicle — the continuity layer (v0)

Chronicle is the layer where admissible receipts aggregate into history.

ReceiptOS answers one question about one record: *does this receipt recompute?*
Chronicle answers the question that follows: *what does a body of recomputed
receipts add up to over time?* A single receipt is worth something on day one.
A history of recomputable receipts is worth more every day it survives —
because nobody can rewrite it.

```text
Stealth executes. ReceiptOS proves. Chronicle explains.
```

Chronicle is the third layer of that map, and the link the boundary chain is
missing after settlement: continuity. Everything the chain proves up to that
point, it proves about one record — one action, one verdict, one anchor.
Chronicle is the thousandth receipt.

---

## Invariants

Formulations below follow the same lock discipline as
[CANONICAL_PRINCIPLES.md](./CANONICAL_PRINCIPLES.md). Use them verbatim.

1. **Chronicle consumes receipts after the gate.**
   A receipt either recomputes and enters, or it does not exist for Chronicle
   at all. There is no partial admission, no weighted admission, no
   probationary admission.

2. **Ternary at the check — binary at the door.**
   The check yields `valid` / `invalid` / `unverifiable`. Only `valid`
   produces a Chronicle entry. `unverifiable` is not a weaker record; it is
   no record. *Did not match* and *could not check* are different truths, and
   neither one enters history.

3. **Chronicle explains; it never judges.**
   Chronicle emits no score, rank, weight, tier, or probability — ever.
   Reputation systems MAY consume Chronicle artifacts as recomputable inputs;
   Chronicle never consumes or embeds their outputs. (This is invariant 1 of
   the canonical principles — "the receipt gates; it does not score" —
   carried one layer up.)

4. **History compounds because nobody can rewrite it.**
   Chronicle artifacts are append-only in semantics: every aggregate carries a
   deterministic root over canonicalized, sorted references, and every root
   recomputes offline from the artifact alone. Changing history means
   changing a root; changing a root is detectable by anyone.

5. **Continuity is receipt-derived, never asserted.**
   "This agent has N admissible receipts over this period" is a recomputation,
   not a claim. No trusted backend, no mutable counter, no private state —
   the same rule eligibility already follows.

---

## Artifacts (shipped in this repository)

Chronicle v0 is not a proposal. The artifact layer is implemented here:

| Artifact | Schema id | Source |
|---|---|---|
| Entry | `chronicle_entry.v0` | `src/receiptos/capsule/chronicle-portfolio-v0.ts` |
| Collection | `chronicle.collection.v0` | same |
| Portfolio | `chronicle_portfolio.v0` | same |
| Checkpoint | `chronicle_checkpoint.v0` | same |
| Position artifact | `chronicle.position_artifact.v0` | golden vectors |

### `chronicle_entry.v0`

One admissible receipt, as history sees it:

```text
schema                  "chronicle_entry.v0"
entry_id                string
source_system           producer system (from the proof object)
receipt_root            the recomputable root this entry stands on
proof_object_ref        ref → portable_proof_object.v0
evidence_capsule_ref    ref → evidence capsule
provenance_summary_ref  ref → provenance summary
created_from            source evidence ref | null
labels                  string[]
notes                   string | null
```

An entry never carries a verdict field. Existence *is* the verdict: the entry
is only created for a receipt that recomputed (invariants 1–2).

### Aggregation and roots

Collections aggregate entries; portfolios aggregate collections. Both derive
a deterministic root the same way:

```text
root = "sha256:" + sha256(canonicalize({
  <version field>,
  <id field>,
  <refs, lexicographically sorted>
}))
```

Sorting is part of the derivation: the same set of refs in any input order
yields the same root (see the `multiple-unsorted` golden vector). Verification
is local and total: `verify*` recomputes the root from the artifact's own
fields and compares — `ok` is byte-equality, nothing else.

### `chronicle_checkpoint.v0`

Collections are sets and therefore do not express a view in time. A checkpoint
is the addressable committed view: it binds one collection ref, the exact set
of entry refs present at the snapshot, an explicit `sequence`, and a
`prev_checkpoint` link that forms the checkpoint chain.

A decision or write carries `as_of { checkpoint_root, sequence }`, and a
verifier resolves **that** checkpoint, never the current one. Unknown or
missing `as_of` is `unverifiable`, never treated as agreement.

Open question, deliberately deferred: checkpoint creation policy, cadence, and
monotonicity enforcement between successive checkpoints are not part of the v0
artifact contract in this repository.

### Conformance

Golden vectors: `tests/fixtures/chronicle-root-golden-vectors.json`
(empty-refs, single-ref, multiple-unsorted, unicode-id).
Tests: `tests/receiptos/chronicle-entry-v0.test.ts`,
`chronicle-collection-v0.test.ts`, `chronicle-portfolio-v0.test.ts`,
`chronicle-root-golden-vectors.test.ts`.
End-to-end import path: [runnable_ecosystem_e2e_status_v0.md](./runnable_ecosystem_e2e_status_v0.md).

Independent reimplementation is invited on the same terms as the receipt
core: recompute the vectors, don't trust this file.

---

## What Chronicle is NOT

- **Not a score emitter.** If a design needs Chronicle to output a number
  that ranks agents, that design is a reputation system consuming Chronicle —
  name it as such and keep it downstream.
- **Not a reputation registry.** Track record here means *recomputable
  history*, never assigned standing.
- **Not a storage mandate.** Chronicle artifacts are portable objects;
  where they live (repo, chain, archive, drive) is an instantiation slot,
  exactly like the anchor (canonical principle 3 inherits).
- **Not chain-bound.** Roots recompute offline. An anchor for a portfolio
  root is pluggable and optional, never load-bearing for verification.
- **Not a quality opinion.** Chronicle records that work was done and proved;
  soundness of the work's *content* lives at the verification layer, and
  settlement/reputation consume verdicts from there.

---

## Position in the ecosystem

```text
producer evidence
  → ReceiptOS gate (recompute)          admissibility, binary
    → portable_proof_object.v0
      → chronicle_entry.v0              history, append-only
        → chronicle.collection.v0
          → chronicle_portfolio.v0      portfolio_root, recomputable
            → (optional) anchor          pluggable commitment
            → (downstream) reputation    MAY consume, never feeds back
```

Upstream contract: Chronicle consumes `portable_proof_object.v0` refs and the
`receipt_root` they stand on — nothing producer-specific crosses the boundary
(see [PRODUCER_NEUTRAL_PROOF_BOUNDARY.md](./PRODUCER_NEUTRAL_PROOF_BOUNDARY.md)).

Downstream contract: any system may read Chronicle artifacts and recompute
their roots. No system may write history except by producing an admissible
receipt first.

---

## Status

- Artifact layer (`entry` / `collection` / `portfolio` + roots + golden
  vectors): **implemented in this repository.**
- Layer specification: preprint §10.7 (continuity layer); this document is
  its repo-resident form. https://doi.org/10.5281/zenodo.21402444
- Open, deliberately: retention/pruning profiles, epoch batching for
  high-volume producers, portfolio-root anchoring profile. Each follows the
  pinned-input discipline established for `ruleset_version` — declared inside
  the definition, hashed over the definition.
  
