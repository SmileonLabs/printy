#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  printf '%s\n' "No PDF path supplied to the PDF/X validator wrapper." >&2
  exit 64
fi

pdf_path="$1"

if [ ! -f "$pdf_path" ]; then
  printf '%s\n' "PDF/X validator wrapper input does not exist: $pdf_path" >&2
  exit 66
fi

printf '%s\n' "No real PDF/X validator is configured for: $pdf_path" >&2
printf '%s\n' "Replace this fail-closed template with a PDF/X-capable validator wrapper before enabling pdfx-validated output." >&2

exit 1
