# Counterfactual Traversal Stability v1 — Cold-Start Coverage

Frozen profile: `counterfactual-traversal-stability-v1`

## Normative purpose

Lane K v1 is an append-only traversal-stability profile over the exact
authenticated ten-member Counterfactual Conformance DCN. It preserves the five
v0 schedule permutations and their ordered-vector digests, and adds seven
literal `cold_start_*` schedules so every DCN member appears in first position
at least once.

Lane K v1 binds:

1. the exact Counterfactual Conformance v0 DCN identity (Lane B);
2. frozen expected-result authority references (Lane G unchanged);
3. a closed twelve-schedule set \(\Pi_K\) v1;
4. reset model
   `fresh_process_per_schedule_shared_process_within_schedule`;
5. first-position cold-start coverage authority derived from authenticated
   frozen schedules;
6. a parent coordinator + fresh-process schedule worker protocol.

v1 does not silently reinterpret v0. The v0 package, digests, API, and 50/0/0
aggregate remain authoritative for the v0 profile.

## Reset model

Exactly one literal reset model is authoritative:

`fresh_process_per_schedule_shared_process_within_schedule`

- Parent performs exactly twelve authenticated schedule-process launches,
  one `Bun.spawn` per authenticated schedule in frozen inventory order.
- Launch count and schedule mapping derive from the authenticated
  twelve-schedule inventory; caller-claimed launch counts are rejected.
- Schedules execute sequentially (Lane K v1 is not concurrent); at most one
  schedule process is in flight.
- No process instance is reused between schedules.
- Within one worker/schedule, all ten members execute sequentially with no
  process/module reset between members.
- Therefore the first member of each schedule is the cold-start observation
  for that schedule.
- Each worker derives a fresh Lane I request from frozen package authority.

Process isolation is authenticated by launch count and schedule mapping, not
by global numeric PID uniqueness. Observed PIDs are optional non-normative
telemetry: they may repeat after earlier processes exit and must never enter
deterministic result identity, digests, verdicts, or failure classification.

## Frozen schedule set \(\Pi_K\) v1

### Preserved v0 schedules

| schedule_id | ordered vector IDs |
|---|---|
| `pi_canonical` | exact canonical DCN order |
| `pi_reverse` | exact reverse of canonical DCN order |
| `pi_composite_first` | `V-MAN-HASH-DIFF` first, then remaining canonical order |
| `pi_boundary_first` | `V-AT-NEST-OBJ` first, then remaining canonical order |
| `pi_nonlocal_v0` | frozen complete non-local permutation (literal list) |

Preserved per-order SHA-256 values must remain unchanged from v0.

### Cold-start schedules

For each uncovered member, one literal schedule places that member first; the
remaining nine members follow canonical DCN order with the first member omitted.

| schedule_id | first member |
|---|---|
| `cold_start_missing-required-input` | `V-MISSING-REQUIRED-INPUT` |
| `cold_start_integrity-mismatch` | `V-INTEGRITY-MISMATCH` |
| `cold_start_chronicle-proof-root-mismatch` | `V-CHRONICLE-PROOF-ROOT-MISMATCH` |
| `cold_start_chronicle-predecessor-unknown` | `V-CHRONICLE-PREDECESSOR-UNKNOWN` |
| `cold_start_chronicle-sequence-gap` | `V-CHRONICLE-SEQUENCE-GAP` |
| `cold_start_chronicle-checkpoint-root-mismatch` | `V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH` |
| `cold_start_chronicle-checkpoint-entry-refs-noncanonical` | `V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL` |

Committed `ordered_vector_ids` is the normative literal. Runtime must not derive
a schedule from a recurrence or caller input.

## First-position coverage authority

Coverage is derived from authenticated frozen schedules, not caller declarations.
A schedule set with any member absent from the union of first positions must
fail before worker execution.

Closed coverage contract requires:

- `schedule_count: 12`
- `member_count: 10`
- `scheduled_member_evaluations: 120`
- `first_position_member_count: 10`
- `first_position_covered: 10`
- `first_position_missing: []`

Duplicate first-position coverage is allowed for historically covered members,
but every member must appear first at least once.

## Observation and axes

For every canonical member identity and every schedule, Lane K preserves:

- `normative_expected`
- `canonical_observed`
- `scheduled_observed`

Semantic axis and schedule-stability axis are independent.

Stable PASS requires:

- `schedule_count: 12`
- `member_count: 10`
- `scheduled_member_evaluations: 120`
- `stable: 120`
- `history_sensitive: 0`
- `unresolved: 0`
- first-position coverage: 10/10

Final member serialization is always canonical DCN order, never traversal order.
PASS results must be produced by real isolated schedule execution.

## Worker operational timeout

Worker timeout is `120000` ms per schedule. This is operational behavior, not
schedule identity.

## Explicit non-claims

Lane K v1 does not claim:

- independence from every possible execution history;
- coverage of all \(10!\) schedules;
- universal verifier correctness;
- redefinition of DCN membership;
- changes to Lane G expected authority;
- changes to Lane E/H semantic aggregate rules;
- that schedule dependence is a normative semantic class;
- silent replacement of the v0 profile.

## Deterministic regeneration / check

```text
bun conformance/counterfactual-traversal-stability-v1/generate_package.ts --check
bun conformance/counterfactual-traversal-stability-v1/generate_package.ts --write
```

## Independent verification

```text
python conformance/counterfactual-traversal-stability-v1/verify_independent.py
bun conformance/counterfactual-traversal-stability-v1/audit_package.ts
```

Independent auditors verify schedule package identity, digests, first-position
coverage, and v0 preservation without importing production semantic execution
modules.
