import { redirect } from "next/navigation";
import { MfaChallenge } from "@/components/mfa-challenge";
import { needsMfaChallenge } from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null; if (!supabase || !user) redirect("/login"); const raw = (await searchParams).next ?? "/"; const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"; if (!(await needsMfaChallenge(supabase))) redirect(next); return <main className="mfa-page"><MfaChallenge next={next} /></main>; }
