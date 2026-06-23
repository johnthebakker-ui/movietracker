import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getServerAuth = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };
  const { data, error } = await supabase.auth.getClaims();
  const id = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, user: id ? { id } : null };
});

