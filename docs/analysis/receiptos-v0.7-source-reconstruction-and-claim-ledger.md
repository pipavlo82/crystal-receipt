# ReceiptOS v0.7 source reconstruction and claim ledger

> **Non-normative audit ledger**
>
> This file records how the v0.7 draft source was reconstructed, what v0.6 baseline was treated
> as authoritative, which edits were made and why, which claims are supported by immutable
> evidence, which claims are bounded, and which candidate contributions remain excluded.

Date: 2026-07-29
Repository: `pipavlo82/crystal-receipt`
Canonical main audited: `b6cf60724eaa657166605e1d0e24a45fbb911853`

## Canonical LF source identities

LF is the canonical repository newline form for this Markdown source set.

### Paper frozen source identity
- frozen source commit: `c3098c46e7af6eeb039bc26ea3ee15532485d6c9`
- path: `docs/paper/receiptos-v0.7-draft.md`
- frozen source bytes: `58908`
- frozen source SHA-256: `16c5d50b7e692acf7cc633a80c6381c876b6a0100ae53b257625c53d9fad1bb4`
- scope:
  this digest identifies the exact frozen v0.7 source bytes at the named
  immutable commit; it is not the SHA-256 of the current mutable file on
  main

### Historical pre-normalization CRLF identity — not canonical
- file: `docs/paper/receiptos-v0.7-draft.md`
- bytes: `59936`
- SHA-256: `fd10f6751631de7eca22e59b2cd468a4b06fd0e4589c4f34741abf5ec933c5d2`

### Historical pre-whitespace-repair LF identity — not canonical
- file: `docs/paper/receiptos-v0.7-draft.md`
- bytes: `58913`
- SHA-256: `c9dc772efef062da6be1b1d56cefb848cfd3c0e843514c7ddeefc58cba7c0e53`

Self-identity intentionally omitted for this claim ledger. Embedding this file’s own SHA-256 or
byte count inside the file would create a circular identity. The exact claim-ledger identity is
recorded externally by the enclosing audit, Git object, or final report.

## 1. Authoritative v0.6 baseline

Local file used as the authoritative published baseline:
- path:
  `C:\Users\msi\AppData\Roaming\atomicbot-desktop\openclaw\media\inbound\Tvardovskyi_ReceiptOS_v0.6---a6784367-c4a5-4e32-84c0-d02da1630bff.pdf`
- filename:
  `Tvardovskyi_ReceiptOS_v0.6---a6784367-c4a5-4e32-84c0-d02da1630bff.pdf`
- bytes: `316231`
- SHA-256:
  `be957199c5e11f4b73cabf60ecb17e78233ab50376b7320ebaa7e5d51e5819e1`
- page count: `24`
- metadata:
  - Producer: `pdfTeX-1.40.25`
  - Creator: `LaTeX with hyperref`
  - CreationDate: `D:20260710174049Z`
  - ModDate: `D:20260710174049Z`
  - PTEX.Fullbanner:
    `This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023/Debian) kpathsea version 6.3.5`
- text extraction status: **complete and structurally usable**

## 2. Baseline section map from the authoritative v0.6 PDF

v0.6 structural spine confirmed from the PDF:
1. Introduction
2. The Evidence Capsule Model
3. Threat Model
4. Recompute, Don’t Trust; Gates, Not Scores
5. Composition with the Agent-Execution Stack
6. Post-Quantum Durability
7. Relation to RAILS
8. Conformance Vectors and the Independent Verifier
9. Related Work
10. Limitations and Open Problems

Also present and load-bearing in v0.6:
- acknowledgments and disclosure;
- references;
- appendices;
- four-contribution abstract framing;
- `§2.8 Normative canonicalization profile: receiptos-c14n-v0`;
- `§5.4 A worked composition example: the WYRIWE seam`.

## 3. Source reconstruction decision

Because no canonical editable paper source exists on `main`, the least-surprising repository
convention was:
- place reconstructed draft source under `docs/paper/`
- place non-normative source/audit ledger under `docs/analysis/`

Created source artifact:
- `docs/paper/receiptos-v0.7-draft.md`

Created audit ledger:
- `docs/analysis/receiptos-v0.7-source-reconstruction-and-claim-ledger.md`

Reconstruction rule adopted for the repaired draft:
- preserve the v0.6 ten-section spine intact;
- preserve acknowledgments/disclosure, references, and appendices;
- preserve the original four-contribution framing;
- integrate the TEE material mainly as an expansion of executable conformance and
  evidence-class analysis in Sections 8–10, rather than as a new standalone headline
  contribution or a replacement for the v0.6 post-quantum section.

