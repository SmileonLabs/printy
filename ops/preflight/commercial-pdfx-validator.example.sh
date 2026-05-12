#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  printf '%s\n' "No PDF path supplied to the commercial PDF/X validator wrapper." >&2
  exit 64
fi

pdf_path="$1"

if [ ! -f "$pdf_path" ]; then
  printf '%s\n' "PDF/X validator wrapper input does not exist: $pdf_path" >&2
  exit 66
fi

if [ -z "${PRINTY_PDFX_VALIDATOR_BIN:-}" ]; then
  printf '%s\n' "PRINTY_PDFX_VALIDATOR_BIN is not configured." >&2
  exit 78
fi

if [ -z "${PRINTY_PDFX_PROFILE:-}" ]; then
  printf '%s\n' "PRINTY_PDFX_PROFILE is not configured." >&2
  exit 78
fi

printf '%s\n' "Commercial PDF/X validator wrapper template is not wired to a vendor CLI yet." >&2
printf '%s\n' "Replace the command block below with callas, Enfocus, Qoppa, or another PDF/X-capable validator." >&2

# Example shape only. Keep the wrapper fail-closed until the chosen vendor CLI/API
# is installed, licensed, and verified to return success only on true PDF/X conformance.
# "$PRINTY_PDFX_VALIDATOR_BIN" --profile "$PRINTY_PDFX_PROFILE" --input "$pdf_path"

exit 78
