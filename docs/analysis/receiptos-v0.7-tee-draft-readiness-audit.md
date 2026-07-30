# ReceiptOS v0.7 TEE draft readiness audit

> **Non-normative audit ledger**
>
> This file is a strict human-review readiness audit for the reconstructed ReceiptOS v0.7
> Markdown draft and its supporting claim ledger. It is not a normative protocol artifact,
> not a paper source of record, and not release authority.

Date: 2026-07-29
Repository: `pipavlo82/crystal-receipt`
Base canonical main checked: `b6cf60724eaa657166605e1d0e24a45fbb911853`

## Readiness summary

Current verdict from this audit: **CONTENT APPROVED — READY FOR BUILD-PIPELINE SELECTION**

Reason:
- the repaired draft now restores the authoritative v0.6 ten-section spine;
- the original four-contribution framing is preserved and the TEE work is integrated as an
  expansion of executable conformance / evidence-class analysis rather than a new unrelated
  headline contribution;
- citations and references have been restored to a real resolving bibliography;
- acknowledgments and disclosure are restored;
- relay and enclave TEE claims are bounded, separate, and tied to immutable evidence;
- excluded work remains excluded;
- aggregate-budget is non-central;
- the final human-style pass repaired content-level readability issues in the draft, including
  mojibake, over-strong independence phrasing, and draft-status wording;
- the remaining caveat is the lack of a canonical PDF build pipeline, which does not block
  pipeline selection for a later build task.

Continuing caveat:
- **PDF BUILD PIPELINE NOT YET CANONICAL**

## 1. Repository-state audit

