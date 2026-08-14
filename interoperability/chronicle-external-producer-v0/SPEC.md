# Chronicle External Producer Interoperability v0

Frozen claim: `external_producer_chronicle_interoperability`

## Normative purpose

This package proves that a standalone Python implementation, importing zero
ReceiptOS production code, can independently construct Chronicle
`Collection`/`Portfolio`/`Checkpoint` objects whose exact bytes, roots, and
pairwise relationships are accepted both by ReceiptOS's real, unmodified
Chronicle primitives and by a second, independent Python verifier.

It does not change implementation semantics, does not add a third
cross-object evaluator, and does not reopen the two already-merged pairwise
Transformation Stability profiles or the frozen
`conformance/cross-object-transformation-stability-v0/` package. It
documents, in a language-portable form, three facts that were previously
implicit or JS-name-referenced only:

1. the exact byte-level Collection-ref escaping algorithm;
2. the exact, textually-distinct comparator semantics for
   `artifact_refs`/`collection_refs` vs. `entry_refs`, bounded to a v0
   ASCII identifier grammar rather than claimed for general Unicode;
3. the exact Collection/Portfolio/Checkpoint construction-time applicability
   rules, which previously existed only in TS source.

## Package scope

```
interoperability/chronicle-external-producer-v0/
  SPEC.md
  contract.json
  manifest.json
  producer_reference.py
  verify_output.py
  fixtures/input-seed.json
  expected/positive/{producer-manifest,collections,portfolio,checkpoint}.json
```

`producer_reference.py` is a genuine external producer: Python stdlib only,
zero ReceiptOS imports, no Node/Bun invocation, no Git access, no network.
Given `fixtures/input-seed.json` and a `--scenario` name, it independently
computes every Chronicle root and Collection ref from scratch and writes a
deterministic four-file package. `expected/positive/` is exactly one frozen
run of `--scenario main` -- the committed baseline that proves determinism,
not a template the producer reads from.

`verify_output.py` is a **separate implementation** -- it imports nothing
from `producer_reference.py` and nothing from ReceiptOS. It independently
re-derives canonicalization, root formulas, ref derivation, and
duplicate-preserving multiset comparison, and treats every producer-authored
field as untrusted, including file digests (transport-integrity only,
never semantic validity).

A third acceptance path exists in the focused ReceiptOS test: the real,
unmodified `verifyChronicleCollectionV0` / `verifyChroniclePortfolioV0` /
`verifyChronicleCheckpointV0` are run directly against the producer's raw
JSON bytes. Agreement across all three (ReceiptOS, the independent Python
verifier, and -- supplementary only -- the existing frozen flat evaluator's
identity-roundtrip classification) is the actual interoperability proof.
**An artifact is never accepted merely because the identity-transform
evaluator classifies it `stable`** -- the primary acceptance predicate is
the direct one: every local verifier `ok: true`, the derived/stored
Portfolio ref multisets equal, the Checkpoint ref present in the derived
multiset, and applicability satisfied.

## Gap 1: Collection-ref derivation, byte-exact

The frozen formula is `"/collection/" + encodeURIComponent(collection_id)`.
`encodeURIComponent` is a JS-specific function name, not a portable
specification. Its exact behavior: characters
`A-Z a-z 0-9 - _ . ! ~ * ' ( )` are left literal; every other byte of the
UTF-8 encoding of the input is percent-encoded as `%XX` (uppercase hex).

This is **not** the same as Python's `urllib.parse.quote(id, safe="")` with
default settings -- confirmed empirically during design:

```
encodeURIComponent("a b'c(d)e!f*g/h")      -> "a%20b'c(d)e!f*g%2Fh"
urllib.parse.quote("a b'c(d)e!f*g/h", "")  -> "a%20b%27c%28d%29e%21f%2Ag%2Fh"
```

`quote()`'s default always-safe set is only letters/digits/`_.-~`, so it
percent-encodes `! * ' ( )`, which `encodeURIComponent` does not. Both
`producer_reference.py` and `verify_output.py` implement the exact
unreserved-character set above from scratch; `contract.json` pins the
self-test pair. This self-test string is deliberately outside the
normative identifier grammar below -- it exercises the escaping algorithm
itself, not a claim that such identifiers are part of this package's
interoperable matrix.

## Gap 2: comparator distinction, bounded to ASCII

Two textually distinct comparators exist in the committed implementation:

- `sortArtifactRefs` / `sortCollectionRefs` use `String.prototype.localeCompare`
  -- locale/ICU-dependent, not portably specified in the general case.
- `sortEntryRefs` (Checkpoint) uses plain codepoint order (`<`/`>`) for
  canonical-order comparison, but `checkpoint_root` itself is always computed
  over **stored** `entry_refs` order, never re-sorted.

Because general non-ASCII `localeCompare` behavior is not guaranteed
portable even across JS engines, this package does **not** claim general
Unicode interoperability. v0 restricts every normative identifier to:

```
^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$
```

lowercase ASCII alphanumerics with internal hyphens only. `contract.json`
enumerates every normative string actually used across the full positive
and negative matrix (`comparators.normative_strings`), and the focused
ReceiptOS test sorts that exact string list two ways -- Python's plain
`sorted()`, and the real, unmodified `sortArtifactRefs`/`sortCollectionRefs`
imported directly from the frozen TS source -- and asserts byte-for-byte
agreement. This is an empirical agreement proof over a closed, finite set,
not a general portability theorem.

