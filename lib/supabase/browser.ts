"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseCookieOptions } from "@/config/auth";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  // In client bundle Next.js replaces direct NEXT_PUBLIC_* references.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: supabaseCookieOptions,
  });
  return browserClient;
}
