# TSEI Canonical-Identity Comparator — Independent Rust Implementation (v0)

An independent, clean-room Rust implementation of the canonical-identity JSON
comparator normatively specified in Section 11 of
[`docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md`](../../docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md).

## Clean-room boundary

This crate was built from exactly two repository inputs:

1. `docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md` (spec, Section 11 in particular)
2. `conformance/canonical-identity-json-conformance-v0/vectors.json` (frozen, language-neutral vector corpus — the oracle)

It does not read, import, transpile, link against, or otherwise depend on
`src/receiptos/challenge/canonical-identity-json.ts`, any TypeScript
comparator test, or any prior audit note describing that implementation's
internals. The vector corpus is consumed strictly as an oracle for expected
outcomes (exactly as its own `format_notes` describe: "consumable by any
language's test runner without importing production TypeScript"), never as a
design source.

Numeric canonicalization reproduces the **public** ECMA-262
`Number::toString(x, 10)` algorithm (shortest round-trip decimal digit
generation + the spec's four placement rules), because Section 11 pins the
comparator's numeric literal form to "this specification's reference
numeric-to-string behavior" and the corpus's `1e21`/`1e-7` canonical-form
vectors are consistent with that publicly documented algorithm. No TS source
was read to derive it.

## Layout

- `src/lib.rs` — the comparator: `Value` (JSON value + a `Value::Undefined`
  stand-in for JS's `undefined`), `canonical_identity_json`, and a
  `MutantMode`-parameterized `canonicalize` used only by the mutant-discrimination
  test harness (real callers only ever use `canonical_identity_json`, which is
  `MutantMode::None`).
- `tests/conformance.rs` — loads the real `vectors.json` from the repository
  (via `include_str!`, not a copy) and:
  - runs all 24 vectors (`equal_pair`, `not_equal_pair`, `canonical_form`, `throws`)
    against the real comparator,
  - reproduces each of the 4 documented mutants as a literal alternate code path
    and proves the corpus catches it (the mutant collapses exactly the vector IDs
    `wrongly_collapses_vector_ids` names, while the real comparator does not),
  - re-runs the whole corpus twice and asserts byte-identical results
    (determinism/repeatability).
- `src/bin/conformance_report.rs` — `cargo run --bin conformance_report` prints
  a plain-text pass/fail summary for external verification.

## Design notes / language mapping

- **"throws" → `Result::Err`.** Rust has no unchecked-throw convention
  equivalent to JS; the spec's `throws` category is realized idiomatically as
  `canonical_identity_json(...) -> Result<String, CanonicalizeError>` returning
  `Err`. This is a language-idiom mapping, not a behavioral deviation — every
  `throws` vector still exercises "canonicalization refuses to produce a
  value" for that input.
- **`Value::Undefined`** is a structural stand-in for JS's `undefined`, needed
  because plain JSON cannot express "this key is present but its value is
  undefined" or "the top-level value itself is undefined" — both required by
  Section 11's absent-value-rejection rule and by the `undefined`/
  `object_with_one_undefined_valued_key` vector kinds.
- **Object canonical string form is not byte-pinned by the corpus** beyond the
  equality relation it induces (only scalar/string/number canonical forms are
  pinned by `canonical_form` vectors). This implementation sorts an object's
  entries by their already-escaped key string before joining, which is
  sufficient for key-order independence (Section 11) regardless of insertion
  order; the exact resulting byte string is an internal choice, not a
  contract.

## Portability findings (Rust vs. the spec's JS-shaped reference behavior)

Recorded per the spec's own Section 13 discipline (interoperability claims
must state their assumptions explicitly, not leave them implicit in one
implementation):

- **UTF-16 vs. UTF-8/scalar strings.** JS strings are UTF-16 code-unit
  sequences and can contain unpaired ("lone") surrogates — not valid Unicode
  scalar values. Rust `String`/`str` are guaranteed valid UTF-8 and therefore
  **cannot** represent an unpaired surrogate at all. A hypothetical JS input
  containing one has no direct Rust `Value::String` equivalent; this is a
  genuine representational gap between the two languages, not a comparator
  bug. It does not affect any vector in the current corpus.
- **String ordering for object-key sorting.** JS string comparison (`<`/`>`,
  and hence any JS-side key sort) compares UTF-16 code units; Rust's default
  `String`/`str` `Ord` compares by UTF-8 byte value (equivalently, Unicode
  scalar value). These agree for all BMP characters but can disagree for
  supplementary-plane (astral) characters encoded as UTF-16 surrogate pairs.
  Irrelevant here because (a) the corpus never pins an exact object canonical
  string, only the equality relation, and (b) no vector's keys use astral
  characters — recorded for completeness, not as a defect.
- **Shortest-round-trip float formatting, tie-break edge case.** Both
  ECMA-262's algorithm and Rust's `f64` `Display`/`LowerExp` target the
  shortest decimal string that round-trips back to the same IEEE-754 double,
  with a round-to-even tie-break when two equally-short candidates are
  equidistant from the true value. Both are believed to implement this
  correctly, but this was verified empirically only for the corpus's pinned
  cases (`0`, `-0`, `1e21`, `1e-7`) plus this crate's own boundary-placement
  sanity checks (`100`, `123.456`, `0.5`, `1e20`, `1e-6`, negative values) —
  not proven identical for the full `f64` domain. No divergence was observed
  in any case actually exercised.
- **No Node/Bun/TS runtime dependency, no FFI, no generated code.** Confirmed
  by construction: the only dependency is `serde_json` (a pure-Rust crate),
  used solely to parse the vector-corpus JSON and construct test inputs — the
  comparator's own JSON string-escaping and number-formatting logic in
  `src/lib.rs` is hand-written, not delegated to `serde_json`'s serializer.

## Running

```
cargo test                            # unit tests + full conformance suite
cargo run --bin conformance_report    # plain-text summary
```
