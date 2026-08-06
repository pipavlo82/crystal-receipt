# RSF positions 18–28 normative audit record

- Canonical base: `0cd910b5b659d5c3972923ee3cb4df0c4bd1a166`
- Correct source-admission fixture pin:
  `ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f`
- Vectors: 34; all reach the stage boundary except intentional V-UNVER at
  position 8.
- Closed execution classes: 32 `public-complete-entrypoint`, one
  `stage-continuation-invariant` (V-28A1), and one `package-integrity-only`
  (V-GIT). `contract.json` is the sole machine-readable classification source.
- Public determinism: V-OK and V-28A1 have byte-identical public `input` and
  `stage_input`; their public complete evaluation is therefore byte-identical.
  V-28A1's frozen rejection is solely an internal continuation-invariant check
  for position 28a.1 and is never counted as a public-entrypoint pass.
- Package model: A; four schemas are direct manifest members.
- Package inventory: 40 exact Git-index/blob artifacts.
- Fixture-set SHA-256:
  `879e0caa5d26643755b5a0e4b8836f0215dec3463cb1fa9ab44a82aefe618ee7`
  (formerly `4549d3b58290d5eb79c285902f8fd91b99c8b6ffaee357d960754189bd5ab194`;
  only README/contract classification bytes changed inside the 40-member
  package).
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
that F-01 (Proxy snapshot instability) or F-03 (incomplete mutation guards) is
closed. Both remain separate production-closure blockers.
