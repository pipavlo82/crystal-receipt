# Cross-Object Transformation Stability v0

Frozen profiles: `chronicle-collection-checkpoint-transformation-stability-matrix-v0`,
`chronicle-collections-portfolio-transformation-stability-matrix-v0`

## Normative purpose

This package freezes the first conformance surface over the two already-merged
cross-object Transformation Stability profiles in the Chronicle domain:

1. **Collection -> Checkpoint** (PR #187, module
   `src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint.ts`,
   pinned blob `da1a0bca7e9ae36f2805a837cd9adaaec4d3ad7a`).
2. **Collections -> Portfolio** (PR #191, module
   `src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio.ts`,
   pinned blob `890ddb8d5a7e8ac8bd7dfc6c0682589d796393d9`).

Both reuse the frozen Chronicle domain implementation
(`src/receiptos/capsule/chronicle-portfolio-v0.ts`, pinned blob
`0e790911092546c62344f980e6b611542bcd00fe`) directly and unmodified. This
package does not change implementation semantics. It recomputes and pins the
already-merged behavior of both profiles so that drift is independently
detectable, and it separately freezes the evidence for why no third,
triple-object profile follows (see "Closure" below).

Core claim: `pairwise_cross_object_consistency`. Closed-cycle claim:
`edgewise_pairwise_cross_object_consistency_closed_cycle`.

Transformation Stability separates four projections over a recomputed
observation:

- `N` -- normative projection; mismatch is always `violation`.
- `S` -- stability projection; mismatch is `history_sensitive` unless an
  authenticated profile explicitly escalates it to `violation`.
- `A` -- allowed variant projection; variation is telemetry only and never
  changes the principal class.
- `F` -- forbidden variant projection; mismatch is always `violation`, even
  when `N` matches.

Principal result classes: `stable`, `history_sensitive`, `unresolved`,
`out_of_domain`, `violation`.

## Package scope

Four frozen vector/cycle sets, all recomputed directly against the merged
evaluators via read-only imports from `src/receiptos/challenge/` and
`src/receiptos/capsule/`:

1. `vectors/collection-checkpoint-matrix-set.json` -- the exact 11-vector
   Collection -> Checkpoint matrix.
2. `vectors/collection-portfolio-matrix-set.json` -- the exact 18-vector
   Collections -> Portfolio matrix.
3. `cycles/collection-checkpoint-cycle-set.json` -- the exact 4-vector
   Collection -> Checkpoint closed-cycle set.
4. `cycles/collection-portfolio-cycle-set.json` -- the exact 5-vector
   Collections -> Portfolio closed-cycle set.

A third, triple-object (`Collections[] -> Portfolio -> Checkpoint`) profile is
explicitly out of scope for this package and is forbidden semantics (see
`contract.json` -> `forbidden_semantics` ->
`triple_object_composition_implementation`).

## Collection -> Checkpoint

Vector order is normative (11 vectors):

| vector_id | expected classification |
|---|---|
| `stable_coordinated_roundtrip` | `stable` |
| `collection_artifact_refs_reorder_stable` | `stable` |
| `upstream_mutation_without_downstream_update` | `violation` |
| `downstream_reference_tamper_recomputed` | `violation` |
| `coordinated_upstream_downstream_update` | `violation` |
| `collection_metadata_forbidden_mutation` | `violation` |
| `stored_checkpoint_root_tamper` | `violation` |
| `stored_collection_root_tamper` | `violation` |
| `collection_schema_literal_mutation` | `violation` |
| `invalid_genesis_out_of_domain` | `out_of_domain` |
| `entry_refs_recompute_unresolved` | `unresolved` |

Expected aggregate: `stable=2, history_sensitive=0, unresolved=1,
out_of_domain=1, violation=7`.

Cycle vector order and cycle edge order are both normative (4 cycles):

| cycle_id | edges (ordered) | expected classification |
|---|---|---|
| `stable_multi_edge_roundtrip_reorder` | `canonical-roundtrip`, `collection-artifact-refs-reorder` | `stable` |
| `cross_link_mutation_then_restore` | `mutate-collection-id-stale-ref`, `restore-collection-id-and-ref` | `violation` (fails at `mutate-collection-id-stale-ref`) |
| `invalid_start_out_of_domain` | `attempt` | `out_of_domain` |
| `entry_refs_corrupt_unresolved` | `corrupt-entry-refs` | `unresolved` |

`cross_link_mutation_then_restore` is the frozen instance of the core cycle
invariant for this profile: endpoint closure cannot erase an intermediate
violation. Its second edge (`restore-collection-id-and-ref`) would bring the
normative projection back into agreement with the source, but the cycle
terminates at the first violating edge and never reaches the endpoint
comparison.

## Collections -> Portfolio

Vector order is normative (18 vectors), frozen in the exact merged order:
`stable_canonical_roundtrip`, `collections_and_refs_reorder_stable`,
`upstream_collection_mutation_without_portfolio_update`,
`downstream_portfolio_ref_tamper_recomputed`,
`coordinated_collection_and_portfolio_update`, `missing_portfolio_ref`,
`extra_portfolio_ref`, `replace_bundled_collection_with_other_valid_collection`,
`duplicate_collection_ref_multiset_mismatch`,
`collection_metadata_forbidden_mutation`,
`portfolio_metadata_forbidden_mutation`, `collection_schema_literal_mutation`,
`portfolio_schema_literal_mutation`, `stored_collection_root_tamper`,
`stored_portfolio_root_tamper`, `empty_collections_out_of_domain`,
`collection_artifact_refs_corrupt_unresolved`,
`portfolio_collection_refs_corrupt_unresolved`. See `contract.json` for the
full per-vector expected-classification map.

