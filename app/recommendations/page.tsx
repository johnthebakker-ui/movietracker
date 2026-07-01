import { redirect } from "next/navigation";
import { InfiniteRecommendationGrid } from "@/components/infinite-recommendation-grid";
import { RecommendationFilters } from "@/components/recommendation-filters";
import { RefreshRecommendationsButton } from "@/components/refresh-recommendations-button";
import { ensureRecommendations, recommendationPageWithRefresh } from "@/lib/recommendations";
import { getGenres } from "@/lib/tmdb";
import { getServerAuth } from "@/lib/auth-server";
import { withCommunityRatings } from "@/lib/community-ratings";

type Filters = { kind?: string; genre?: string; country?: string; yearMode?: string; year?: string; fromYear?: string; toYear?: string; hideWatched?: string; hideListed?: string; hideAnimation?: string; excludeGenres?: string; shuffle?: string };
export default async function Recommendations({ searchParams }: { searchParams: Promise<Filters> }) {
  const params = await searchParams; const { supabase, user } = await getServerAuth(); if (!user || !supabase) redirect("/login"); const normalizedParams = { ...params, kind: params.genre === "kdrama" ? "show" : params.kind };
  await ensureRecommendations(user.id); const filters = { kind: normalizedParams.kind, genre: params.genre, country: params.country, yearMode: params.yearMode, year: params.year, fromYear: params.fromYear, toYear: params.toYear, hideWatched: params.hideWatched !== "0", hideListed: params.hideListed !== "0", hideAnimation: params.hideAnimation === "1", excludeGenres: params.excludeGenres, shuffle: params.shuffle }; const [genres, result] = await Promise.all([getGenres(), recommendationPageWithRefresh(supabase, user.id, filters)]); const rated = await withCommunityRatings(result.items.map(entry => entry.item), supabase); const initial = result.items.map((entry, index) => ({ ...entry, item: rated[index] })); const query = new URLSearchParams({ ...(filters.kind ? { kind: filters.kind } : {}), ...(params.genre ? { genre: params.genre } : {}), ...(filters.country ? { country: filters.country } : {}), ...(params.yearMode ? { yearMode: params.yearMode } : {}), ...(params.year ? { year: params.year } : {}), ...(params.fromYear ? { fromYear: params.fromYear } : {}), ...(params.toYear ? { toYear: params.toYear } : {}), ...(params.shuffle ? { shuffle: params.shuffle } : {}), ...(params.excludeGenres ? { excludeGenres: params.excludeGenres } : {}), hideWatched: filters.hideWatched ? "1" : "0", hideListed: filters.hideListed ? "1" : "0", ...(filters.hideAnimation ? { hideAnimation: "1" } : {}) }).toString();
  return <main className="page"><div className="shell"><div className="page-heading-row recommendation-heading"><div><div className="eyebrow">Calculated from your actual taste</div><h1 className="display page-title">For you</h1></div><RefreshRecommendationsButton /></div><p className="overview recommendation-intro">Personal picks shaped by your ratings, favorites, watch history and Trakt activity.</p>
    <RecommendationFilters genres={genres} params={normalizedParams} />
    {initial.length ? <InfiniteRecommendationGrid key={query} initial={initial} nextCursor={result.nextCursor} query={query} total={result.total} /> : <div className="empty-state"><h2 className="display">No matches today</h2><p className="muted">Relax a filter or allow watched and listed titles.</p></div>}
  </div></main>;
}
