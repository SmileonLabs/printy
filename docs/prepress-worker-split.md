# Prepress Worker Split

## Current State

- The main `printy` Docker image includes Chromium, Ghostscript, qpdf, Java, veraPDF, ICC assets, and Korean fonts.
- This keeps PDF preview and prepress generation simple, but the runtime image is large because web/API traffic and native print processing share one container.
- The prepress entry point is currently `app/api/admin/templates/[templateId]/print-shop-pdf/route.ts` with `variant=prepress`.
- The shared HTML/PDF rendering path is `lib/print-shop-business-card-pdf.ts`, and native conversion/checks live under `lib/prepress/`.

## Recommended Split

Keep the main app image responsible for:

- Next.js app routes and UI.
- Auth/session/database APIs.
- OpenAI logo generation and file-backed uploads.
- Basic Chromium PDF rendering only if immediate user PDF downloads must remain synchronous.

Move to a separate prepress worker image:

- Ghostscript, qpdf, Java, veraPDF, PDF/X validator wrapper, ICC profiles, and print-shop-specific native tooling.
- Admin `variant=prepress` jobs.
- Future queue-based CMYK/PDF-X candidate generation.

## Boundary

Use an internal worker API or queue payload containing:

- `templateId` or a full `PrintTemplate` payload.
- `origin` for resolving local assets.
- `renderData` matching `PrintShopBusinessCardRenderData`.
- requested output: `check-only` or downloadable PDF.

Return:

- `status`, `notes`, `checks`, `downloadable`.
- generated PDF bytes via object storage/file-backed volume URL, not a long-running HTTP response when job duration grows.

## Compose Shape

- `printy`: slim web image with Node, Next standalone output, app storage mounts, and only tools needed by synchronous routes.
- `printy-prepress`: native-heavy image with Ghostscript/qpdf/Java/veraPDF/ICC profiles and access to the same persisted upload assets.
- optional `printy-worker-queue`: Postgres-backed jobs first; Redis/worker queue later only if concurrency requires it.

## Migration Steps

1. Add a `prepress_jobs` table or a small internal worker endpoint guarded by an internal token.
2. Refactor `generatePrepressBusinessCardPdf` so it can run in both app and worker runtimes without importing route code.
3. Change admin prepress route to enqueue/forward jobs when `PRINTY_PREPRESS_WORKER_URL` is configured.
4. Keep local fallback to in-process prepress until the worker is verified.
5. Move Ghostscript/qpdf/Java/veraPDF installation from `Dockerfile` runner to a dedicated worker Dockerfile.
6. Verify PDF generation, uploaded background reads, ICC profile selection, and preflight status parity in Docker.

## Non-Goals

- Do not remove Chromium from the main image until user/admin source PDF routes are either moved to the worker or converted to a remote rendering call.
- Do not label output as PDF/X validated unless the configured PDF/X-capable validator actually verifies it.
- Do not commit licensed print-shop ICC profiles; mount them through deployment secrets or volumes.
