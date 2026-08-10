# Counterfactual Traversal Stability v0 — Lane K

Frozen profile: `counterfactual-traversal-stability-v0`

## Normative purpose

Lane K is a meta-conformance layer over Counterfactual Conformance v0 execution
behavior. It tests whether per-member normalized observations of the exact
authenticated ten-member DCN remain stable under a frozen set of versioned
deterministic execution schedules.

Lane K binds:

1. the exact Counterfactual Conformance v0 DCN identity (Lane B);
2. frozen expected-result authority references (Lane G unchanged);
3. a closed five-schedule set \(\Pi_K\) v0;
4. reset model
   `fresh_process_per_schedule_shared_process_within_schedule`;
5. a parent coordinator + fresh-process schedule worker protocol.

## Reset model

Exactly one literal reset model is authoritative:

`fresh_process_per_schedule_shared_process_within_schedule`

- Parent spawns one new Bun process per schedule.
- Worker processes are never reused.
- Schedules execute sequentially (Lane K v0 is not concurrent).
- Within one worker/schedule, all ten members execute sequentially with no
  process/module reset between members.
- Each worker derives a fresh Lane I request from frozen package authority.

## Frozen schedule set \(\Pi_K\) v0

| schedule_id | ordered vector IDs |
|---|---|
| `pi_canonical` | exact canonical DCN order |
| `pi_reverse` | exact reverse of canonical DCN order |
| `pi_composite_first` | `V-MAN-HASH-DIFF` first, then remaining canonical order |
| `pi_boundary_first` | `V-AT-NEST-OBJ` first, then remaining canonical order |
| `pi_nonlocal_v0` | frozen complete non-local permutation (literal list) |

`pi_nonlocal_v0` conformance authority is the frozen ordered vector-ID list and
its digest. Runtime does not compute Recamán or another recurrence. Any
Recamán-inspired design history is generator provenance only.

Index separation is not “semantic distance.” No semantic-distance metric exists.

## Observation and axes

For every canonical member identity and every schedule, Lane K preserves:

- `normative_expected`
- `canonical_observed`
- `scheduled_observed`

Semantic axis and schedule-stability axis are independent.

Stable PASS requires:

- `schedule_count: 5`
- `member_count: 10`
- `scheduled_member_evaluations: 50`
- `stable: 50`
- `history_sensitive: 0`
- `unresolved: 0`

Final member serialization is always canonical DCN order, never traversal order.

## Worker operational timeout

Worker timeout is `120000` ms per schedule. This is operational behavior, not
schedule identity.

## Explicit non-claims

Lane K does not claim:

- independence from every possible execution history;
- coverage of all \(10!\) schedules;
- universal verifier correctness;
- redefinition of DCN membership;
- changes to Lane G expected authority;
- changes to Lane E/H semantic aggregate rules;
- that schedule dependence is a normative semantic class.

## Deterministic regeneration / check

```text
bun conformance/counterfactual-traversal-stability-v0/generate_package.ts --check
bun conformance/counterfactual-traversal-stability-v0/generate_package.ts --write
```

## Independent verification

```text
python conformance/counterfactual-traversal-stability-v0/verify_independent.py
bun conformance/counterfactual-traversal-stability-v0/audit_package.ts
```

Independent auditors verify schedule package identity and digests without
importing production semantic execution modules.
