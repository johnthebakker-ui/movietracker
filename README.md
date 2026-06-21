# MovieTracker

A production-oriented movie and series tracker built with Next.js, Supabase, and TMDB. It uses live catalog data and real persistence—there is intentionally no mock-content fallback.

## What is implemented

- Verified email/password authentication, Google OAuth, password recovery, sessions, and TOTP authenticator MFA
- Responsive cinematic home, discovery, filtered search, movie/show details, credits, trailers, seasons, and rich episode pages
- Durable progress states, dated watch events, rewatches, individual/bulk episode tracking, and whole-series completion
- Half-star ratings, titled reviews, spoiler protection, favorites, and unlimited ordered mixed-media lists
- Profiles with avatar/banner uploads, regional preferences, themes, granular privacy, follow requests, and notifications
- Personal statistics, explainable cold-start recommendations, JSON data export, PWA manifest, and scheduled catalog hydration
- PostgreSQL row-level security for private data and storage ownership

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project. Run every numbered file in `supabase/migrations` in order (`0001` through `0007`) in its SQL editor or through the Supabase CLI.

3. Copy `.env.example` to `.env.local` and fill in:

   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase API settings.
   - `SUPABASE_SERVICE_ROLE_KEY` for trusted catalog hydration and account deletion. Never expose it to the browser.
   - `TMDB_API_TOKEN`, using the TMDB v4 read-access token.
   - `OMDB_API_KEY` (optional), to show IMDb, Rotten Tomatoes, and Metacritic ratings alongside MovieTracker and TMDB scores.
   - `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`, and `TRAKT_REDIRECT_URI` from your Trakt API application.
   - `TRAKT_TOKEN_ENCRYPTION_KEY`, a private 32-byte base64 key used to encrypt OAuth tokens at rest.
   - `NEXT_PUBLIC_SITE_URL`; use `http://localhost:3000` locally and the public HTTPS origin in production.
   - `CRON_SECRET`, a long random value used by catalog jobs.

4. In Supabase Authentication:

   - Add `http://localhost:3000/auth/callback` and the production callback URL to allowed redirects.
   - Enable email confirmation, Google, and TOTP MFA.
   - Configure the Google client ID/secret and add the Supabase OAuth callback URL in Google Cloud.

5. Start the app:

   ```bash
   npm run dev
   ```

## Deployment

Deploy to Vercel and set the same environment variables there. `vercel.json` invokes `/api/cron/catalog` daily so it works on Vercel Hobby; Pro projects can increase the frequency. Vercel sends `CRON_SECRET` as the bearer credential. The job hydrates trending, upcoming movie, and upcoming series data while title pages hydrate on demand. See `DEPLOYMENT.md` for the production OAuth and callback checklist.

Supabase storage is configured by the migration for public profile media with per-user write policies. TMDB images remain on TMDB’s CDN and the required TMDB attribution appears in the footer.

## Security model

All user mutations require a verified Supabase session. Row-level policies protect history, progress, ratings, favorites, lists, follows, notifications, imports, and profile media independently of UI behavior. The service-role key is used only in server-only modules.

Before a public launch, configure SMTP, CAPTCHA, rate limits, backups, log retention, Sentry (or equivalent), abuse-report operations, terms, and a privacy policy. Validate RLS policies against a staging Supabase project with separate anonymous, follower, non-follower, blocked, and owner sessions.

## Commands

- `npm run dev` — development server
- `npm run typecheck` — strict TypeScript validation
- `npm run lint` — Next.js ESLint rules
- `npm test` — unit tests
- `npm run build` — production build

## Portability

`/data` exposes a complete authenticated JSON export. The migration includes resumable `import_jobs` storage for a deployment worker. Provider imports should be processed in background jobs because large Trakt histories exceed normal server-action timeouts; the UI deliberately does not pretend a browser-only upload is durable.

## Android / Google AI Studio

The responsive site is already installable as a PWA and works from the same Vercel URL on phones. A later Android client should authenticate directly with the same Supabase project and use the same database/RLS model. Keep `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_TOKEN`, `OMDB_API_KEY`, and `CRON_SECRET` on Vercel only; a native app must call protected Vercel endpoints for catalog/provider requests and must never bundle those secrets. The public Supabase URL and publishable/anon key are safe in a client when RLS remains enabled.

## Trakt synchronization

Connect Trakt under Settings → Integrations. The first manual sync imports watched history, ratings, and watchlist titles. Further MovieTracker watches, ratings, and planned titles are pushed to Trakt immediately. While a signed-in MovieTracker tab is open, incoming Trakt activity is checked every five minutes; `/api/cron/trakt` is also available for protected background scheduling using `CRON_SECRET`. Provider reference records make repeated imports idempotent and OAuth tokens are AES-256-GCM encrypted before storage.

Individual watches can be logged with a user-selected local date/time or removed from `/history`. Deletion tombstones prevent a removed Trakt watch from being silently imported again during the next poll.
