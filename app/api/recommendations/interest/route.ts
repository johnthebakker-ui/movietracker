import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMfaIfEnrolled } from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const input = z.object({ tmdbId: z.number().int().positive(), kind: z.enum(["movie", "show"]) });

async function context(request: Request) {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return { error: NextResponse.json({ error: "Sign in to manage recommendations" }, { status: 401 }) } as const;
  try { await requireMfaIfEnrolled(supabase); } catch (error) { return { error: NextResponse.json({ error: error instanceof Error ? error.message : "Complete your authenticator challenge" }, { status: 403 }) } as const; }
  const values = input.safeParse(await request.json().catch(() => null));
  if (!values.success) return { error: NextResponse.json({ error: "Invalid title" }, { status: 400 }) } as const;
  const { data: media } = await supabase.from("media").select("id").eq("tmdb_id", values.data.tmdbId).eq("kind", values.data.kind).maybeSingle();
  if (!media) return { error: NextResponse.json({ error: "This title is not available in the local catalog yet" }, { status: 404 }) } as const;
  return { supabase, user, media, values: values.data } as const;
}

export async function POST(request: Request) {
  const result = await context(request); if ("error" in result) return result.error;
  const { error } = await result.supabase.from("recommendation_dismissals").upsert({ user_id: result.user.id, media_id: result.media.id }, { onConflict: "user_id,media_id" });
  if (error) return NextResponse.json({ error: "Could not update your recommendations" }, { status: 500 });
  await result.supabase.from("recommendations").update({ dismissed_at: new Date().toISOString() }).eq("user_id", result.user.id).eq("media_id", result.media.id);
  return NextResponse.json({ dismissed: true });
}

export async function DELETE(request: Request) {
  const result = await context(request); if ("error" in result) return result.error;
  const { error } = await result.supabase.from("recommendation_dismissals").delete().eq("user_id", result.user.id).eq("media_id", result.media.id);
  if (error) return NextResponse.json({ error: "Could not update your recommendations" }, { status: 500 });
  await result.supabase.from("recommendations").update({ dismissed_at: null }).eq("user_id", result.user.id).eq("media_id", result.media.id);
  return NextResponse.json({ dismissed: false });
}