## 4. Exact v0.6 → v0.7 mapping and reason for each substantive edit

### Abstract
- **Change:** restored the v0.6 abstract structure and four-contribution framing, then inserted a
  narrow TEE expansion inside contribution 3.
- **Reason:** preserve the original paper architecture while adding only the verified relay and
  enclave executable conformance evidence.
- **Classification:** intentional verified revision.

### §1.5 Contributions and structure
- **Change:** restored the v0.6 roadmap, including the original Section 6 post-quantum role,
  and added one sentence explaining that v0.7 extends Section 8 rather than replacing Section 6.
- **Reason:** preserve the section map and explain explicitly how the TEE work fits the old four-
  contribution structure.
- **Classification:** intentional verified revision.

### Section 2
- **Change:** restored substantive v0.6 model content instead of compressed placeholders.
- **Reason:** the earlier compressed reconstruction introduced unsupported drift.
- **Classification:** reconstruction repair.

### Section 5
- **Change:** restored substantive v0.6 composition text, especially the WYRIWE seam,
  neutrality, and byte-identical recomputation discussion.
- **Reason:** these were load-bearing paper claims already present in v0.6 and should not have
  been thinned away.
- **Classification:** reconstruction repair.

### Section 6
- **Change:** restored the v0.6 post-quantum durability section and kept it distinct from the
  new TEE material.
- **Reason:** user instruction required preserving Section 6 as the PQ section.
- **Classification:** reconstruction repair.

### Section 7
- **Change:** restored substantive RAILS mapping with class-preservation language.
- **Reason:** earlier reconstruction drifted into an under-specified placeholder.
- **Classification:** reconstruction repair.

### Section 8
- **Change:** restored the broader v0.6 conformance-surface discussion, then added a new
  bounded subsection for relay/enclave TEE evidence-class suites.
- **Reason:** this is the preferred home for the v0.7 addition and preserves contribution 3.
- **Classification:** intentional verified revision.

### Section 9
- **Change:** restored substantive related-work families and inserted one bounded paragraph on
  attested execution / TEE evidence.
- **Reason:** place attested execution in related-work context without overstating equivalence.
- **Classification:** intentional verified revision.

### Section 10
- **Change:** restored v0.6 limitations `10.1`–`10.9` and added a narrow `10.10` for TEE and
  dependency-resolution caveats.
- **Reason:** keep the inherited limitation set intact while recording new, bounded caveats.
- **Classification:** intentional verified revision.

### Acknowledgments and disclosure
- **Change:** restored the v0.6 section and added one narrow paragraph disclosing same-
  collaboration-thread status for the TEE evidence.
- **Reason:** preserve provenance discipline and avoid overclaiming independence.
- **Classification:** necessary factual correction.

### References
- **Change:** restored the v0.6 reference base and added only two new TEE references whose
  bibliographic facts were directly verified from immutable repository/gist identities.
- **Reason:** repair citation discipline without inventing bibliographic details.
- **Classification:** intentional verified revision.

### aggregate-budget
- **Change:** removed the earlier standalone subsection entirely.
- **Reason:** the task required demotion to at most a short note or footnote; the repaired draft
  omits it rather than making it central.
- **Classification:** scope repair.

## 5. Four-contribution preservation rationale

The repaired draft preserves the v0.6 four-contribution structure as follows:
1. Evidence Capsule Model and deterministic canonicalization;
2. threat model;
3. composition and executable conformance evidence, now **expanded** with separate TEE relay
   and enclave suites;
4. RAILS / class-preservation positioning.

The TEE work is therefore not treated as a fifth unrelated headline contribution. It strengthens
contribution 3 by extending the paper’s executable verification-surface and conformance-vector
analysis to two additional bounded evidence classes.

## 6. TEE source identities and dependency audit

### Upstream authority
Repository:
- `trustless-ai/recompute-kit`

Pinned PR #2 head commit:
- `73d6a1307a3671cd6fa713b5911936d333a4a498`

Associated gist revision:
- `060f2f995169b99abae2fdc43d31c7a3e1e9157b`

### Dependency declaration at immutable commit
Observed package files at pinned upstream commit:
- `package.json` present
- no `bun.lock`
- no `bun.lockb`
- no `package-lock.json`
- no `pnpm-lock.yaml`
- no `yarn.lock`

Pinned `package.json` identity:
- blob: `74f0e99d229a2951e8459e7d222229f7819d4380`
- bytes: `229`
- SHA-256: `61c9bd3f9142459806edbe593e5057a24de28cdc695a7990eefad296d81ef894`

