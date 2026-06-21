const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tmdbToken: process.env.TMDB_API_TOKEN,
  omdbKey: process.env.OMDB_API_KEY,
  traktClientId: process.env.TRAKT_CLIENT_ID,
  traktClientSecret: process.env.TRAKT_CLIENT_SECRET,
  traktRedirectUri: process.env.TRAKT_REDIRECT_URI,
  traktEncryptionKey: process.env.TRAKT_TOKEN_ENCRYPTION_KEY,
  cronSecret: process.env.CRON_SECRET,
  siteUrl: siteUrl.replace(/\/$/, "")
};

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasTmdb = Boolean(env.tmdbToken);
