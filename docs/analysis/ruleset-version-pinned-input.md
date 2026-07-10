# ruleset_version as pinned input in recompute trace

**Status:** DRAFT for discussion — analysis only, no kit changes proposed here.  
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

## 4. Version carrier — the main open question, stated not answered

The main open design question is what exactly `ruleset_version` should carry.

Candidate (a): a content-hash of the recipe file. That is stronger and self-verifying: the label itself is recomputable.

Candidate (b): a declared semver. That is more readable, but it needs governance and cannot self-authenticate on its own.

A hybrid worth discussing is: content-hash as the load-bearing value inside the commitment, semver as a display alias around it.

Also open:

- whether the eligibility↔verdict correspondence note versions independently of the kit;
- what the migration story is for existing conformance rows, all of which are currently version-less, including `receiptos-wyriwe-composed`.

## 5. Failure mode (why sidecar fails)

If version sits only next to the claim hash, a later ruleset revision can reinterpret an old claim as if it always meant the new thing. Nothing in the commitment itself says, "this hash was produced under the old rules," so the semantic substitution can happen silently. The committed copy is what makes that reinterpretation visible: the old claim reproduces only under the old ruleset label, and a new ruleset yields a different commitment instead of a quietly reused one. This is not hypothetical in the abstract; it tracks a real class of failure Fede reported seeing live in a peer contract, where sidecar versioning left room for reinterpretation after the fact.
