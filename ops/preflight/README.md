# Printy Preflight Wrappers

This directory is mounted into Docker at `/opt/printy/preflight` for deployment-provided PDF/X validator wrappers.

Plain `veraPDF` is available in the image, but plain veraPDF success must not be treated as PDF/X certification. Only configure `PRINTY_PREFLIGHT_COMMAND` when the command or wrapper actually checks the intended PDF/X requirement and exits `0` only on a real pass.

Use `example-pdfx-validator.sh` as a fail-closed template. It always exits non-zero, so it can only produce `validation-failed`; replace or adapt it when a licensed validator, policy-backed validator, or print-shop-approved wrapper is available.

ICC profiles and proprietary validator binaries should come from deployment mounts or pinned image assets. Do not commit commercial ICC files or proprietary validator payloads unless their license explicitly allows redistribution.

Recommended PDF/X-capable production validators are commercial headless tools such as callas pdfToolbox CLI, Enfocus PitStop Library Container, or Qoppa PDF Automation Server. Configure them through a wrapper that exits `0` only after the chosen PDF/X profile truly passes. `commercial-pdfx-validator.example.sh` is a fail-closed template for that integration. JHOVE is a free/open-source option for legacy PDF/X-1, PDF/X-1a, PDF/X-2, and PDF/X-3 checks only; do not use it to claim PDF/X-4 or newer validation.

## Docker Smoke

After starting the Docker service, run the repeatable HTTP smoke from the host:

```powershell
$env:PRINTY_SMOKE_ADMIN_CONTACT="01000000000"
$env:PRINTY_SMOKE_ADMIN_TOKEN="test-admin-token"
npm.cmd run smoke:docker-prepress
```

The smoke does not read `.env.local`. It logs in through `/api/admin/session`, verifies the unsaved draft helper PDF endpoint, creates a temporary 90mm x 50mm admin business-card template, verifies the saved-template helper PDF endpoint, verifies the prepress check endpoint, and deletes the temporary template.

When testing the fail-closed example wrapper, start Docker with `PRINTY_PREFLIGHT_COMMAND=/bin/sh` and `PRINTY_PREFLIGHT_ARGS="/opt/printy/preflight/example-pdfx-validator.sh {pdf}"`, then run the smoke with `PRINTY_SMOKE_EXPECT_FAIL_CLOSED=1`. The expected result is `validation-failed`, not `pdfx-validated`.
