# Deployment

Production deploys run through GitHub Actions on pushes to `main`.

## Environment Model

Use separate databases and secrets for each environment:

- Local development: Docker PostgreSQL from `compose.yaml`, using `.env.local` copied from `.env.docker.example`.
- Staging: a separate Supabase project/database, using values based on `.env.staging.example`.
- Production: the real Supabase production project/database, using deployment secrets based on `.env.production.example`.

Do not point local development at the production Supabase database. Local tests, login sessions, generated logos, orders, and schema experiments should stay on Docker PostgreSQL or staging.

## Supabase PostgreSQL

Printy uses standard PostgreSQL through `DATABASE_URL`; Supabase can be used as hosted PostgreSQL without adopting Supabase Auth or client SDKs.

Required database settings:

- `DATABASE_URL`: Supabase PostgreSQL connection string.
- `PGSSLMODE=require`: required for hosted Supabase connections.

Apply migrations before routing production traffic:

```powershell
$env:DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require"
$env:PGSSLMODE="require"
npm.cmd run db:migrate
```

For staging, run the same command against the staging Supabase connection first. Only run production migrations after staging has passed build, smoke, login, upload, and PDF checks.

## File Storage

Uploaded assets are currently stored through the app storage layer and mirrored into PostgreSQL `uploaded_file_blobs` rows. This means Supabase PostgreSQL can carry generated logos, logo reference images, and admin business-card background bytes without requiring Supabase Storage on day one.

Operational notes:

- Keep Docker volumes for local development and container runtime cache/persistence.
- Keep `uploaded_files` and `uploaded_file_blobs` migrated in staging and production.
- Run `npm.cmd run db:backfill-uploaded-file-blobs` before migrating old file-backed assets if a database does not yet contain blob rows.
- Do not commit `data/`, `public/uploads/admin/business-card-backgrounds/`, or `backups/`.

Supabase Storage can be introduced later behind `lib/server/storage.ts`, but it is not required for the current production path.

## GitHub Secrets

Set these repository secrets before relying on automatic deploys:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare API token needs permission to deploy Workers, Durable Objects, Containers, and the `smileon.app` Worker route.

Application runtime secrets are stored in Cloudflare Worker secrets, not in GitHub Actions:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `PRINTY_ADMIN_CONTACTS`
- `PRINTY_ADMIN_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REDIRECT_URI`
- `SESSION_SECRET`

Set `PGSSLMODE=require` as a non-secret runtime variable for Supabase PostgreSQL. Keep `PRINTY_ALLOW_INSECURE_COOKIES=false` outside local development.

## Production URLs

- Worker preview: `https://printy.ljhee3611.workers.dev`
- Custom domain: `https://printy.smileon.app`

The `printy.smileon.app/*` route is declared in `wrangler.jsonc`. Cloudflare DNS still needs a proxied `printy` record in the `smileon.app` zone.
