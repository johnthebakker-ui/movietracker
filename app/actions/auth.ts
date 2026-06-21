"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function text(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }

export async function signIn(form: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=Supabase+is+not+configured");
  const { error } = await supabase.auth.signInWithPassword({ email: text(form, "email"), password: text(form, "password") });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function signUp(form: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=Supabase+is+not+configured");
  const email = text(form, "email");
  const { error } = await supabase.auth.signUp({
    email, password: text(form, "password"),
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback`, data: { username: text(form, "username"), display_name: text(form, "displayName") } }
  });
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Check+your+email+to+verify+your+account");
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=Supabase+is+not+configured");
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${env.siteUrl}/auth/callback` } });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

export async function requestPasswordReset(form: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=Supabase+is+not+configured");
  await supabase.auth.resetPasswordForEmail(text(form, "email"), { redirectTo: `${env.siteUrl}/auth/callback?next=/settings/security` });
  redirect("/login?message=If+that+address+exists,+a+reset+link+is+on+its+way");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
