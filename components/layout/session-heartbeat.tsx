"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;

export function SessionHeartbeat() {
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutTriggeredRef = useRef(false);

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "focus",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });

    const intervalId = window.setInterval(async () => {
      if (timeoutTriggeredRef.current) {
        return;
      }

      const inactiveFor = Date.now() - lastActivityRef.current;
      if (inactiveFor < INACTIVITY_LIMIT_MS) {
        return;
      }

      timeoutTriggeredRef.current = true;
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } finally {
        window.location.href = "/login?reason=timeout";
      }
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
    };
  }, []);

  return null;
}
