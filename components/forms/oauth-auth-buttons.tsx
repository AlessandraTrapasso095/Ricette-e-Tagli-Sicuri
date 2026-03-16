"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type OAuthAuthButtonsProps = {
  mode: "login" | "register";
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.8 12.23c0-.75-.07-1.47-.2-2.15H12v4.07h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.94-1.79 3.04-4.43 3.04-7.56Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.75 0 5.06-.91 6.74-2.46l-3.3-2.56c-.91.61-2.08.97-3.44.97-2.65 0-4.89-1.79-5.69-4.19H2.9v2.64A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.31 13.76A6 6 0 0 1 6 12c0-.61.11-1.2.31-1.76V7.6H2.9A10 10 0 0 0 2 12c0 1.61.38 3.13 1.06 4.4l3.25-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.05c1.49 0 2.83.51 3.89 1.51l2.92-2.92C17.06 2.98 14.75 2 12 2A10 10 0 0 0 3.06 7.6l3.25 2.64c.8-2.4 3.04-4.19 5.69-4.19Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.2 2.57c0 1-.4 1.96-1.02 2.69-.78.9-2.05 1.59-3.13 1.5-.14-.98.29-2 .89-2.7.72-.83 1.97-1.48 3.03-1.49.17 0 .23 0 .23 0ZM19.06 17.12c-.49 1.12-.73 1.62-1.36 2.64-.88 1.42-2.12 3.19-3.66 3.2-1.37.02-1.72-.9-3.58-.89-1.87.01-2.26.91-3.63.89-1.54-.01-2.71-1.6-3.6-3.03C.72 16.57-.1 12.64 1.67 9.9c1.26-1.96 3.24-3.1 5.1-3.1 1.41 0 2.75.98 3.58.98.8 0 2.35-1.2 3.97-1.03.68.03 2.59.28 3.82 2.1-3.33 1.82-2.79 6.54.92 8.27Z" />
    </svg>
  );
}

export function OAuthAuthButtons({ mode }: OAuthAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleOAuth(provider: Provider) {
    setLoadingProvider(provider);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectOrigin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      const redirectTo = `${redirectOrigin}/auth/callback?next=/dashboard`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Accesso con ${provider === "google" ? "Google" : "Apple"} non disponibile.`,
      );
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-rose-100" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            {mode === "login" ? "oppure accedi con" : "oppure registrati con"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
          onClick={() => void handleOAuth("google")}
          disabled={loadingProvider !== null}
        >
          <GoogleIcon />
          {loadingProvider === "google" ? "Reindirizzamento..." : "Continua con Google"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full border border-zinc-900 bg-zinc-950 text-white hover:bg-zinc-900"
          onClick={() => void handleOAuth("apple")}
          disabled={loadingProvider !== null}
        >
          <AppleIcon />
          {loadingProvider === "apple" ? "Reindirizzamento..." : "Continua con Apple"}
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
