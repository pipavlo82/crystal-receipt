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

- `src/lib.rs` — the comparator: `Value` (JSON value + structural stand-ins
  for JS's `undefined` and a non-scalar Unicode string), `canonical_identity_json`, and a
  `MutantMode`-parameterized `canonicalize` used only by the mutant-discrimination
  test harness (real callers only ever use `canonical_identity_json`, which is
  `MutantMode::None`).
- `tests/conformance.rs` — loads the real `vectors.json` from the repository
  (via `include_str!`, not a copy) and:
  - runs all 27 vectors (`equal_pair`, `not_equal_pair`, `canonical_form`, `throws`)
    against the real comparator,
  - reproduces each of the 4 documented mutants as a literal alternate code path
    and proves the corpus catches it (the mutant collapses exactly the vector IDs
    `wrongly_collapses_vector_ids` names, while the real comparator does not),
  - re-runs the whole corpus twice and asserts byte-identical results
    (determinism/repeatability).
- `src/bin/conformance_report.rs` — `cargo run --bin conformance_report` prints
  a plain-text pass/fail summary for external verification.
- `CONFORMANCE_REPORT_V0.md` — a committed snapshot of the 27/27 and 4/4
  Unicode-closure run, including the exact corpus digest. The executable test
  remains authoritative and recomputable; the snapshot makes the reviewed run
  directly inspectable without relying on an earlier 24-vector report.

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
- **`Value::InvalidUnicodeString`** is the Rust-side structural stand-in for a
  UTF-16 string containing a lone high or low surrogate. Rust `String` cannot
  represent that input, but the shared `throws` vectors still require the
  comparator to refuse to produce a canonical value.
- **Object key order is byte-pinned by the corpus.** Keys are sorted by raw
  Unicode scalar value before JSON escaping. The astral/BMP boundary vector
  makes this rule observable across UTF-16 and UTF-8 language runtimes.

## Portability findings (Rust vs. the spec's JS-shaped reference behavior)

Recorded per the spec's own Section 13 discipline (interoperability claims
must state their assumptions explicitly, not leave them implicit in one
implementation):

- **UTF-16 vs. UTF-8/scalar strings.** The normative domain is Unicode scalar-
  value sequences. The TypeScript implementation rejects lone surrogates;
  Rust strings exclude them by construction and the explicit invalid-string
  stand-in proves the shared rejection vectors.
- **String ordering for object-key sorting.** Both implementations sort by
  Unicode scalar value. The shared astral/BMP boundary canonical-form vector
  prevents a UTF-16 code-unit sort from passing unnoticed.
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
