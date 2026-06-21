# MovieTracker production deployment

Use one final HTTPS origin everywhere below, for example `https://your-project.vercel.app`. If you later add a custom domain, repeat the URL-specific steps with that domain.

## 1. Publish the code safely

`.env.local` is ignored by Git and must never be committed. Create an empty private GitHub repository, then run from this project folder:

```powershell
git init
git add .
git commit -m "Initial MovieTracker deployment"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-NAME/YOUR-REPOSITORY.git
git push -u origin main
```

## 2. Import into Vercel

1. Open https://vercel.com/new and import the GitHub repository.
2. Leave Framework Preset as Next.js, Root Directory as the repository root, and Build Command as the default.
3. Add the environment variables listed below to Production. You may omit the two URL-specific values for the first deployment if the final Vercel URL is not known yet.
4. Deploy and copy the stable production URL shown by Vercel.

## 3. Vercel environment variables

Copy values from `.env.local`; never add the variable names to `NEXT_PUBLIC_` unless they already have that prefix.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TMDB_API_TOKEN
OMDB_API_KEY
TRAKT_CLIENT_ID
TRAKT_CLIENT_SECRET
TRAKT_TOKEN_ENCRYPTION_KEY
CRON_SECRET
```

Use the final production origin for:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-PRODUCTION-DOMAIN
TRAKT_REDIRECT_URI=https://YOUR-PRODUCTION-DOMAIN/api/integrations/trakt/callback
```

Keep the exact existing `TRAKT_TOKEN_ENCRYPTION_KEY`; changing it makes already stored Trakt tokens unreadable. After adding or changing environment variables, redeploy because Vercel applies changes only to new deployments.

## 4. Supabase Auth URL configuration

In Supabase, open Authentication > URL Configuration:

- Site URL: `https://YOUR-PRODUCTION-DOMAIN`
- Redirect URLs:
  - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
  - `http://localhost:3000/auth/callback` if local development should keep working

The existing Supabase database and users stay where they are; Vercel connects to the same project. Ensure migrations `0001` through `0007` have been run once.

## 5. Google sign-in

In Google Cloud > Google Auth Platform > Clients, open the existing Web OAuth client:

- Add Authorized JavaScript origin: `https://YOUR-PRODUCTION-DOMAIN`
- Keep or remove `http://localhost:3000` depending on whether local Google login is still needed.
- Authorized redirect URI remains the Supabase callback, not the Vercel callback:
  `https://YOUR-SUPABASE-PROJECT-REF.supabase.co/auth/v1/callback`

The Google client ID and secret remain configured in Supabase Authentication > Providers > Google; they are not Vercel variables in this app.

## 6. Trakt

Open the existing Trakt API application and add or replace its redirect URI with:

`https://YOUR-PRODUCTION-DOMAIN/api/integrations/trakt/callback`

It must exactly equal `TRAKT_REDIRECT_URI` in Vercel, including HTTPS and with no trailing slash.

## 7. Final redeploy and verification

1. In Vercel, open Deployments, select the latest deployment, and choose Redeploy.
2. Test email registration and confirmation.
3. Test Google login in a private browser window.
4. Test password reset.
5. Open Settings > Integrations, reconnect Trakt if needed, and run Sync now.
6. Upload an avatar to verify Supabase Storage.
7. Track and rate a title, refresh, and verify persistence.
8. Open `/api/cron/catalog` without authorization and confirm it returns Unauthorized; Vercel Cron supplies `CRON_SECRET` automatically.

The included cron runs once daily at 03:17 UTC, which is compatible with Vercel Hobby. More frequent schedules require Vercel Pro.
