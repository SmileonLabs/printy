# Deployment

Production deploys run through GitHub Actions on pushes to `main`.

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

## Production URLs

- Worker preview: `https://printy.ljhee3611.workers.dev`
- Custom domain: `https://printy.smileon.app`

The `printy.smileon.app/*` route is declared in `wrangler.jsonc`. Cloudflare DNS still needs a proxied `printy` record in the `smileon.app` zone.
