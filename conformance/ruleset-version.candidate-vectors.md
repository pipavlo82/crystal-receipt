# ruleset_version candidate vectors

**Status:** CANDIDATE — computed by the reference author only (two independent implementations, same party). NOT canonical until reproduced by the recompute-kit, the recompute-lens, and ideally a from-spec pass. A value becomes canonical when other people's tooling lands on the same bytes, not when the author's does.  
**Origin:** General thread 2026-07-10/12 — Fede's catch, Pavlo's spec, Merlini's carrier design.  
**Spec:** `docs/analysis/ruleset-version-pinned-input.md`

## 1. Profile and rules

`receiptos-c14n-v0` = JCS (RFC 8785), sole delta = strip the top-level `anchor` field before canonicalization. `digest = sha256`; output = `0x` + 64 lowercase hex.

## 2. Carrier

`ruleset_version = sha256(canon(recipe_definition))`, where `recipe_definition` is a declaration block, not an implementation file — this is what keeps the version implementation-independent (reference, kit bash recipe, lens TS port and a from-spec rebuild must all hash the same definition). Semver is declared **INSIDE** the definition, therefore covered by the hash; any displayed version is read back by resolving the hash, never asserted alongside it.

Placement: `ruleset_version` is a required top-level key of the unsigned object, riding the existing `canon(unsigned)` path — zero mechanism change.

## 3. Definitions

`v0.1.0` — canonical form (175 bytes):

```json
{"canonicalization":"JCS (RFC 8785)","delta":"strip top-level anchor field","digest":"sha256","output":"0x + 64 lowercase hex","profile":"receiptos-c14n-v0","version":"0.1.0"}
```

`RV1 = 0x706bc9b3dc73159ccf4bbbebac3000a105de58f1253099ad23255998e9261e90`

`v0.2.0` — a genuine rule change, deliberately chosen so it does NOT alter this record's canonical bytes (adds `"reject":"non-finite numbers at hash-relevant positions"`, previously implicit). 232 bytes:

```json
{"canonicalization":"JCS (RFC 8785)","delta":"strip top-level anchor field","digest":"sha256","output":"0x + 64 lowercase hex","profile":"receiptos-c14n-v0","reject":"non-finite numbers at hash-relevant positions","version":"0.2.0"}
```

`RV2 = 0xa10b5ca766b5224b0df5eb3b430ec74a46b471c9360434d3c0589fd6306ca133`

## 4. Record under test — the §2.8 golden evidence object, version-pinned

```json
{"b":1,"a":{"y":"π","x":[true,null,"0x2a"]},"anchor":{"txHash":"0xdead"},"ruleset_version":"<RV>"}
```

## 5. The three cases

**(a) same** — pinned with RV1. Canonical form (132 bytes):

```json
{"a":{"x":[true,null,"0x2a"],"y":"π"},"b":1,"ruleset_version":"0x706bc9b3dc73159ccf4bbbebac3000a105de58f1253099ad23255998e9261e90"}
```

`→ Ca = 0x44a8a22891e4cb5376224b8ab686df446383f5aa3e5a22d5550aaf510c1438f7`

**(b) bumped** — identical record, pinned with RV2 instead. Canonical form (132 bytes), root:

`→ Cb = 0x16a80156bd197d6459e4b299a9119f989e53b6dfe2798924edb60297fabdb8e6`

`Cb ≠ Ca`. The rule change was chosen NOT to touch the record, so the commitment moves purely because the pinned ruleset moved. A v1 verdict only reproduces under v1; recomputing an old claim under a newer ruleset yields a visible mismatch ("a different claim now"), never a silent reinterpretation.

**(c) sidecar-tamper** — the body still commits RV1; a display/sidecar copy claims v0.2.0. Resolving RV1 → its definition → the definition's own semver reads 0.1.0 ≠ the displayed 0.2.0 → detected on legibility-vs-commitment consistency, and the root never moved. The label cannot be forged because it rides under the hash.

## 6. Control

The unpinned §2.8 vector is unchanged: `0xe61c9a9eed9e1d7eb5107acd9bb71d53cee9fcdae806444f4dc93b2f9694c2ae`. Pinning is additive; it does not disturb the golden vector.

## 7. Promotion criteria (how these stop being candidates)

Reproduced byte-exact by:

1. `trustless-ai/recompute-kit`
2. `trustless-ai/recompute-lens`
3. an independent from-spec implementation

On three independent landings, move the rows into the conformance index and mark canonical.
