# Conformance Index

Canonical home for every ReceiptOS conformance artifact. One row per vector class.
Rule: an artifact has exactly one canonical home; everything else is a pointer.
This table mirrors the conformance vector table in the ReceiptOS preprint (§7.4) and must stay in sync with it.

| Vector class | Canonical home | Status | Notes |
|---|---|---|---|
| Canonicalization | this repo, main — reference path (src/receiptos/), browser verifier (docs/receipt-verifier/index.html), script surface (scripts/receiptos-verify.ts) | Current | Sorted-key canonicalization; byte-identical receipt_root across all three surfaces |
| Anchor stripping | this repo, main | Current | Anchoring is downstream of receipt_root derivation |
| One-leaf Merkle | this repo, main | Current | leaf_index=0, proof=[], merkle_root=receipt_root is valid membership |
| Three-case composed vector (genesis · linked · chain-tamper) | TMerlini recompute-kit, conformance row receiptos-wyriwe-composed + composed-vector gist | Current, cross-repo | Contributed by Pavlo Tvardovskyi (@pipavlo82); genesis encoding: sha256(utf8(decision_hex + "|" + prev_hex)), prev_hex = "" at genesis, delimiter always retained. Canonical home is the recompute-kit; this repo points, does not mirror |
| Pre-post gate composed run (pre-post-gate-composed) | External: babyblueviper1 gists — mode 1 chain-hash https://gist.github.com/babyblueviper1/9efc382d3156d1d3358845d9c0c6bc1b , anchor negatives + 5/5 re-run https://gist.github.com/babyblueviper1/e3dc422c7ce3d23af9ec610af37f56d4 (doc linter, mode 2: https://gist.github.com/babyblueviper1/227239606ea4c1715cb9ec95c4b08dd5 ) | Current, cross-repo | Fourth independently written implementation; rebuilt from the pinned spec alone without reading the other three. Positive: genesis · linked byte-identical on both real capsules. Negative: chain-tamper + all five fixtures/invalid/ rejections with matching reasons per EXPECTED.md. Scope note: live-RPC legs (wrong-chainid/wrong-network resolution on Sepolia) exceed reference scope and are labeled as such. Author: Fede (@babyblueviper1) |
| input_commitment seam | branch feat/reserved-slots-v0next — src/receiptos/fixtures/session-evidence.with-input-commitment.sample.json | Draft-scoped | Merges after ERC-8313 pins the sig_pq.signerHashed shape; do not treat as locked conformance evidence until re-verified on main |
| Tamper / missing-field negatives | this repo, main — src/receiptos/fixtures/invalid/ | Current | Five negative cases (malformed anchor result, mismatched root, wrong chain-id, wrong network, malformed txhash); agreement is on rejection semantics; expected rejection semantics pinned in fixtures/invalid/EXPECTED.md |
| Multi-leaf Merkle | — | Planned | Non-trivial path semantics; not yet locked conformance evidence |

## For tooling authors

A pre-post gate or recompute-and-diff tool should treat this file as the corpus manifest:
positive coverage = canonicalization + anchor-stripping + one-leaf rows from main, plus the three-case composed vector from the recompute-kit;
negative coverage = fixtures/invalid/ plus the chain-tamper leg of the composed vector.
Draft-scoped rows are opt-in and must be labeled as such in any conformance claim.
The adapter layer is documented separately in ADAPTERS.md and is by definition outside conformance scope: adapters shape what enters the evidence object, while conformance is defined over what happens after canonicalization. A gate never needs adapter awareness.

## Sync discipline

Any change to a canonical home, a status, or a vector's values requires updating this index in the same commit. If a cross-repo home moves (e.g., the recompute-kit row), update the pointer here — never fork the values into this repo without a pinned sync process.
