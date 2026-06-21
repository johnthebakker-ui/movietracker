import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ConfigNotice } from "@/components/config-notice";
import { DiscoveryFilters } from "@/components/discovery-filters";
import { InfiniteMediaGrid } from "@/components/infinite-media-grid";
import { hasTmdb } from "@/lib/env";
import { discover, getGenres } from "@/lib/tmdb";
import type { MediaKind } from "@/lib/types";

export const metadata: Metadata = { title: "Discover" };
const validYear = (value?: string) => value && /^\d{4}$/.test(value) ? Number(value) : null;

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!hasTmdb) return <main className="page"><div className="shell"><ConfigNotice service="TMDB" /></div></main>;
  const params = await searchParams; const kind: MediaKind = params.kind === "show" ? "show" : "movie"; const mode = params.yearMode === "range" ? "range" : "exact";
  const exactYear = validYear(params.year); const fromYear = validYear(params.fromYear); const toYear = validYear(params.toYear);
  const invalidRange = mode === "range" && fromYear !== null && toYear !== null && fromYear > toYear;
  const dateFrom = mode === "exact" && exactYear ? `${exactYear}-01-01` : mode === "range" && fromYear ? `${fromYear}-01-01` : undefined;
  const dateTo = mode === "exact" && exactYear ? `${exactYear}-12-31` : mode === "range" && toYear ? `${toYear}-12-31` : undefined;
  const tmdbFilters: Record<string, string | undefined> = { sort_by: params.sort ?? "popularity.desc", with_genres: params.genre, "vote_average.gte": params.rating, "vote_count.gte": params.rating ? "50" : undefined, "primary_release_date.gte": kind === "movie" ? dateFrom : undefined, "primary_release_date.lte": kind === "movie" ? dateTo : undefined, "first_air_date.gte": kind === "show" ? dateFrom : undefined, "first_air_date.lte": kind === "show" ? dateTo : undefined };
  const genres = await getGenres(kind); const data = invalidRange ? { items: [], page: 1, totalPages: 1 } : await discover(kind, tmdbFilters);
  const apiFilters = Object.fromEntries(Object.entries(tmdbFilters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return <main className="page"><div className="shell"><div className="page-heading-row discovery-heading"><div><div className="eyebrow">Find your next obsession</div><h1 className="display" style={{ fontSize: "clamp(3rem,7vw,6.5rem)", margin: "10px 0" }}>Discover</h1></div><Link className="button ghost" href="/recommendations"><Sparkles size={16} /> For you</Link></div><DiscoveryFilters kind={kind} genres={genres} params={params} />
    {invalidRange ? <div className="notice">The starting year must be earlier than the ending year.</div> : data.items.length ? <InfiniteMediaGrid initialItems={data.items} initialPage={data.page} totalPages={data.totalPages} kind={kind} filters={apiFilters} /> : <div className="empty-state"><h2 className="display">No titles match these filters</h2><p className="muted">Try a wider year range or a lower rating threshold.</p></div>}
  </div></main>;
}
