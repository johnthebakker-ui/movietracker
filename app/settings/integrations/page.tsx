import { CheckCircle2, Clock3, Radio, ShieldCheck } from "lucide-react";
import { TraktControls } from "@/components/trakt-controls";
import { env } from "@/lib/env";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export default async function IntegrationsSettings({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const notice = await searchParams; const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null; const admin = createSupabaseAdminClient();
  const result = user && admin ? await admin.from("trakt_connections").select("trakt_username,sync_enabled,last_synced_at,last_error,updated_at").eq("user_id", user.id).maybeSingle() : { data: null, error: null } as any;
  const connection = result.data; const databaseReady = !result.error || !String(result.error.message).toLowerCase().includes("trakt_connections"); const environmentReady = Boolean(env.traktClientId && env.traktClientSecret && env.traktRedirectUri && env.traktEncryptionKey);
  return <div><h2 className="display settings-title">Integrations</h2><p className="overview">Connect services once and let MovieTracker keep your viewing diary consistent everywhere.</p>
    {notice.connected && <div className="notice success-notice"><CheckCircle2 size={17} /> Trakt connected. Run the first sync to import your history, ratings, and watchlist.</div>}{notice.error && <div className="notice">{notice.error}</div>}
    <section className="integration-card"><div className="integration-brand"><div className="trakt-mark">T</div><div><span className="eyebrow">Two-way viewing sync</span><h3>Trakt</h3><p>Use Trakt as the bridge between MovieTracker, Stremio, Nuvio, and other scrobbling clients.</p></div></div>
      {!databaseReady ? <div className="integration-setup-warning"><strong>Database migration required</strong><span>Run supabase/migrations/0002_trakt_sync.sql in the Supabase SQL Editor.</span></div> : !environmentReady ? <div className="integration-setup-warning"><strong>Trakt environment is incomplete</strong><span>Add the client credentials, callback URL, and token encryption key to .env.local.</span></div> : connection ? <div className="integration-status"><div><CheckCircle2 size={17} /><span>Connected as</span><strong>@{connection.trakt_username || "Trakt user"}</strong></div><div><Clock3 size={17} /><span>Last synchronized</span><strong>{connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : "Not yet"}</strong></div>{connection.last_error && <div className="integration-error">{connection.last_error}</div>}<TraktControls /></div> : <div className="integration-connect"><a className="button accent" href="/api/integrations/trakt/connect"><Radio size={16} /> Connect Trakt</a><span>You will be redirected to Trakt to approve access.</span></div>}
    </section>
    <section className="integration-explainer"><ShieldCheck size={22} /><div><strong>How synchronization behaves</strong><p>MovieTracker imports completed watches, ratings, and watchlist titles. New MovieTracker watches, ratings, and planned titles are sent to Trakt immediately. Incoming changes are checked when you open MovieTracker, with a protected cron endpoint available for scheduled background sync.</p></div></section>
  </div>;
}
