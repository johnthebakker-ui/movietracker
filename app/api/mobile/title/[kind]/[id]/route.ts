import { NextResponse } from "next/server";
import { getExternalRatings } from "@/lib/external-ratings";
import { getMedia } from "@/lib/tmdb";
import {
  badRequest,
  ensureTitleState,
  isMediaKind,
  mediaImages,
  mobileAuth,
  ok,
  serializeExternalRatings,
  titleCollectionAndRecommendations,
  titleCommunityRating,
  titleReviews,
  titleUserState
} from "@/app/api/mobile/_lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: rawKind, id: rawId } = await params;
  const id = Number(rawId);
  if (!isMediaKind(rawKind) || !Number.isFinite(id)) return badRequest("Invalid title");

  try {
    const item = await getMedia(rawKind, id);
    const mediaId = await ensureTitleState(item);
    const { supabase, user } = await mobileAuth();
    const userState = await titleUserState(mediaId, item, supabase, user);
    const [externalRatings, communityRating, reviews, related] = await Promise.all([
      getExternalRatings((item.raw as any).external_ids?.imdb_id ?? null),
      titleCommunityRating(mediaId, supabase),
      titleReviews(mediaId, item, supabase),
      titleCollectionAndRecommendations(item, supabase, userState.dismissedKeys)
    ]);

    return ok({
      dbId: mediaId,
      item,
      overview: item.overview,
      tagline: item.tagline,
      releaseDate: item.releaseDate,
      endDate: item.endDate,
      genres: item.genres,
      voteAverage: item.voteAverage,
      runtime: item.runtime,
      originalLanguage: item.originalLanguage,
      status: item.status,
      userRating: userState.userRating,
      communityRating,
      externalRatings: serializeExternalRatings(externalRatings),
      progressStatus: userState.progressStatus,
      favorite: userState.favorite,
      watched: userState.watched,
      notInterested: userState.notInterested,
      lists: userState.lists,
      cast: item.cast,
      crew: item.crew,
      companies: item.companies,
      videos: item.videos,
      images: mediaImages(item),
      seasons: item.seasons,
      reviews,
      myReview: userState.myReview,
      collectionName: item.collectionName,
      collection: related.collection,
      recommendations: related.recommendations
    });
  } catch (error) {
    console.error("Mobile title API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Title failed" }, { status: 502 });
  }
}
