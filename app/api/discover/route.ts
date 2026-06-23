import { NextResponse } from "next/server";
import { discoverCatalog } from "@/lib/catalog-discovery";
import { withCommunityRatings } from "@/lib/community-ratings";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  try { const data = await discoverCatalog(params); return NextResponse.json({ ...data, items: await withCommunityRatings(data.items) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed" }, { status: 502 }); }
}
