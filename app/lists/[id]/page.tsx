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

type GroupMode = "none" | "collections" | "studios";
type Row = { position: number; note: string | null; added_at: string; media: any; item: ReturnType<typeof fromDbMedia> };

function collectionOf(media: any) {
  const rawCollection = media.raw?.belongs_to_collection;
  const id = media.collection_tmdb_id ?? rawCollection?.id ?? null;
  return id ? { id: Number(id), name: media.collection_name ?? rawCollection?.name ?? "Collection" } : null;
}

function mapRows(items: any[]): Row[] {
  return items
    .map((row: any) => ({ ...row, media: Array.isArray(row.media) ? row.media[0] : row.media }))
    .filter((row: any) => row.media)
    .map((row: any) => ({ ...row, item: fromDbMedia(row.media) }));
}

function compareRows(sort: string) {
  return (a: Row, b: Row) => {
    if (sort === "name-desc") return b.media.title.localeCompare(a.media.title);
    if (sort === "release-newest" || sort === "release-oldest") {
      const value = (a.media.release_date ?? "").localeCompare(b.media.release_date ?? "");
      return sort === "release-newest" ? -value : value;
    }
    if (sort === "added-newest" || sort === "added-oldest") {
      const value = a.added_at.localeCompare(b.added_at);
      return sort === "added-newest" ? -value : value;
    }
    return a.media.title.localeCompare(b.media.title);
  };
}

function collectionReleaseOrder(a: Row, b: Row) {
  const aDate = a.media.release_date ?? "9999-12-31";
  const bDate = b.media.release_date ?? "9999-12-31";
  return aDate.localeCompare(bDate) || a.media.title.localeCompare(b.media.title);
}

function franchiseName(row: Row): { name: string; explicit: boolean } | null {
  const collection = row.media.kind === "movie" ? collectionOf(row.media) : null;
  if (collection?.name) return { name: collection.name, explicit: false };
  const title = String(row.media.title ?? "").toLowerCase().replace(/[-_]/g, " ");
  if (title.includes("attack on titan")) return { name: "Attack on Titan Collection", explicit: true };
  if (title.includes("chainsaw man")) return { name: "Chainsaw Man Collection", explicit: true };
  if ((title.includes("avatar") && title.includes("last airbender")) || title.includes("legend of korra")) return { name: "Avatar: The Last Airbender Collection", explicit: true };
  if (title.includes("wreck it ralph") || title.includes("ralph breaks the internet")) return { name: "Wreck-It Ralph Collection", explicit: true };
  if (title.includes("incredibles")) return { name: "The Incredibles Collection", explicit: true };
  if (title.includes("ice age")) return { name: "Ice Age Collection", explicit: true };
  return null;
}

function companyNames(row: Row) {
  const rawCompanies = Array.isArray(row.media.raw?.production_companies) ? row.media.raw.production_companies : [];
  const companies = Array.isArray(row.media.companies) && row.media.companies.length ? row.media.companies : rawCompanies;
  const names = companies.map((company: any) => company?.name).filter(Boolean);
  return names.length ? [...new Set(names)] : ["Other studios"];
}

function groupedRows(rows: Row[], mode: GroupMode) {
  const groups = new Map<string, Row[]>();
  if (mode === "collections") {
    const explicitGroups = new Set<string>();
    const other: Row[] = [];
    rows.forEach(row => {
      const key = franchiseName(row);
      if (key) {
        if (key.explicit) explicitGroups.add(key.name);
        groups.set(key.name, [...(groups.get(key.name) ?? []), row]);
      }
      else other.push(row);
    });
    for (const [name, groupRows] of groups.entries()) {
      if (groupRows.length < 2 && !explicitGroups.has(name)) {
        groups.delete(name);
        other.push(...groupRows);
      }
    }
    if (other.length) groups.set("Other titles", other);
  }
  if (mode === "studios") {
    rows.forEach(row => {
      companyNames(row).forEach(name => groups.set(String(name), [...(groups.get(String(name)) ?? []), row]));
    });
  }
  return groups;
}

