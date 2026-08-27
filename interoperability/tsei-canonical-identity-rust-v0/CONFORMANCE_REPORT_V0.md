# TSEI canonical-identity Rust comparator - conformance report v0

## Bound inputs

- Corpus: `conformance/canonical-identity-json-conformance-v0/vectors.json`
- Corpus bytes: `10975`
- Corpus SHA-256: `5c5a38837778d63b554cde168394b65c484ec8246a2a0175a13d0723d15f6e6c`
- Specification SHA-256: `03f5b72afb3291e39534a880667fb4f48ff9a60145122beaca2896c2be7b020d`
- Rust crate: `interoperability/tsei-canonical-identity-rust-v0/`

## Recomputable commands

```text
cargo test --manifest-path interoperability/tsei-canonical-identity-rust-v0/Cargo.toml
cargo run --quiet --manifest-path interoperability/tsei-canonical-identity-rust-v0/Cargo.toml --bin conformance_report
```

## Observed result

```text
TSEI canonical-identity Rust comparator -- conformance report
vectors total:        27
  equal_pair:         3
  not_equal_pair:     10
  canonical_form:     7
  throws:             7
vectors passed:       27/27
mutants detected:     4/4
```

The three vectors added after the original 24-vector report are load-bearing for the cross-language Unicode boundary: exact astral/BMP object-key scalar ordering, lone-high-surrogate rejection, and lone-low-surrogate rejection. Rust valid strings exclude lone surrogates by construction; the corpus harness uses an explicit invalid-string stand-in so the shared rejection outcome is still exercised.

This is bounded conformance evidence for the exact corpus above. It is not a proof over the full input domain and does not establish a second implementation of the path walker or full TSEI evaluator.
