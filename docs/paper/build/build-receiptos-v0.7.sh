#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE="$REPO_ROOT/docs/paper/receiptos-v0.7-draft.md"
TEMPLATE="$REPO_ROOT/docs/paper/build/receiptos-v0.7-template.tex"
OUTPUT_DIR="${1:-$REPO_ROOT/docs/paper/generated}"
EXPECTED_SHA="16c5d50b7e692acf7cc633a80c6381c876b6a0100ae53b257625c53d9fad1bb4"
PDF_NAME="Tvardovskyi_ReceiptOS_v0.7_draft.pdf"

export TZ="${TZ:-UTC}"
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"
if [[ -z "${SOURCE_DATE_EPOCH:-}" ]]; then
  echo "SOURCE_DATE_EPOCH must be set" >&2
  exit 2
fi

actual_sha="$(sha256sum "$SOURCE" | awk '{print $1}')"
if [[ "$actual_sha" != "$EXPECTED_SHA" ]]; then
  echo "Source SHA mismatch: expected $EXPECTED_SHA got $actual_sha" >&2
  exit 3
fi

mkdir -p "$OUTPUT_DIR"
BUILD_DIR="$(mktemp -d)"
cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

LATEX_OUT="$BUILD_DIR/receiptos-v0.7.tex"
PDF_OUT="$BUILD_DIR/$PDF_NAME"
TEXT_OUT="$BUILD_DIR/${PDF_NAME%.pdf}.txt"
META_OUT="$BUILD_DIR/${PDF_NAME%.pdf}.metadata.txt"
VERSIONS_OUT="$BUILD_DIR/tool-versions.txt"
LOG_OUT="$BUILD_DIR/latexmk.log"

{
  echo "SOURCE_SHA256=$actual_sha"
  echo "SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH"
  echo "PANDOC=$(command -v pandoc)"
  echo "PDFLATEX=$(command -v pdflatex)"
  echo "LATEXMK=$(command -v latexmk)"
  pandoc --version | head -n 2
  pdflatex --version | head -n 2
  latexmk --version | head -n 2
  qpdf --version
  pdftotext -v 2>&1 | head -n 2
} | tee "$VERSIONS_OUT"

pandoc \
  --from markdown+smart+tex_math_dollars \
  --to latex \
  --standalone \
  --template "$TEMPLATE" \
  --output "$LATEX_OUT" \
  "$SOURCE"

latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error \
  -outdir="$BUILD_DIR" "$LATEX_OUT" | tee "$LOG_OUT"

if [[ ! -f "$PDF_OUT" ]]; then
  echo "Expected PDF not produced: $PDF_OUT" >&2
  exit 4
fi

cp "$LATEX_OUT" "$OUTPUT_DIR/receiptos-v0.7.tex"
cp "$PDF_OUT" "$OUTPUT_DIR/$PDF_NAME"
pdftotext "$PDF_OUT" "$TEXT_OUT"
{
  pdfinfo "$PDF_OUT"
  echo "--- qpdf json ---"
  qpdf --json "$PDF_OUT"
} > "$META_OUT"

pdf_sha="$(sha256sum "$PDF_OUT" | awk '{print $1}')"
pdf_bytes="$(stat -c %s "$PDF_OUT")"
pdf_pages="$(pdfinfo "$PDF_OUT" | awk -F': *' '/^Pages:/ {print $2}')"

echo "PDF_SHA256=$pdf_sha"
echo "PDF_BYTES=$pdf_bytes"
echo "PDF_PAGES=$pdf_pages"
echo "PDF_PATH=$OUTPUT_DIR/$PDF_NAME"

echo "BUILD_DIR=$BUILD_DIR"
