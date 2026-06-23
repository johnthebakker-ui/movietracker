import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ConfigNotice } from "@/components/config-notice";
import { DiscoveryFilters } from "@/components/discovery-filters";
import { InfiniteMediaGrid } from "@/components/infinite-media-grid";
import { discoveryApiFilters, discoverCatalog } from "@/lib/catalog-discovery";
import { hasTmdb } from "@/lib/env";
import { getGenres } from "@/lib/tmdb";
import { withCommunityRatings } from "@/lib/community-ratings";

export const metadata: Metadata = { title: "Discover" };

const viewCopy: Record<string, { eyebrow: string; title: string }> = {
  trending: { eyebrow: "Everyone is watching", title: "Trending now" },
  films: { eyebrow: "Fresh from the cinema", title: "New & upcoming films" },
  series: { eyebrow: "Stories worth settling into", title: "Series premieres" }
};

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!hasTmdb) return <main className="page"><div className="shell"><ConfigNotice service="TMDB" /></div></main>;
  const params = await searchParams; const data = await discoverCatalog(params); const copy = viewCopy[params.view ?? ""] ?? { eyebrow: "Find your next obsession", title: "Discover" };
  const genres = await getGenres(data.format === "all" ? undefined : data.format); const ratedItems = await withCommunityRatings(data.items);
  return <main className="page"><div className="shell"><div className="page-heading-row discovery-heading"><div><div className="eyebrow">{copy.eyebrow}</div><h1 className="display" style={{ fontSize: "clamp(3rem,7vw,6.5rem)", margin: "10px 0" }}>{copy.title}</h1></div><Link className="button ghost" href="/recommendations"><Sparkles size={16} /> For you</Link></div><DiscoveryFilters kind={data.format} genres={genres} params={params} />
    {data.invalidRange ? <div className="notice">The starting year must be earlier than the ending year.</div> : ratedItems.length ? <InfiniteMediaGrid initialItems={ratedItems} initialPage={data.page} totalPages={data.totalPages} kind={data.format} filters={discoveryApiFilters(params)} /> : <div className="empty-state"><h2 className="display">No titles match these filters</h2><p className="muted">Try a wider year range, another country, or a lower rating threshold.</p></div>}
  </div></main>;
}
