import { Search } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { ConfigNotice } from "@/components/config-notice";
import { hasTmdb } from "@/lib/env";
import { searchCatalog } from "@/lib/catalog";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  if (!hasTmdb) return <main className="page"><div className="shell"><ConfigNotice service="TMDB" /></div></main>;
  const items = q.trim() ? await searchCatalog(q.trim()) : [];
  return <main className="page"><div className="shell"><div className="eyebrow">Across films and television</div><h1 className="display" style={{ fontSize: "clamp(3rem,7vw,6.5rem)", margin: "10px 0 28px" }}>Search</h1>
    <form className="filter-bar"><div className="search-box"><Search size={18} /><input className="input" name="q" defaultValue={q} placeholder="Title, person, or keyword…" autoFocus /></div><button className="button accent">Search</button></form>
    {q && items.length > 0 ? <div className="media-grid">{items.map((item) => <MediaCard item={item} key={`${item.kind}-${item.id}`} />)}</div> : <div className="empty-state"><h2 className="display">{q ? "No titles found" : "What are you looking for?"}</h2><p className="muted">Search TMDB’s movie and television catalog without fake filler results.</p></div>}
  </div></main>;
}
