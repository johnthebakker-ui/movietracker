import { ConfigNotice } from "@/components/config-notice";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { MediaSection } from "@/components/media-section";
import { hasTmdb } from "@/lib/env";
import { discover, getTrending } from "@/lib/tmdb";
import { withCommunityRatings } from "@/lib/community-ratings";

export default async function Home() {
  if (!hasTmdb) return <main className="page"><div className="shell"><ConfigNotice service="TMDB" /></div></main>;
  const [trendingResult, movies, shows] = await Promise.all([
    getTrending(), discover("movie", { "primary_release_date.gte": new Date().toISOString().slice(0, 10) }), discover("show", { "first_air_date.gte": new Date().toISOString().slice(0, 10) })
  ]);
  const [trending, ratedMovies, ratedShows] = await Promise.all([withCommunityRatings(trendingResult), withCommunityRatings(movies.items), withCommunityRatings(shows.items)]);
  return <main className="page">
    <div className="shell">
      <HomeHeroCarousel items={trending.filter(item => item.backdropPath).slice(0, 6)} />
      <MediaSection eyebrow="Everyone is watching" title="Trending now" items={trending} href="/discover?kind=all&sort=popularity&view=trending" />
      <MediaSection eyebrow="Fresh from the cinema" title="New & upcoming films" items={ratedMovies} href="/discover?kind=movie&sort=newest&view=films" />
      <MediaSection eyebrow="Stories worth settling into" title="Series premieres" items={ratedShows} href="/discover?kind=show&sort=newest&view=series" />
    </div>
  </main>;
}
