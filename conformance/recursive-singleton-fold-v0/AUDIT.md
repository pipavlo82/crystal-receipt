# RSF v0 expected-value audit

The normative fixture package has two independent implementations of the
expected byte and commitment calculations:

1. `python generate_expected.py` owns fixture construction and a local
   canonicalizer; it imports no repository runtime code.
2. `bun audit_expected.ts` owns a separately written canonicalizer, validates
   every manifest byte hash and all 34 classifications, and independently
   recomputes the eight identity/commitment values in V-OK.

Exact commands and captured outputs are recorded in the draft PR verification
section. Neither program evaluates positions 18–28 or imports future
production helpers. The tests assert normative data/schema/package integrity
only.

Pinned audit result:

- vectors: `34`;
- manifest members: `35` (`README.md` plus 34 vectors; manifest self-excluded);
- fixture-set SHA-256: `cd69d442e2ff948ca450f60f78f8437ae4ccbc3a8258a2133e94e84046402812`;
- independent TypeScript commitment/identity recomputations: `8`;
- independent classification checks: `34`;
- production imports: `0`.