export default async function ListDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; group?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const sort = sorts.has(query.sort ?? "") ? query.sort! : "name-asc";
  const groupMode: GroupMode = query.group === "studios" ? "studios" : query.group === "collections" ? "collections" : "none";
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const [{ data: list }, { data: userData }] = await Promise.all([
    supabase.from("lists").select("*,profiles(username,display_name)").eq("id", id).maybeSingle(),
    supabase.auth.getUser()
  ]);
  if (!list) notFound();

  const { data: items } = await supabase.from("list_items").select("position,note,added_at,media(*)").eq("list_id", id);
  let rows = mapRows(items ?? []);
  const isOwner = userData.user?.id === list.user_id;

  if (groupMode === "collections" && isOwner) {
    const missing = rows.filter(row => row.media.kind === "movie" && !collectionOf(row.media) && (!row.media.raw || Object.keys(row.media.raw).length === 0));
    if (missing.length) {
      await Promise.allSettled(missing.map(async row => ensureMedia(await getMedia("movie", row.media.tmdb_id))));
      const refreshed = await supabase.from("list_items").select("position,note,added_at,media(*)").eq("list_id", id);
      rows = mapRows(refreshed.data ?? []);
    }
  }

  rows.sort(compareRows(sort));
  const rated = await withCommunityRatings(rows.map(row => row.item), supabase);
  rows = rows.map((row, index) => ({ ...row, item: rated[index] }));

  const featured = rows.find(row => row.media?.id === list.featured_media_id)?.media;
  const heroArt = list.cover_url || imageUrl(featured?.backdrop_path || featured?.poster_path, "original");
  const owner = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;
  const groups = groupedRows(rows, groupMode);
  const cards = (groupRows: Row[]) => <div className="media-grid list-media-grid">{groupRows.map(row => <MediaCard key={`${row.item.kind}-${row.item.id}`} item={row.item} listContext={isOwner ? { id: list.id, mediaId: row.media.id, name: list.name } : undefined} />)}</div>;

  return <main className="page list-detail-page"><div className="shell">
    <section className={`list-detail-hero${heroArt ? " has-art" : ""}`}>
      {heroArt && <Image className="list-detail-art" src={heroArt} alt="" fill priority sizes="100vw" />}
      <div className="list-detail-copy"><div className="eyebrow">{list.visibility} list - @{owner?.username}</div><h1 className="display">{list.name}</h1><p>{list.description || "A hand-picked collection."}</p><strong>{rows.length.toLocaleString()} {rows.length === 1 ? "title" : "titles"}</strong></div>
      {isOwner && <EditListDialog list={list} items={rows.map(row => ({ id: row.media.id, title: row.media.title }))} />}
    </section>
    {rows.length ? <>
      <form className="list-sort-bar">
        <label><span>Sort titles</span><select className="select" name="sort" defaultValue={sort}><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="release-newest">Release date: newest</option><option value="release-oldest">Release date: oldest</option><option value="added-newest">Date added: newest</option><option value="added-oldest">Date added: oldest</option></select></label>
        <label><span>Group by</span><select className="select" name="group" defaultValue={groupMode}><option value="none">List order</option><option value="collections">Franchises</option><option value="studios">Studios</option></select></label>
        <button className="button accent">Apply</button>
      </form>
      {groupMode !== "none" ? <div className="collection-groups">{[...groups.entries()].sort(([a], [b]) => a.startsWith("Other") ? 1 : b.startsWith("Other") ? -1 : a.localeCompare(b)).map(([name, groupRows]) => {
        const orderedRows = groupMode === "collections" && !name.startsWith("Other") ? [...groupRows].sort(collectionReleaseOrder) : groupRows;
        return <section className="section" key={name}><div className="section-head"><div><div className="eyebrow">{groupMode === "studios" ? "Studio group" : "Franchise collection - release order"}</div><h2 className="display">{name}</h2></div><span className="muted">{groupRows.length} titles</span></div>{cards(orderedRows)}</section>;
      })}</div> : <section className="section">{cards(rows)}</section>}
    </> : <div className="empty-state list-empty-state"><List size={30} /><h2 className="display">This list is waiting</h2><p className="muted">You can edit its name, description, privacy and cover now, then add titles from any movie or series page.</p>{isOwner && <EditListDialog list={list} items={[]} />}</div>}
  </div></main>;
}
