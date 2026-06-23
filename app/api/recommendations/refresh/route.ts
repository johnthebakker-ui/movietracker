import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth-server";
import { requireMfaIfEnrolled } from "@/lib/auth-security";
import { ensureRecommendations } from "@/lib/recommendations";

export async function POST() {
  const { supabase, user } = await getServerAuth();
  if (!supabase || !user) return NextResponse.json({ error: "Sign in to refresh recommendations" }, { status: 401 });
  try { await requireMfaIfEnrolled(supabase); await ensureRecommendations(user.id, true); return NextResponse.json({ refreshed: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not refresh recommendations" }, { status: 500 }); }
}

