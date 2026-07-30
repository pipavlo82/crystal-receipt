# ReceiptOS v0.7 PDF build audit

> **Non-normative audit artifact**
>
> This file records the canonical source identity, CI build environment, deterministic
> rendering controls, artifact identities, visual/content review, and remaining limitations for
> the ReceiptOS v0.7 draft PDF build workflow.
>
> This is not a release artifact and does not itself define canonical PDF bytes.

## Canonical source identity

- repository: `pipavlo82/crystal-receipt`
- canonical source path: `docs/paper/receiptos-v0.7-draft.md`
- canonical source SHA-256:
  `16c5d50b7e692acf7cc633a80c6381c876b6a0100ae53b257625c53d9fad1bb4`

## Toolchain

To be populated from CI:
- Ubuntu runner image
- installed package versions
- pandoc version
- pdfLaTeX version
- latexmk version
- qpdf version
- pdftotext version

## Deterministic environment

To be populated from CI:
- `SOURCE_DATE_EPOCH`
- `TZ=UTC`
- `LANG=C.UTF-8`
- `LC_ALL=C.UTF-8`

## Build commands

To be populated from CI build logs.

## Two-build reproducibility

To be populated from CI:
- build A SHA-256 / bytes / pages
- build B SHA-256 / bytes / pages
- byte-identical result
- metadata comparison
- extracted-text comparison

## Render audit

To be populated after artifact inspection:
- visual page audit
- warnings
- overfull material assessment
- content-preservation assessment

## Review PDF identity

To be populated externally from CI artifact results:
- path
- SHA-256
- bytes
- pages
- producer
- creator
- CreationDate
- ModDate
- embedded fonts

## Scope and limitations

- DRAFT REVIEW ARTIFACT — NOT FROZEN
- canonical Markdown source must remain byte-identical to the approved source
- no release, tag, DOI update, or Zenodo upload is performed by this workflow
- this audit file’s own exact identity is intentionally recorded externally to avoid circular self-identification
