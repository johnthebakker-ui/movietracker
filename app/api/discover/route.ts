import { NextResponse } from "next/server";
import { discoverCatalog, filterPersonalDiscoveryItems } from "@/lib/catalog-discovery";
import { withCommunityRatings } from "@/lib/community-ratings";
import { getServerAuth } from "@/lib/auth-server";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  try { const data = await discoverCatalog(params); const { supabase, user } = await getServerAuth(); const filteredItems = await filterPersonalDiscoveryItems(data.items, params, supabase, user?.id); return NextResponse.json({ ...data, items: await withCommunityRatings(filteredItems, supabase) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed" }, { status: 502 }); }
}