Checked commands:

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short
git diff --name-status
git diff --cached --name-status
```

Observed canonical main at audit start:
- `HEAD = origin/main = b6cf60724eaa657166605e1d0e24a45fbb911853`

Observed local changes:
- `.gitattributes`
- `docs/paper/receiptos-v0.7-draft.md`
- `docs/analysis/receiptos-v0.7-source-reconstruction-and-claim-ledger.md`
- `docs/analysis/receiptos-v0.7-tee-draft-readiness-audit.md`

No unrelated modifications were present.

Byte-integrity policy update for commit safety:
- canonical newline policy chosen: LF;
- repository rule added: `*.md text eol=lf`;
- historical CRLF identities are retained only when explicitly labeled historical;
- readiness-audit self-identity is external-only to avoid circular hashing.

## 2. Canonical LF source identities

LF is the canonical repository newline form for this Markdown source set.

### Reconstructed draft
- path: `docs/paper/receiptos-v0.7-draft.md`
- bytes: `58908`
- SHA-256: `16c5d50b7e692acf7cc633a80c6381c876b6a0100ae53b257625c53d9fad1bb4`

### Claim ledger
- path: `docs/analysis/receiptos-v0.7-source-reconstruction-and-claim-ledger.md`
- bytes: `17794`
- SHA-256: `f726bcbb50645c46a4f753e8d3ae0fe4d8990ebb7198e7cf2601fa805a8a42a1`

### Historical pre-normalization CRLF identities — not canonical
- draft historical pre-normalization CRLF identity:
  - bytes: `59936`
  - SHA-256: `fd10f6751631de7eca22e59b2cd468a4b06fd0e4589c4f34741abf5ec933c5d2`
- draft historical pre-whitespace-repair LF identity:
  - bytes: `58913`
  - SHA-256: `c9dc772efef062da6be1b1d56cefb848cfd3c0e843514c7ddeefc58cba7c0e53`
- claim-ledger historical pre-normalization identity:
  - bytes: `16836`
  - SHA-256: `daca283c83a55323426fdbf17bbb7239ee5c6673f2f2e8be646081c3b9acf52a`

Self-identity intentionally omitted. Embedding this audit file’s own SHA-256 or byte count
inside the file would create a circular identity. The exact audit identity is recorded externally by
the enclosing handoff, Git object, or final report.

## 3. Structural restoration audit

### Restored v0.6 section structure
The repaired draft now follows the authoritative v0.6 paper structure:
1. Introduction
2. The Evidence Capsule Model
3. Threat Model
4. Recompute, Don’t Trust; Gates, Not Scores
5. Composition with the Agent-Execution Stack
6. Post-Quantum Durability
7. Relation to RAILS: An Interchange Format for REC-Class Evidence
8. Conformance Vectors and the Independent Verifier
9. Related Work
10. Limitations and Open Problems

Also restored:
- acknowledgments and disclosure;
- references;
- appendices.

### Section-number consistency
- original 10-section spine restored;
- no replacement of Section 6 by TEE material;
- no standalone new Section 11;
- original limitations spine `10.1`–`10.9` restored;
- one narrow added limitation `10.10` records the new TEE/dependency caveat.

Classification:
- structure restoration **passed**.

## 4. Corrections made to restore fidelity

Corrections made in the repaired draft:
- restored the v0.6 abstract architecture and four-contribution framing;
- restored the v0.6 `§1.5` roadmap and explained that TEE expands the conformance /
  executable verification contribution rather than replacing PQ durability;
- restored substantive Section 2 model content;
- restored substantive Section 5 composition content, including the WYRIWE seam;
- restored full Section 6 post-quantum durability discussion;
- restored detailed Section 7 RAILS mapping;
- restored broader Section 8 conformance-surface discussion, then added bounded TEE relay /
  enclave suites there;
- restored substantive Section 9 related-work families and integrated attested execution there;
- restored inherited v0.6 limitations `10.1`–`10.9` and added a bounded `10.10`;
- restored acknowledgments and disclosure;
- restored a complete references base plus verified TEE references;
- removed the standalone aggregate-budget subsection entirely;
- repaired mojibake and symbol corruption in the reconstructed Markdown text;
- softened one abstract independence phrase from `independent` to `separately authored` where
  that more accurately matches the paper's disclosure boundary;
- changed the draft-status line to `Draft v0.7 — reconstructed source for review only`;
- made the `fully outside the current collaboration remains open` caveat explicit in the TEE
  body sections.

## 5. Four-contribution framing audit

Preserved framing:
1. Evidence Capsule model and deterministic canonicalization;
2. threat model;
3. composition and executable conformance evidence, now expanded with distinct TEE relay
   and enclave suites;
4. RAILS / class-preservation positioning.

Audit result:
- the TEE work no longer appears as a fifth unrelated headline contribution;
- it now strengthens contribution 3 explicitly.

## 6. Relay count / hash audit

Required relay profile:
- `tee-inference-v0`
- 10 vectors
- 3 verified
- 4 rejected
- 3 unverifiable
- 10/10 reproduced
- vectors SHA-256:
  `c02f8af51edef5038a76b9e30ab7ef4781d3d66bd4eafe00146fe225ddbb2a69`

Observed across repaired draft and ledger:
- total vectors: `10`
- partition: `3 verified / 4 rejected / 3 unverifiable`
- reproduced: `10/10`
- full hash matches character-for-character

Relay claim boundary audit:
- signature recovery recomputed;
- response binding recomputed;
- request binding broker-asserted;
- enclave quote attested/unavailable.

Status:
- **relay audit passed**.

## 7. Enclave count / hash audit

Required enclave profile:
- `tee-inference-enclave-v0`
- 11 vectors
- 7 verified
- 4 rejected
- 11/11 reproduced
- vectors SHA-256:
  `b197809da7198f8854cc9d17036b46c7ad16466155bc0657c5197d204da82d2e`
- primary enclave artifact SHA-256:
  `ada9731bd58620ce5dc148e907903b786439dbad7b6f00e26b25e698e0cec78d`

Observed across repaired draft and ledger:
- total vectors: `11`
- partition: `7 verified / 4 rejected`
- reproduced: `11/11`
- full hashes match character-for-character

Enclave claim boundary audit:
- request binding recomputed;
- DCAP/X.509 chain parsed and verified;
- chain-of-trust verified to the pinned Intel root;
- live Intel PCS freshness not implemented;
- live revocation checking not implemented;
- not complete current-platform attestation verification.

Status:
- **enclave audit passed**.

## 8. Citation and references audit

### In-text citation resolution
Machine audit on the repaired draft found:
- body citations present for references `[1]` through `[16]`;
- references `[1]` through `[16]` all defined;
- no orphan references;
- no missing references.

### New TEE factual claim citations
All new TEE factual claims are cited in-text with immutable evidence references:
- `[15]` for the upstream recompute-kit PR #2 commit and profile paths;
- `[16]` for the associated gist revision and enclave artifact/script lineage.

### Reference-base restoration
Restored:
- v0.6 reference base `[1]`–`[14]`
- verified TEE references `[15]`–`[16]`

Audit result:
- **citation and references audit passed**.

## 9. Acknowledgments and disclosure status

Restored from v0.6 and updated narrowly to disclose:
- WYRIWE composition collaboration lineage;
- design-partner relationship to Stealth / CYPHES;
- TEE source same-collaboration-thread status;
- lack of fully external independent reproduction.

Audit result:
- **acknowledgments/disclosure restored and bounded**.

## 10. Aggregate-budget treatment

Current treatment:
- no standalone subsection remains in the repaired paper draft;
- aggregate-budget is not presented as a v0.7 contribution;
- it is therefore non-central by construction.

Audit result:
- **aggregate-budget demotion passed**.

## 11. Dependency-resolution caveat

Recorded narrowly in `§8.8` and `§10.10`:
- successful execution used Bun `1.3.14`;
- Python `3.12.10`;
- `bun install`;
- resolved `ethers@6.17.0`;
- upstream declared `ethers: ^6.13.0`;
- no upstream lockfile existed.

Stated clearly:
- suite/vector bytes were immutable;
- runtime dependency resolution was not lockfile-frozen;
- this is a reproducibility caveat, not a semantic suite failure.

Audit result:
- **dependency caveat correctly bounded**.

## 12. Excluded-scope audit

Explicitly not added as v0.7 contributions:
- ACE serialization;
- Counterfactual Conformance as a completed contribution;
- RSF;
- RAB;
- aggregate-budget as a paper contribution;
- recompute-lens as independent reproduction.

Audit result:
- excluded work remains excluded or bounded correctly.

## 13. Machine audit of requested literals and phrases

Searched the repaired draft, claim ledger, and this audit for:
- `8/8`
- `9 + 1`
- `fourth implementation`
- `independent implementation`
- `external independent`
- `ACE`
- `Delta`
- `infinity`
- `Counterfactual`
- `RSF`
- `RAB`
- `aggregate_budget`
- `non-bypassability`
- `freshness`
- `revocation`
- `READY FOR ZENODO`

Classification summary:
- no obsolete count phrases found;
- no forbidden independence phrase found as a positive claim;
- `ACE`, `Counterfactual`, `RSF`, `RAB` appear only in exclusion contexts in the audit/ledger;
- `aggregate_budget` no longer appears in the paper draft;
- `freshness` and `revocation` appear only in bounded limitation contexts;
- no `READY FOR ZENODO` phrase found.

## 14. Failed-edit diagnosis and final focused-audit check

### Failed-edit diagnosis

Two late-stage failed edits occurred in the paper/audit pass.

#### A. Citation-token normalization edit

The first failed edit was the intended normalization of the combined TEE citation token:

- intended 8-character source token: `[15, 16]`
- intended replacement token: `[15][16]`

Target location at the time of the failed edit:
- the enclave-side TEE paragraph in the abstract, first visible in the repaired draft at line 52;
- the same citation token also appeared in multiple later paragraphs discussing enclave claims,
  the Section 8 TEE suite discussion, the Section 9 attested-execution paragraph, the Section
  10 bounded Intel caveat, the disclosure paragraph, and Appendix A.

Why the edit failed:
- the `edit` tool was asked to replace the exact string `[15, 16]`, but that string occurred in
  multiple places, so the tool rejected the request because the match was not unique.

Issue classification:
- citation formatting only.

Status:
- fixed manually; no semantic change.

#### B. TEE caveat paragraph replacement edit

The second failed edit was the intended replacement of the bounded TEE dependency/provenance
caveat paragraph in the paper body.

Target section and surrounding paragraph:
- `§10.10 Bounded TEE and dependency-resolution caveat`
- the paragraph immediately following the Intel-root / freshness / revocation limitation.

Old text:

```text
A second caveat is operational rather than semantic: the suite artifacts and vector bytes are
immutable, but the successful rerun environment was not lockfile-frozen. The upstream commit
contained `package.json` with `ethers: ^6.13.0` and no lockfile; successful execution used
`bun install` and resolved `ethers@6.17.0` under Bun `1.3.14` [15]. This is a release-readiness
caveat, not a conformance failure.
```

Intended new text:

```text
A second caveat is operational rather than semantic: the suite artifacts and vector bytes are
immutable, but the successful rerun environment was not lockfile-frozen. The upstream commit
contained `package.json` with `ethers: ^6.13.0` and no lockfile; successful execution used
`bun install` and resolved `ethers@6.17.0` under Bun `1.3.14` [15]. This is a reproducibility
caveat, not a conformance failure. Reproduction by parties fully outside the current
collaboration also remains open.
```

Why the edit failed:
- the exact old text no longer matched because nearby wording had already diverged in one
  location (`release-readiness` vs `reproducibility`, and one related paragraph in `§8.8` had
  already been updated first), so the requested exact replacement could not be found.

Length note:
- the replacement as reconstructed from the actual paragraph content is 490 characters in the
  current newline/encoding form; the user-reported `505-character` failed edit is consistent with
  a slightly different counting basis (e.g. prior line endings or tool-visible character count).

Issue classification:
- this affected **independence/provenance wording** and **dependency-caveat wording**;
- it did **not** affect counts, hashes, citations, section numbering, or core claim scope.

### Was an edit still required?

- yes, at the time of failure;
- it has now been applied manually in the paper;
- the current draft contains the intended final wording in the relevant caveat paragraph.

### Working-tree and staging verification

Commands used for byte-integrity verification included:

```bash
git diff -- docs/paper/receiptos-v0.7-draft.md
git status --short
git add -- .gitattributes docs/paper/receiptos-v0.7-draft.md docs/analysis/receiptos-v0.7-source-reconstruction-and-claim-ledger.md docs/analysis/receiptos-v0.7-tee-draft-readiness-audit.md
git show :<path>
git reset -- .gitattributes docs/paper/receiptos-v0.7-draft.md docs/analysis/receiptos-v0.7-source-reconstruction-and-claim-ledger.md docs/analysis/receiptos-v0.7-tee-draft-readiness-audit.md
```

Observed:
- only the intended files were present as untracked local work;
- working-tree bytes for all four files were LF-only;
- staged/index bytes for all four files matched the LF working-tree bytes exactly;
- no files were left staged after verification.

### Final focused-audit result

Re-run checks confirmed:
- abstract/body consistency remains intact;
- four-contribution framing remains intact;
- relay claim boundary remains bounded and readable;
- enclave claim boundary remains bounded and readable;
- Intel freshness/revocation limitations remain explicit;
- collaboration/independence wording remains bounded and now explicitly states that
  reproduction by parties fully outside the current collaboration remains open;
- acknowledgments/disclosure align with the body;
- citation/reference resolution passed;
- no mojibake remained in the draft;
- no bad version-language remained in the draft;
- top-level paper headings are exactly `1` through `10`;
- no placeholder text remained.

The earlier report numbering drift (`4` through `13`) was only list-rendering in the chat report,
not a real heading-number drift in the paper.


## 15. Unresolved editorial questions

Remaining questions are editorial rather than evidentiary:
1. whether the reconstructed Markdown should preserve even more of the original sentence-level
   v0.6 wording in Sections 2–5, beyond the current faithful restoration;
2. whether `10.10` should remain a distinct numbered limitation or be folded into nearby
   limitation prose in a future polish pass;
3. whether the two new TEE references `[15]` and `[16]` need bibliography-style formatting
   tweaks once a canonical paper-source format is selected.

These do not rise to material content, citation, or scope failures.

## 16. Build-pipeline status

**PDF BUILD PIPELINE NOT YET CANONICAL**

No PDF was built in this task.

## 17. Final readiness verdict

The repaired draft now restores the v0.6 structure and citation discipline closely enough for a
final human-style content review pass, and that pass found no remaining material content,
citation, or disclosure defect. The TEE claims remain narrow, bounded, and immutable.

Therefore the correct verdict is:

**CONTENT APPROVED — READY FOR BUILD-PIPELINE SELECTION**
