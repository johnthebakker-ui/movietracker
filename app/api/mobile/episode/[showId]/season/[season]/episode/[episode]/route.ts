import { NextResponse } from "next/server";
import { getExternalRatings } from "@/lib/external-ratings";
import {
  badRequest,
  episodeFeedback,
  episodePayload,
  mapEpisode,
  mapSeason,
  mobileAuth,
  ok,
  serializeExternalRatings,
  titleCollectionAndRecommendations
} from "@/app/api/mobile/_lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ showId: string; season: string; episode: string }> }) {
  const { showId: rawShowId, season: rawSeason, episode: rawEpisode } = await params;
  const showId = Number(rawShowId);
  const seasonNumber = Number(rawSeason);
  const episodeNumber = Number(rawEpisode);
  if (![showId, seasonNumber, episodeNumber].every(Number.isFinite)) return badRequest("Invalid episode");

  try {
    const payload = await episodePayload(showId, seasonNumber, episodeNumber);
    const { supabase, user } = await mobileAuth();
    const [feedback, externalRatings, related] = await Promise.all([
      episodeFeedback(payload.episodeDbId, payload.show, supabase, user),
      getExternalRatings(payload.episode.externalIds?.imdb_id ?? null),
      titleCollectionAndRecommendations(payload.show, supabase)
    ]);
    return ok({
      show: payload.show,
      mediaId: payload.mediaId,
      seasonId: payload.seasonId,
      episodeId: payload.episodeDbId,
      season: mapSeason(payload.season),
      episode: mapEpisode(payload.episode),
      userRating: feedback.userRating,
      communityRating: feedback.communityRating,
      watched: feedback.watched,
      reviews: feedback.reviews,
      myReview: feedback.myReview,
      externalRatings: serializeExternalRatings(externalRatings),
      recommendations: related.recommendations
    });
  } catch (error) {
    console.error("Mobile episode API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Episode failed" }, { status: 502 });
  }
}
