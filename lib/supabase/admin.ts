import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getRequiredEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
