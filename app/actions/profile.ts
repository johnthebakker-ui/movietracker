"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

async function authed() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function updateProfile(form: FormData) {
  const { supabase, user } = await authed();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  try {
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Your @username must be 3–24 characters using only letters, numbers, or underscores");
    const { data: currentProfile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    const lookup = createSupabaseAdminClient() ?? supabase;
    const escapedUsername = username.replace(/[\\%_]/g, character => `\\${character}`);
    const { data: matches, error: lookupError } = await lookup.from("profiles").select("id,username").ilike("username", escapedUsername).limit(5);
    if (lookupError) throw lookupError;
    if ((matches ?? []).some(profile => profile.id !== user.id && profile.username.toLowerCase() === username)) throw new Error(`That @${username} is already taken`);
    const uploads: Record<string, string> = {};
    for (const key of ["avatar", "banner"] as const) {
      const file = form.get(key);
      if (file instanceof File && file.size > 0) {
        if (file.size > 5_242_880 || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Images must be JPEG, PNG, or WebP under 5 MB");
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "webp";
        const path = `${user.id}/${key}.${extension}`;
        const { error } = await supabase.storage.from("profile-media").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
        if (error) throw error;
        uploads[`${key}_url`] = `${supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      }
    }
    const { error } = await supabase.from("profiles").update({
      username, display_name: String(form.get("displayName") ?? "").trim() || null,
      bio: String(form.get("bio") ?? "").trim() || null, region: String(form.get("region") ?? "US").toUpperCase(),
      language: String(form.get("language") ?? "en-US"), theme: String(form.get("theme") ?? "system"),
      adult_content: form.get("adultContent") === "on", ...uploads, updated_at: new Date().toISOString()
    }).eq("id", user.id);
    if (error?.code === "23505") throw new Error(`That @${username} is already taken`);
    if (error) throw error;
    if (currentProfile?.username && currentProfile.username !== username) revalidatePath(`/profile/${currentProfile.username}`);
  } catch (error) {
    redirect(`/settings/profile?error=${encodeURIComponent(error instanceof Error ? error.message : "Profile update failed")}`);
  }
  revalidatePath("/settings/profile"); revalidatePath(`/profile/${username}`);
  redirect("/settings/profile?message=Profile+saved");
}

export async function updatePrivacy(form: FormData) {
  const { supabase, user } = await authed();
  const allowed = new Set(["public","followers","private"]);
  const value = (key: string) => { const v=String(form.get(key)); return allowed.has(v)?v:"private"; };
  const { error } = await supabase.from("privacy_settings").update({ profile:value("profile"), activity:value("activity"), history:value("history"), ratings:value("ratings"), favorites:value("favorites"), statistics:value("statistics") }).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/settings/privacy");
}

export async function deleteAccount() {
  const { user } = await authed();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for account deletion");
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  redirect("/");
}