## Gap 3: applicability rules, written down

Previously reachable only by reading `chronicle-portfolio-v0.ts`:

- a Collections/Portfolio bundle requires `collections.length >= 1`
  (`createChroniclePortfolioV0`'s own throw), else
  `out_of_domain / chronicle_collections_portfolio_empty`;
- Checkpoint `sequence` must be a non-negative integer;
- `sequence === 0` requires `prev_checkpoint === null` (genesis);
- `sequence > 0` requires a non-null `prev_checkpoint` (continuation);

else `out_of_domain / chronicle_checkpoint_shape_invalid`
(`validateChronicleCheckpointShape`'s own rule). This package documents
these; it does not change them.

## Trust boundary

Three tiers, kept structurally separate:

1. **Producer output** -- untrusted claims and object bytes:
   `producer-manifest.json`, `collections.json`, `portfolio.json`,
   `checkpoint.json`. `producer-manifest.json` may carry an optional,
   explicitly-labeled `claims` object (the producer's own, possibly wrong,
   self-belief) -- never read as evidence by either verifier.
2. **ReceiptOS verifier output** -- independently recomputed local and
   pairwise validity, via the real `verifyChronicleCollectionV0` /
   `verifyChroniclePortfolioV0` / `verifyChronicleCheckpointV0`.
3. **Independent Python verifier output** (`verify_output.py`) -- a second,
   from-scratch implementation of the same acceptance decision.

Filenames in the topology are fixed and never producer-chosen -- this
eliminates path traversal and Windows filename case-collision by
construction rather than by runtime policy alone.

## Positive matrix (order normative)

| case | scenario | expected |
|---|---|---|
| `collection_checkpoint_locally_valid` | `main` | `stable` |
| `collections_portfolio_locally_valid` | `main` | `stable` |
| `two_distinct_collections` | `main` | `stable` |
| `duplicate_preserving_multiset` | `duplicate` | `stable` |
| `stable_representation_reorder` | `reorder` | `stable` |

`duplicate_preserving_multiset`: two independently-constructed, locally
valid Collections share one `collection_id`; the Portfolio stores the
derived ref twice, matching multiplicity -- proving duplicate-preserving
multiset comparison, not set comparison, is what actually interoperates.

## Negative matrix (order normative)

| case | expected classification | reason |
|---|---|---|
| `wrong_collection_root` | `violation` | `normative_projection_mismatch` |
| `wrong_portfolio_root` | `violation` | `normative_projection_mismatch` |
| `wrong_checkpoint_root` | `violation` | `normative_projection_mismatch` |
| `stale_checkpoint_ref` | `violation` | `normative_projection_mismatch` |
| `missing_portfolio_ref` | `violation` | `normative_projection_mismatch` |
| `extra_portfolio_ref` | `violation` | `normative_projection_mismatch` |
| `duplicate_multiplicity_mismatch` | `violation` | `normative_projection_mismatch` |
| `invalid_checkpoint_sequence` | `out_of_domain` | `chronicle_checkpoint_shape_invalid` |
| `empty_collections` | `out_of_domain` | `chronicle_collections_portfolio_empty` |
| `malformed_array` | `unresolved` | `chronicle_external_producer_recompute_failed` |
| `producer_false_valid_claim` | `violation` | `normative_projection_mismatch` |

`stale_checkpoint_ref` is the headline locally-valid/globally-invalid case:
the Checkpoint's own root is recomputed to match its (fabricated) ref, so it
stays locally valid in isolation -- only the cross-link fails.

`producer_false_valid_claim` reuses `wrong_collection_root`'s content and
adds `claims.producer_believes_locally_valid: true` -- the lie changes
nothing; the artifact is rejected identically to `wrong_collection_root`.

No cycle semantics are included in this lane. A cycle is a claim about one
system's own mutation sequence over time, not about whether an
independently-produced static artifact is acceptable; replaying the
already-frozen internal cycle vectors against externally-sourced data would
not prove anything new about producer interoperability.

## Agreement tuple

ReceiptOS and the independent Python verifier must agree exactly on:
per-Collection local validity, Portfolio local validity, Checkpoint local
validity, claimed roots, recomputed roots, normalized derived Collection
refs, normalized stored Collection refs, Portfolio link validity, Checkpoint
membership validity, classification, and failure reason.

## Independence

- `producer_reference.py`: Python stdlib only (`argparse`, `hashlib`,
  `json`, `re`, `pathlib`). No `import` of anything under `src/**`. No
  `subprocess`, no `socket`. Reads only `--seed` and its own algorithms.
- `verify_output.py`: same independence properties, and additionally does
  not import anything from `producer_reference.py` -- every algorithm is
  reimplemented from scratch in this file.
- Both scripts are runnable after copying only this directory outside the
  repository -- no relative import reaches outside
  `interoperability/chronicle-external-producer-v0/`.

## Forbidden semantics

See `contract.json` -> `forbidden_semantics`. In particular this package
must never trust a producer-authored validity claim, must never include
cycle production, must never accept a producer-controlled filename, must
never claim general Unicode/`localeCompare` portability, must never
silently convert an explicit `metadata: null` to absent, and must never
modify a frozen source blob or frozen package.