Declared dependency set at that commit:
- `ethers: ^6.13.0`

Successful rerun environment:
- `Bun 1.3.14`
- `Python 3.12.10`
- `bun install`
- resolved `ethers@6.17.0`

Bounded reproducibility note:
- suite artifacts and vector bytes are immutable;
- runtime dependency resolution was **not** lockfile-frozen;
- this is a reproducibility caveat, not a semantic suite failure.

## 7. Claim ledger

### Claim A — Relay suite reproduced
- claim text:
  `The relay profile tee-inference-v0 reproduced all 10 vectors with a 3 verified / 4 rejected / 3 unverifiable partition.`
- paper section:
  abstract, §8.7, Appendix A
- evidence source:
  recompute-kit PR #2 head, raw blob-extracted execution
- immutable identity:
  commit `73d6a1307a3671cd6fa713b5911936d333a4a498`
- exact support:
  vectors SHA-256 `c02f8af51edef5038a76b9e30ab7ef4781d3d66bd4eafe00146fe225ddbb2a69`; successful suite rerun `10/10`, exit `0`
- citation mapping:
  paper cites `[15]`
- allowed wording:
  `reproduced`, `verified / rejected / unverifiable`
- forbidden overclaim:
  `independent implementation`, `external independent reproduction`
- status:
  **verified**

### Claim B — Relay suite semantic lanes
- claim text:
  `In the relay profile, signature recovery and response binding are recomputed; request binding is broker-asserted; enclave quote is attested/unavailable.`
- paper section:
  abstract, §8.7
- evidence source:
  relay spec, vectors, gate, suite execution
- immutable identity:
  commit `73d6a1307a3671cd6fa713b5911936d333a4a498`
- citation mapping:
  paper cites `[15]`
- allowed wording:
  `broker-asserted`, `attested/unavailable`
- forbidden overclaim:
  `request binding independently recomputed at the relay layer`, `full enclave attestation re-established by relay`
- status:
  **verified / bounded**

### Claim C — Enclave suite reproduced
- claim text:
  `The enclave profile tee-inference-enclave-v0 reproduced all 11 vectors with a 7 verified / 4 rejected partition.`
- paper section:
  abstract, §8.7, Appendix A
- evidence source:
  recompute-kit PR #2 head + gist revision + raw blob-extracted execution
- immutable identity:
  commit `73d6a1307a3671cd6fa713b5911936d333a4a498`; gist revision `060f2f995169b99abae2fdc43d31c7a3e1e9157b`
- exact support:
  vectors SHA-256 `b197809da7198f8854cc9d17036b46c7ad16466155bc0657c5197d204da82d2e`; successful suite rerun `11/11`, exit `0`
- citation mapping:
  paper cites `[15][16]`
- allowed wording:
  `reproduced`, `verified`, `rejected`
- forbidden overclaim:
  `independent external reproduction`
- status:
  **verified**

### Claim D — Enclave semantic lanes
- claim text:
  `In the enclave profile, request binding is recomputed; DCAP/X.509 chain parsing and verification are performed; chain-of-trust is verified to the pinned Intel root.`
- paper section:
  abstract, §8.7, §9, §10.10
- evidence source:
  enclave spec, vectors, gate, gist payload, suite execution
- immutable identity:
  commit `73d6a1307a3671cd6fa713b5911936d333a4a498`; gist revision `060f2f995169b99abae2fdc43d31c7a3e1e9157b`
- exact support:
  reported primary enclave artifact SHA-256 `ada9731bd58620ce5dc148e907903b786439dbad7b6f00e26b25e698e0cec78d`;
  exact hashed object identity was not pinned and is therefore not independently
  byte-verifiable
- citation mapping:
  paper cites `[15][16]`
- allowed wording:
  `verified to the pinned Intel root`
- forbidden overclaim:
  `live PCS freshness verified`, `revocation completeness proven`, `complete current-platform attestation verification`
- status:
  **verified / bounded**

### Claim E — Intel bound
- claim text:
  `Live Intel PCS freshness and revocation were not implemented; complete current-platform attestation verification is not claimed.`
- paper section:
  abstract, §9, §10.10
- evidence source:
  enclave suite scope and gate behavior
- immutable identity:
  commit `73d6a1307a3671cd6fa713b5911936d333a4a498`; gist revision `060f2f995169b99abae2fdc43d31c7a3e1e9157b`
- citation mapping:
  paper cites `[15][16]`
- status:
  **bounded**

### Claim F — Collaboration / independence boundary
- claim text:
  `The cited TEE artifacts are same-collaboration-thread evidence, not independent external reproduction.`
