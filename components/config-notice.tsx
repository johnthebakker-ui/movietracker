export function ConfigNotice({ service }: { service: "TMDB" | "Supabase" }) {
  return <div className="empty-state"><div className="eyebrow">One small setup step</div><h2 className="display">Connect {service}</h2><p className="muted">Add the required values from <code>.env.example</code> to <code>.env.local</code>. MovieTracker deliberately does not replace missing production data with mock content.</p></div>;
}
