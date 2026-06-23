import Image from "@/components/app-image";
import { List } from "lucide-react";
import { notFound } from "next/navigation";
import { EditListDialog } from "@/components/edit-list-dialog";
import { MediaCard } from "@/components/media-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fromDbMedia } from "@/lib/db-mappers";
import { getMedia, imageUrl } from "@/lib/tmdb";
import { withCommunityRatings } from "@/lib/community-ratings";
import { ensureMedia } from "@/lib/catalog";

const sorts = new Set(["name-asc", "name-desc", "release-newest", "release-oldest", "added-newest", "added-oldest"]);
type Row = { position: number; note: string | null; added_at: string; media: any; item: ReturnType<typeof fromDbMedia> };

function collectionOf(media: any) {
  const rawCollection = media.raw?.belongs_to_collection;
  const id = media.collection_tmdb_id ?? rawCollection?.id ?? null;
  return id ? { id: Number(id), name: media.collection_name ?? rawCollection?.name ?? "Collection" } : null;
}

function mapRows(items: any[]): Row[] { return items.map((row: any) => ({ ...row, media: Array.isArray(row.media) ? row.media[0] : row.media })).filter((row: any) => row.media).map((row: any) => ({ ...row, item: fromDbMedia(row.media) })); }

function compareRows(sort: string) { return (a: Row, b: Row) => {
  if (sort === "name-desc") return b.media.title.localeCompare(a.media.title);
  if (sort === "release-newest" || sort === "release-oldest") { const value = (a.media.release_date ?? "").localeCompare(b.media.release_date ?? ""); return sort === "release-newest" ? -value : value; }
  if (sort === "added-newest" || sort === "added-oldest") { const value = a.added_at.localeCompare(b.added_at); return sort === "added-newest" ? -value : value; }
  return a.media.title.localeCompare(b.media.title);
}; }

function collectionReleaseOrder(a: Row, b: Row) { const aDate = a.media.release_date ?? "9999-12-31"; const bDate = b.media.release_date ?? "9999-12-31"; return aDate.localeCompare(bDate) || a.media.title.localeCompare(b.media.title); }

export default async function ListDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; group?: string }> }) {
  const { id } = await params; const query = await searchParams; const sort = sorts.has(query.sort ?? "") ? query.sort! : "name-asc"; const grouped = query.group === "collections";
  const supabase = await createSupabaseServerClient(); if (!supabase) notFound();
  const [{ data: list }, { data: userData }] = await Promise.all([supabase.from("lists").select("*,profiles(username,display_name)").eq("id", id).maybeSingle(), supabase.auth.getUser()]);
  if (!list) notFound();
  const { data: items } = await supabase.from("list_items").select("position,note,added_at,media(*)").eq("list_id", id);
  let rows = mapRows(items ?? []); const isOwner = userData.user?.id === list.user_id;
  if (grouped && isOwner) {
    const missing = rows.filter(row => row.media.kind === "movie" && !collectionOf(row.media) && (!row.media.raw || Object.keys(row.media.raw).length === 0));
    if (missing.length) {
      await Promise.allSettled(missing.map(async row => ensureMedia(await getMedia("movie", row.media.tmdb_id))));
      const refreshed = await supabase.from("list_items").select("position,note,added_at,media(*)").eq("list_id", id);
      rows = mapRows(refreshed.data ?? []);
    }
  }
  rows.sort(compareRows(sort)); const rated = await withCommunityRatings(rows.map(row => row.item), supabase); rows = rows.map((row, index) => ({ ...row, item: rated[index] }));
  const featured = rows.find(row => row.media?.id === list.featured_media_id)?.media; const heroArt = list.cover_url || imageUrl(featured?.backdrop_path || featured?.poster_path, "original"); const owner = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;
  const groups = new Map<string, Row[]>(); if (grouped) rows.forEach(row => { const collection = row.media.kind === "movie" ? collectionOf(row.media) : null; const key = collection?.name ?? "Other titles"; groups.set(key, [...(groups.get(key) ?? []), row]); });
  const cards = (groupRows: Row[]) => <div className="media-grid list-media-grid">{groupRows.map(row => <MediaCard key={`${row.item.kind}-${row.item.id}`} item={row.item} listContext={isOwner ? { id: list.id, mediaId: row.media.id, name: list.name } : undefined} />)}</div>;
  return <main className="page list-detail-page"><div className="shell"><section className={`list-detail-hero${heroArt ? " has-art" : ""}`}>{heroArt && <Image className="list-detail-art" src={heroArt} alt="" fill priority sizes="100vw" />}<div className="list-detail-copy"><div className="eyebrow">{list.visibility} list · @{owner?.username}</div><h1 className="display">{list.name}</h1><p>{list.description || "A hand-picked collection."}</p><strong>{rows.length.toLocaleString()} {rows.length === 1 ? "title" : "titles"}</strong></div>{isOwner && <EditListDialog list={list} items={rows.map(row => ({ id: row.media.id, title: row.media.title }))} />}</section>
    {rows.length ? <><form className="list-sort-bar"><label><span>Sort titles</span><select className="select" name="sort" defaultValue={sort}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="release-newest">Release date: newest</option><option value="release-oldest">Release date: oldest</option><option value="added-newest">Date added: newest</option><option value="added-oldest">Date added: oldest</option></select></label><label className="filter-checkbox"><input type="checkbox" name="group" value="collections" defaultChecked={grouped} /> Group collections</label><button className="button accent">Apply</button></form>{grouped ? <div className="collection-groups">{[...groups.entries()].sort(([a], [b]) => a === "Other titles" ? 1 : b === "Other titles" ? -1 : a.localeCompare(b)).map(([name, groupRows]) => { const orderedRows = name === "Other titles" ? groupRows : [...groupRows].sort(collectionReleaseOrder); return <section className="section" key={name}><div className="section-head"><div><div className="eyebrow">Franchise collection · release order</div><h2 className="display">{name}</h2></div><span className="muted">{groupRows.length} titles</span></div>{cards(orderedRows)}</section>; })}</div> : <section className="section">{cards(rows)}</section>}</> : <div className="empty-state list-empty-state"><List size={30} /><h2 className="display">This list is waiting</h2><p className="muted">You can edit its name, description, privacy and cover now, then add titles from any movie or series page.</p>{isOwner && <EditListDialog list={list} items={[]} />}</div>}
  </div></main>;
}
