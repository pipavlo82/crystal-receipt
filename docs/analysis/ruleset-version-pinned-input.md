# ruleset_version as pinned input in recompute trace

**Status:** DRAFT for discussion — analysis only, no kit changes proposed here. Carrier resolved 2026-07-11 (see §4).  
**Origin:** General thread 2026-07-10 (Fede's catch, Pavlo's spec, Merlini's invariants).  
**Findings verified against:** `trustless-ai/recompute-kit` clone, 2026-07-10.

## 1. Requirement

The recompute trace/commitment **MUST** take `ruleset_version` as a pinned input folded into the recomputed hash: a verdict produced under ruleset vX only reproduces under vX; recomputing under vY yields a different commitment — a visible mismatch ("this is a different claim now"), never a silent reinterpretation. Version **MAY** also be surfaced in renders for legibility, but the load-bearing copy lives inside the commitment, never as sidecar metadata.

## 2. Current state (verified, path:line)

Commitment construction is currently open-ended and version-blind. In `trustless-ai/recompute-kit` `bin/recompute-step:183-186`, the receipt-hash recipe computes:

- `unsigned = {k: v for k, v in r.items() if k not in ('hashes', 'signature')}`
- `decision = sha256(canon(unsigned))`
- `receipt = sha256(decision + "|" + prev)`

No version identifier of any kind enters the hashed body there.

The field set is therefore **OPEN**: the hash covers whatever top-level keys the input JSON carries, minus `hashes` and `signature`; no enumerated legitimate-field schema exists in that path.

Versioning today is sidecar-only. In `trustless-ai/recompute-kit` `conformance/agent-flow.vectors.json:2-4`, the vectors file carries a file-level `"version": "0.1"`, and `bin/conformance:101-103` displays it. That is exactly the adjacent-metadata pattern this analysis is trying to close: version exists, but not inside the committed object.

Tri-state verdict is already derived outside the commitment and should stay there. In `trustless-ai/recompute-kit` `mcp/server.py:41-52`, the MCP layer maps recipe exit codes to `verified-good` / `verified-bad` / `unverifiable`, with fail-closed gate semantics for irreversible actions. The point here is not to move verdict into the hash; it is to move the **version of the rules under which the verdict was computed** into the hash.

Recipe identity today is only a string name. In `trustless-ai/recompute-kit` `bin/recompute-step:22-24`, dispatch is `recipe="${1:-list}"` followed by `case "$recipe" in`. There is no content hash, no declared ruleset id, and nothing that currently serves as a durable `ruleset_version` anchor.

Conformance rows are version-less. In `trustless-ai/recompute-kit` `conformance/README.md:44-52`, the cross-repo conformance table records vectors, independent reproductions, and pointers, but no row pins which kit or recipe version produced it.

## 3. Proposed placement

Add `ruleset_version` as a required top-level key of the **unsigned committed object**, so it flows through the existing `canon(unsigned)` path with zero mechanism change. The strip-set `('hashes', 'signature')` stays as is; the change is only that `ruleset_version` becomes one of the keys that survives into the canonicalized body and therefore into the recomputed digest.

There is precedent for this shape in the ReceiptOS reference. In `crystal-receipt` `src/receiptos/schema/types.ts`, the schema id lives inside the hashed evidence object itself (`schema` inside `HandoffEvidence`); changing that field changes the root. Verified 2026-07-10: schema identity is treated as part of the committed object, not display-only metadata.

A companion move is worth flagging, though not decided here: closing the open field-set by defining an enumerated legitimate-key schema per recipe would solve pinning and field discipline in one gesture. That is an option to surface explicitly, not a conclusion forced in this note.

## 4. Version carrier — RESOLVED (Merlini, 2026-07-11)

Decision: hybrid, with the inversion that makes it safe. The recipe/ruleset definition declares its own semver internally (`version: <semver>` inside the definition); `ruleset_version` — the committed, top-level unsigned key — is the content-hash taken over that definition: `ruleset_version = sha256(canon(recipe_definition))`. The semver is thereby covered by the hash — legible (a lens reads it off the recipe at that hash and renders "verified under receiptos-c14n-v0 / vX") but unalterable without moving the hash. Rationale kept verbatim: "A semver label is a promise; a content-hash is a proof. The committed copy is the hash, full stop." Model precedent: git — the commit sha binds, the tag reads; proven prior art plus exactly one rule.

How this collapses the §6 cases: (a) same → same hash; (b) bump → recipe content changes → different hash → visibly a different claim; (c) sidecar tamper becomes unforgeable — the label cannot change without moving the hash, and an edited display copy disagrees with the committed hash's declared semver → caught on legibility-vs-commitment consistency.

Sub-open 1 resolved — note vs kit versioning: independent, composed at commit time. The correspondence note (verdict vocabulary) and kit recipes revise on their own cadence, each carrying its own content-hash; a verdict's `ruleset_version` is the hash of the effective ruleset it actually ran under — if that bundles the note's vocabulary, its hash folds in.

Sub-open 2 resolved — migration for version-less rows (incl. `receiptos-wyriwe-composed`): backfill each row with the content-hash of the ruleset as it was at the commit that produced it — pin to history, don't retro-relabel. Where the historical ruleset is ambiguous, mark the row unverifiable/legacy until re-run under a pinned version. Principle recorded verbatim: "Honest over tidy."

## 5. Failure mode (why sidecar fails)

If version sits only next to the claim hash, a later ruleset revision can reinterpret an old claim as if it always meant the new thing. Nothing in the commitment itself says, "this hash was produced under the old rules," so the semantic substitution can happen silently. The committed copy is what makes that reinterpretation visible: the old claim reproduces only under the old ruleset label, and a new ruleset yields a different commitment instead of a quietly reused one. This is not hypothetical in the abstract; it tracks a real class of failure Fede reported seeing live in a peer contract, where sidecar versioning left room for reinterpretation after the fact.

## 6. Three-case vector sketch

Structure only for now; values remain TBD with Merlini.

- **(a) same record + same `ruleset_version`** → reproduces.
- **(b) same record + bumped `ruleset_version`** → different commitment, surfaced explicitly as “different claim.”
- **(c) sidecar tamper** → version label altered post-hoc while commitment remains unchanged; detected because the committed copy disagrees.

This mirrors the WYRIWE-style genesis / linked / tamper pattern: one stable positive case, one version-shift case that must move the commitment visibly, and one post-hoc metadata-tamper case that must fail legibility-vs-commitment consistency.

## 6a. First adopter-in-waiting

`trustless-ai/recompute-kit` commit `4e72169` added recipe `receiptos/canonicalize` (profile `receiptos-c14n-v0`: JCS RFC 8785 by reference, top-level anchor-strip the sole delta) with the §2.8 π vector as its golden vector (45 bytes ≠ 44 chars, the literal-UTF-8 tripwire); the kit is thereby a conforming `receiptos-c14n-v0` implementation per Definition 6. The recipe is deliberately version-less and slated as the first adopter of `ruleset_version` under the migration path above.

## 7. Side-note for the kit

Outside this note’s direct scope but worth recording: `trustless-ai/recompute-kit` `conformance/README.md:51` still says “a fourth implementation.” That wording predates the agreed down-count to three independently authored implementations, because the browser verifier and script path are surfaces of the reference rather than separate authored implementations under the current `crystal-receipt` `docs/CONFORMANCE_INDEX.md` reading. This is just a note to keep the adjacent kit wording aligned when convenient.

Update 2026-07-11: Merlini has taken this fix (the line is his) — aligning to the three-independently-authored reading.
