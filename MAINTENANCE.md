# Printy Maintenance Guide

This guide captures the current project structure and the rules that must be followed when maintaining Printy or adding new features.

## Project Shape

Printy is a Next.js App Router application using React, TypeScript, Tailwind CSS, and Zustand.

The current architecture intentionally avoids monolithic files:

- `components/printy-app.tsx` is a thin shell only.
- `components/printy/onboarding/` owns onboarding screens and selectors.
- `components/printy/logo/` owns logo generation, selection, revision, and related UI state helpers.
- `components/printy/dashboard/` owns dashboard tabs and brand detail screens.
- `components/ui.tsx` owns shared visual atoms.
- `lib/logo/` owns logo validation and generated-logo lookup helpers.
- `store/use-printy-store.ts` owns Zustand store creation, initial state, persistence wiring, and public exports only.
- `store/printy-store-*-actions.ts` files own state mutation/action groups.
- `store/printy-store-*.ts` helper files own defaults, normalizers, persistence, id/date helpers, order helpers, product mapping, notifications, and generated logo persistence.

## Mandatory First Step

Before changing code, read this file and inspect the owning module for the feature or bug. Do not rely on memory or assumptions about the codebase.

## Change Principles

- Keep changes localized to the owning screen, helper, or store action factory.
- Add new files when a feature has a clear owner; do not grow `printy-app.tsx` or `use-printy-store.ts` back into monoliths.
- Prefer one source of truth for shared logic. If logic is used by multiple screens or store actions, move it to `lib/` or a focused `store/printy-store-*.ts` helper.
- Remove stale declarations after moving code. During development, a broken build is better than silently keeping old paths alive.
- Do not add compatibility wrappers, fallback paths, or legacy shims unless needed for persisted data, shipped behavior, or external consumers.
- Do not duplicate functions, variables, store logic, or generated-logo lookup code across modules.
- Preserve Korean UI copy unless the requested task explicitly changes copy.

## Store Rules

- Keep `usePrintyStore` exported from `@/store/use-printy-store`.
- Keep `getOrderPrice` re-exported from `@/store/use-printy-store` unless all callers are intentionally migrated in the same change.
- Preserve the Zustand persisted storage key: `printy-store`.
- Preserve persisted state shape unless a migration is explicitly planned and verified.
- Keep persistence logic in `store/printy-store-persistence.ts`.
- Keep the root `use-printy-store.ts` as store assembly only: initial state, action factory spreads, `persist()`, and public exports.
- Put new state actions in focused action factories instead of inline in `use-printy-store.ts`.
- Use existing action factory groups when possible:
  - draft/input actions: `printy-store-draft-actions.ts`
  - logo lifecycle actions: `printy-store-logo-actions.ts`
  - navigation/dashboard actions: `printy-store-navigation-actions.ts`
  - session actions: `printy-store-session-actions.ts`
  - onboarding/checkout actions: `printy-store-onboarding-actions.ts`
  - catalog/brand production actions: `printy-store-catalog-actions.ts`
