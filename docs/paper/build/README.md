# ReceiptOS v0.7 PDF build surface

This directory contains the minimal canonical build surface for rendering the approved
ReceiptOS v0.7 Markdown source through:

Markdown → Pandoc → LaTeX → pdfLaTeX via latexmk → PDF

## Canonical source

- `docs/paper/receiptos-v0.7-draft.md`
- required SHA-256:
  `16c5d50b7e692acf7cc633a80c6381c876b6a0100ae53b257625c53d9fad1bb4`

The build script verifies that source identity before building.

## Files

- `receiptos-v0.7-template.tex` — restrained academic LaTeX template aiming to match
  the v0.6 visual language
- `build-receiptos-v0.7.sh` — clean temporary-directory build script used by CI

## Environment

The canonical CI environment is Ubuntu with explicit package installation of:
- pandoc
- texlive-latex-base
- texlive-latex-recommended
- texlive-latex-extra
- texlive-fonts-recommended
- texlive-science
- latexmk
- poppler-utils
- qpdf

The workflow sets:
- `SOURCE_DATE_EPOCH`
- `TZ=UTC`
- `LANG=C.UTF-8`
- `LC_ALL=C.UTF-8`

## Output

The generated review PDF is written to:
- `docs/paper/generated/Tvardovskyi_ReceiptOS_v0.7_draft.pdf`

This is a **draft review artifact**, not a release artifact.