Expected aggregate: `stable=2, history_sensitive=0, unresolved=2,
out_of_domain=1, violation=13`.

Cycle vector order and cycle edge order are both normative (5 cycles):
`stable_multi_edge_roundtrip_reorder`, `cross_link_mutation_then_restore`,
`link_only_mutation_then_restore`, `invalid_start_out_of_domain`,
`collections_corrupt_unresolved`. `link_only_mutation_then_restore` is a
second, independent demonstration of the same closed-cycle invariant using a
pure downstream-only edit (no Collection touched) rather than an upstream
identity mutation -- the failure mode unique to a set-valued cross-object
relationship. Both mutation cycles terminate on their first edge; their
second, declared restore edges never execute.

## Combined aggregates

Both are derived mechanically by `generate_package.ts` by summing the two
live profile results -- never hand-adjusted. If a live merged output ever
disagrees with the pinned sum, `--check` fails rather than silently
re-deriving a new value.

- Combined flat: `vectors=29, stable=4, history_sensitive=0, unresolved=3,
  out_of_domain=2, violation=20`.
- Combined cycle: `cycles=9, stable=2, history_sensitive=0, unresolved=2,
  out_of_domain=2, violation=3`.

## Closure: why there is no third, triple-object profile

Given only the observables already exposed by the two merged profiles:

```
D = derived Collection-ref multiset = sortCollectionRefs(collections.map(deriveCollectionRefFromChronicleCollection))
P = stored Portfolio-ref multiset   = sortCollectionRefs(portfolio.collection_refs)
C = Checkpoint collection_ref       = checkpoint.collection_ref
```

Multiset equality (`D === P`) entails equality of the underlying element
*supports* -- two multisets can only be equal if they contain exactly the
same distinct elements. Therefore, for any element `x`:
`(D === P) and (x in D) implies (x in P)`, unconditionally, by the definition
of multiset equality alone -- not a Chronicle-domain fact. Substituting
`x = C`:

```
D === P and C in D implies C in P
```

This holds for every bundle, not only the fixtures under test; no committed
Chronicle field links a Checkpoint to a Portfolio directly (a Checkpoint's
only cross-reference is the single string `collection_ref`), so `D`, `P`, and
`C` are the only observables a triple-object composition could be built from.
Whenever `D !== P`, the composition is already `violation` on the strength of
the Collections -> Portfolio profile alone, independent of the Checkpoint.
`closure.evidence` in `contract.json` freezes a concrete recomputation of
`D`, `P`, `C`, and the implication above against the real Collections ->
Portfolio fixture plus one standalone, independently valid Checkpoint.

This closure is narrowly scoped to the observables above under *currently
committed* Chronicle semantics. It must not be read as a permanent property
of the domain: if a future committed field ever links a Checkpoint directly
to a Portfolio, this closure argument no longer applies and must be
re-derived, not reused (see `contract.json` -> `forbidden_semantics` ->
`closure_claim_generalization_beyond_current_observables`).

## Locally-valid/globally-invalid evidence

`contract.json` -> `locally_valid_globally_invalid_evidence` freezes a
concrete recomputation, via already-reused low-level verifiers only (no new
evaluator), of the two profiles' headline observable: every individual
object can verify `ok: true` in isolation while the cross-object link is
`false`.

- `collection_checkpoint`: the same mutation recipe as the frozen
  `upstream_mutation_without_downstream_update` vector -- both the mutated
  Collection and the untouched Checkpoint verify individually, but the
  cross-link is false.
- `collections_portfolio`: the same mutation recipe as the frozen
  `duplicate_collection_ref_multiset_mismatch` vector -- two Collections
  sharing one `collection_id` (so the derived ref multiset holds it twice)
  against a Portfolio storing it once. Every Collection verifies, the
  Portfolio verifies against its own stored refs, and the derived/stored
  multisets differ by count, not by membership -- the concrete evidence that
  duplicate-preserving multiset comparison, not set comparison, is the only
  semantics the committed constructors actually support (see
  `contract.json` -> `forbidden_semantics` -> `duplicate_ref_set_collapsing`).

## Independence

- `generate_package.ts` imports the merged evaluators and Chronicle domain
  constructors read-only and materializes the four vector/cycle sets plus
  `manifest.json`. It changes no `src/**` file. It rebuilds both profiles'
  fixtures locally, using only already-exported constructors -- it imports no
  private helper from either profile module or its test file.
- `audit_package.ts` and `verify_independent.py` import no production code.
  Both recompute package digests independently; `verify_independent.py`
  additionally re-derives the three Chronicle root algorithms
  (`collection_root`, `portfolio_root`, `checkpoint_root`) from the frozen
  fixture JSON embedded in `contract.json`, independently re-executes the
  duplicate-preserving multiset comparison and the closure implication, and
  independently re-derives every flat vector's and cycle's classification
  from the frozen per-vector/per-edge match booleans and pinned expectation
  tables -- never from the frozen `classification` field alone.

## Forbidden semantics

See `contract.json` -> `forbidden_semantics`. In particular this package must
never implement a triple-object evaluator, must never collapse duplicate
refs into a set before comparison, must never let endpoint equality suppress
a recorded intermediate violation, and must never generalize the closure
claim beyond the `D`/`P`/`C` observables it was proven against.