- Type store factories from `StateCreator<PrintyState>` parameters. Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`.

## UI Rules

- Put screen-specific UI in the matching `components/printy/...` directory.
- Put shared UI atoms in `components/ui.tsx` only when they are truly reusable.
- Do not create a Canva-style free editor unless the product direction explicitly changes.
- Keep user choices focused. Do not introduce many extra options just because a feature could support them.
- For frontend changes, verify desktop/mobile-relevant behavior when the UI surface is affected.

## Logo Generation Rules

- Keep OpenAI calls server-side. Do not expose `OPENAI_API_KEY` to client code.
- Do not read or print `.env.local`.
- Do not show fallback SVG/generated placeholders to users as if they are real logo results.
- Keep generated logo validation in `lib/logo/logoValidation.ts`.
- Keep generated logo lookup in `lib/logo/generatedLogoLookup.ts`.
- For logo revision, preserve the selected source logo behavior and explicit error states when the source logo is missing.

## Refactoring Rules

- Refactor only inside the scope needed for the current task.
- Separate behavior-preserving refactors from behavior changes when practical.
- After extracting code, search for stale declarations in the old file.
- Prefer fail-fast imports over hidden compatibility paths.
- Do not weaken types or tests to make a refactor pass.

## New Feature Checklist

1. Identify the owning screen/module.
2. Identify whether state belongs in an existing store action factory or a new focused action factory.
3. Identify reusable logic and put it in `lib/` or a focused `store/printy-store-*.ts` helper.
4. Keep public imports stable unless migration is part of the task.
5. Preserve `printy-store` persistence behavior unless the feature explicitly requires a migration.
6. Verify the user-visible flow through the app surface, not just TypeScript.

## Verification Checklist

Run checks appropriate to the files changed. For shared store or cross-screen changes, run all of these:

```powershell
npm.cmd run lint
npm.cmd run build
```

Also run TypeScript/LSP diagnostics for every changed TypeScript or TSX file.

For changes affecting onboarding, checkout, dashboard, store persistence, or generated logos, perform a browser smoke check that covers:

- onboarding start
- logo generation or mocked logo generation
- logo selection
- business card flow
- order options
- login
- checkout completion
- dashboard entry
- reload with `localStorage.printy-store` preserved
- no console errors

If a verification step cannot be run, state exactly why in the handoff.

## Known Environment Notes

- Use `npm.cmd`/`npx.cmd` on Windows PowerShell when script shims are blocked by execution policy.
- `rg` may not be available in this environment; use an equivalent repository search if needed.
- Actual OpenAI image generation may require organization verification for the configured image model. Mock the API only for local UI/persistence smoke tests.

## Production-Parity Server Environment

When preparing Printy for a real server, use Linux/Docker as the source of truth instead of treating a Windows developer machine as the production environment.

- Keep the Windows PC as the editing/development host; run production-like checks inside the Docker/Linux environment.
- Do not make Windows-native Ghostscript/qpdf/veraPDF paths the canonical setup. Windows paths such as `gswin64c.exe` and `C:\Windows\Fonts\...` do not transfer to Linux servers.
- Keep the print-shop/prepress route on Node.js runtime. Do not move native PDF processing to Edge runtime or pure serverless unless the native toolchain and persistent storage are explicitly reworked.
- Install native prepress tools in the Linux runtime image: Ghostscript, qpdf, Java, veraPDF CLI for standards validation checks, and Korean-capable fonts. Provide PDF/X-capable validators or wrapper scripts and CMYK ICC profiles through pinned image assets or deployment mounts; do not commit licensed ICC files unless redistribution is allowed.
- The Docker image may include the zlib-licensed basICColor/OpenICC `ISOcoated_v2_bas.ICC` as the default CMYK profile. Print-shop-specific profiles should be mounted under `/opt/printy/color-overrides` and selected with `PRINTY_CMYK_ICC_PATH`.
- Do not treat plain veraPDF success as PDF/X certification. `pdfx-validated` must only mean the configured validator or wrapper has actually verified the intended PDF/X requirement.
- Until a real PDF/X-capable validator is connected, the prepress route can produce a downloadable CMYK/PDF-X candidate for print-shop review, but it must not be described as PDF/X validated or certified by Printy. Human review and the print shop's own preflight can still be used for production decisions.
- callas pdfToolbox is a commercial PDF preflight/PDF/X validation engine, not a design tool. If Printy later needs automated in-system PDF/X validation, prefer evaluating callas pdfToolbox Server/CLI for the Linux/Docker flow first, then compare alternatives such as Enfocus PitStop Library Container if procurement or licensing requires it.
- Configure native tool paths with environment variables: `PRINTY_GHOSTSCRIPT_PATH`, `PRINTY_QPDF_PATH`, `PRINTY_CMYK_ICC_PATH`, `PRINTY_PREFLIGHT_COMMAND`, and `PRINTY_PREFLIGHT_ARGS`.
- Persist file-backed storage with volumes or durable storage: `data/` and `public/uploads/admin/business-card-backgrounds/`.
- Never read, print, commit, copy, or bake `.env.local` into a Docker image. Use `.env.example`/`.env.docker.example` templates plus deployment secrets.
- Before handing off a server migration, verify the same Docker image can build, start, write to the persisted paths, and generate/check the print-shop PDF flow with the intended ICC profile and validator mounted or packaged.

## Future Production Service Roadmap

The intended production path is to make Printy work first with Docker-managed PostgreSQL and server-owned APIs, then move the same PostgreSQL schema and service boundaries to Supabase or a real server later.

- Keep Docker/Linux as the local production-parity environment. Add services such as `postgres`, a reverse proxy, and eventually a worker/queue only through explicit Compose changes.
- Prefer PostgreSQL-standard SQL migrations under a versioned migration directory, so the same schema can be applied to local Docker PostgreSQL and later Supabase PostgreSQL.
- Keep database access behind server-only modules such as `lib/server/db.ts`, `lib/server/users.ts`, `lib/server/auth/*`, `lib/server/brands.ts`, and template store modules. Do not call Supabase, PostgreSQL, or storage SDKs directly from React components or Zustand stores.
- Treat Zustand as UI/session draft state only. Persisted business data such as users, brands, members, generated logos, business-card templates, business-card drafts, and orders should be loaded/saved through API routes backed by the database.
- Start with Docker PostgreSQL and `DATABASE_URL`; later Supabase migration should primarily replace connection/auth/storage configuration, not force a frontend rewrite.
- Keep secrets in deployment environment variables or secret managers. Required future variables may include `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, and `KAKAO_REDIRECT_URI`.

Recommended implementation phases:

1. Add Docker PostgreSQL with healthchecks, durable volumes, and an app `DATABASE_URL`.
2. Add SQL migrations for auth/session/users first, then brands, members, generated logos, business-card templates, drafts, orders, and uploaded file metadata.
3. Implement server-side session auth with HttpOnly cookies and DB-backed users before replacing the current local demo login.
4. Add Google OAuth and Kakao OAuth through server routes that upsert users and issue the same HttpOnly session cookie.
5. Move admin business-card templates and background metadata from file-backed JSON/storage into PostgreSQL while preserving the public API response shape.
6. Add import/export scripts for existing `data/business-card-templates.json` and `public/uploads/admin/business-card-backgrounds/`, so templates created during development can be carried into production.
7. Move long-running OpenAI logo generation, Chromium PDF generation, and prepress checks to worker/queue infrastructure if request latency or concurrency becomes an operational issue.
8. Add reverse proxy, HTTPS, security headers, backups, structured logs, health endpoints, and monitoring before public launch.

OAuth and auth rules:

- Implement Google/Kakao OAuth on the server side only: start route, callback route, provider token exchange, provider profile fetch, DB user upsert, and HttpOnly session cookie issue.
- Keep provider IDs and emails in database fields that allow account linking later. Do not assume every provider returns the same verified email shape.
- Keep `/api/session` as the client-facing source of truth for authenticated state restoration after reload.
- Use server-side logout to clear the HttpOnly cookie and invalidate the session row when DB-backed sessions are enabled.
- If Supabase Auth is adopted later, keep the public client-facing auth API stable and swap the implementation inside `lib/server/auth/*` where practical.

Business-card template production rules:

- Preserve the existing business-card template schema, especially `layout`, `sides`, `fields`, `icons`, `background`, `status`, `source`, and `orientation` shapes unless a deliberate migration is written.
- Store business-card template `layout` as PostgreSQL `jsonb` and keep commonly queried fields such as `id`, `title`, `summary`, `tags`, `orientation`, `status`, `source`, `created_at`, and `updated_at` as columns.
- Continue exposing only `status === "published"` admin business-card templates to user-facing public template APIs.
- Keep public route semantics stable: user previews and PDF routes should be able to load the same saved admin templates after moving from file storage to DB.
- Migrate template background images together with templates. If moving to Supabase Storage later, preserve a stable public/storage URL mapping or write a migration that updates `layout.sides.*.background.imageUrl` safely.
- Do not discard development-created admin templates during migration. Provide an explicit one-time import step from current JSON/file storage into PostgreSQL/Supabase.

Suggested initial database tables:

- `users`: local user identity and linked provider metadata.
- `auth_sessions`: HttpOnly cookie-backed sessions with expiry and revocation.
- `brands`: user-owned brand records.
- `members`: brand team/member records used for business cards.
- `generated_logos`: OpenAI-generated logo metadata and image/storage references.
- `business_card_templates`: admin-created templates with `layout jsonb`.
- `business_card_backgrounds`: managed background image metadata and storage references.
- `business_card_drafts`: user-filled card drafts pointing to templates, members, and logos.
- `orders`: order records and production status.
- `uploaded_files`: optional shared file metadata for local volume or future Supabase Storage.
