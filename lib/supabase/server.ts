import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { env, hasSupabase } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!hasSupabase) return null;
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } }
    });
  }
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot write cookies; middleware refreshes sessions.
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