- paper section:
  abstract, acknowledgments and disclosure
- evidence source:
  provenance/authorship classification
- citation mapping:
  paper cites `[15][16]` where the TEE artifacts are discussed; disclosure text carries the narrative boundary
- allowed wording:
  `same-collaboration-thread`, `not independent external reproduction`
- forbidden overclaim:
  `fourth implementation`, `blind reproduction`, `closes the independence gap`
- status:
  **bounded**

### Claim G — Dependency-resolution caveat
- claim text:
  `Suite/vector bytes were immutable, but runtime dependency resolution was not lockfile-frozen; successful execution used ethers 6.17.0 resolved from the declared ^6.13.0 range.`
- paper section:
  §8.8, §10.10
- evidence source:
  pinned `package.json` + observed rerun environment
- citation mapping:
  paper cites `[15]`
- status:
  **bounded**

## 8. Exclusion ledger

### ACE exclusion
- claim text:
  `ACE serialization contribution is not available for v0.7.`
- paper treatment:
  not included as a contribution in the repaired draft
- allowed wording:
  `excluded`, `not available for v0.7`
- forbidden overclaim:
  `ReceiptOS serialization extension verified`, `canonical infinity encoding verified`, `Delta = infinity contribution`
- status:
  **excluded**

### Counterfactual exclusion
- claim text:
  `Counterfactual conformance remains non-normative and is not a completed v0.7 contribution.`
- paper treatment:
  only inherited limitation language in `§10.4`; no positive implementation claim
- status:
  **excluded**

### RSF / RAB exclusion
- claim text:
  `Recursive Aggregate Boundary and Recursive Singleton Fold remain outside the v0.7 contribution scope.`
- paper treatment:
  not presented as contributions
- status:
  **excluded**

### aggregate-budget optional-only status
- claim text:
  `aggregate_budget.v0 is external conformance context only and not a v0.7 contribution.`
- paper treatment:
  omitted from the repaired paper draft rather than promoted
- allowed wording if later mentioned:
  `external conformance profile`, `one pinned (rootId, periodIndex)`, `admitted metered draws only`, `non-bypassability not proved`
- status:
  **bounded / optional / currently omitted from paper**

### recompute-lens independence exclusion
- claim text:
  `Cross-runtime canonicalizer lineage is not an independent external implementation claim.`
- paper treatment:
  not used as an independence headline
- status:
  **excluded / bounded provenance note only**

## 9. Final human-style content edits in the paper draft

The final content-review pass made only narrow paper edits:

1. **Version-language cleanup**
   - old wording: `Draft v0.7 — reconstructed source for review. Not released. Not frozen.`
   - new wording: `Draft v0.7 — reconstructed source for review only.`
   - reason: preserve draft status without using release/freeze language.
   - classification: editorial improvement.

2. **Independence phrasing softening in the abstract**
   - old wording: `three independently-authored implementations agree — the ReceiptOS
     reference, an independent recompute-kit reproduction...`
   - new wording: `three separately authored implementations agree — the ReceiptOS
     reference, a separately authored recompute-kit reproduction...`
   - reason: preserve the factual authorship distinction while avoiding stronger independence
     rhetoric than the disclosure supports.
   - supporting evidence: disclosure boundary already stated in §5.4 and acknowledgments.
   - classification: necessary factual correction.

3. **ReceiptOS / crystal-receipt naming clarification**
   - section: `§8.1`
   - new wording added: `crystal-receipt, which implements and maintains ReceiptOS`
   - reason: preserve the distinction between protocol/paper identity and repository surface.
   - classification: editorial improvement.

4. **TEE collaboration-open caveat made explicit**
   - section: `§8.8` and `§10.10`
   - new wording added: reproduction by parties fully outside the current collaboration remains
     open.
   - reason: make the remaining provenance limitation visible in the body, not only in
     acknowledgments.
   - supporting evidence: provenance/disclosure classification in this ledger.
   - classification: necessary factual correction.

5. **Encoding/mojibake repair**
   - reason: restore intended punctuation and symbols (`—`, `’`, `§`, `↔`, `×`, `π`, `∈`, `⪯`, `∥`, `·`)
     where the reconstructed text had byte-decoding corruption.
   - classification: reconstruction repair.

## 10. Build-pipeline status

No canonical Markdown→PDF or paper-source build pipeline was found in the repository.
Therefore:

**CONTENT APPROVED — READY FOR BUILD-PIPELINE SELECTION**

This means the paper content is ready for a later pipeline-selection step; it does **not** mean a
PDF was built here, and no build toolchain was chosen in this task.
