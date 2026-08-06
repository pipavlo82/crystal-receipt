# RSF positions 18–28 normative audit record

- Canonical base: `0cd910b5b659d5c3972923ee3cb4df0c4bd1a166`
- Correct source-admission fixture pin:
  `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f`
- Vectors: 34; all reach the stage boundary except intentional V-UNVER at
  position 8.
- Package model: A; four schemas are direct manifest members.
- Package inventory: 40 exact Git-index/blob artifacts.
- Fixture-set SHA-256:
  `64b88bfbd578ee8399f6a78793f14fc71271937aef517afe8fab7822aaa46d4a`
- Python generator: independent reconstruction; default verification mode is
  read-only; `--generate` is the only write mode.
- TypeScript audit: independent reconstruction from raw vector prefix/source
  facts; default and only audit mode reads Git-index bytes.
- Import graph: Python standard library only; TypeScript `node:` built-ins only;
  zero production imports and zero cross-implementation imports.
- V-OK: seven commitments, aggregate ID, aggregate canonical bytes, and
  envelope canonical bytes independently matched by both implementations.
- Executable obligations: mutation snapshot/no-alias, replay byte equality, and
  accepted-only-after-position-28 fallthrough proof all pass.
- Positions 1–17: six exact base Git blob OIDs are pinned in `contract.json`;
  no runtime byte is changed.

This is normative conformance evidence, not a production evaluator or a claim
that a future production carrier already conforms.
