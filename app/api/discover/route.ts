import { NextResponse } from "next/server";
import { discover } from "@/lib/tmdb";
import type { MediaKind } from "@/lib/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; const kind: MediaKind = params.get("kind") === "show" ? "show" : "movie";
  const allowed = ["sort_by", "with_genres", "with_companies", "vote_average.gte", "vote_count.gte", "primary_release_date.gte", "primary_release_date.lte", "first_air_date.gte", "first_air_date.lte", "page"];
  const options: Record<string, string> = {}; allowed.forEach(key => { const value = params.get(key); if (value) options[key] = value; });
  try { return NextResponse.json(await discover(kind, options)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed" }, { status: 502 }); }
}
