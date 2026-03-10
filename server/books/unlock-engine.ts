import { addMinutes, differenceInMinutes, isAfter } from "date-fns";

import { normalizeBookAnswer } from "@/lib/text/normalize-answer";

export interface UnlockAttemptLog {
  result: "failed" | "success" | "cooldown" | "revoked";
  created_at: string;
  cooldown_until: string | null;
}

export interface UnlockPolicy {
  maxAttempts: number;
  cooldownMinutes: number;
}

export function getActiveCooldown(logs: UnlockAttemptLog[], now = new Date()) {
  const latestCooldown = logs
    .filter((log) => log.result === "cooldown" && !!log.cooldown_until)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

  if (!latestCooldown?.cooldown_until) {
    return null;
  }

  const cooldownUntil = new Date(latestCooldown.cooldown_until);
  if (!isAfter(cooldownUntil, now)) {
    return null;
  }

  const minutesLeft = Math.max(1, differenceInMinutes(cooldownUntil, now));

  return {
    cooldownUntil,
    minutesLeft,
  };
}

export function countConsecutiveFailures(logs: UnlockAttemptLog[]) {
  const sorted = [...logs].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  let failures = 0;

  for (const log of sorted) {
    if (log.result === "failed") {
      failures += 1;
      continue;
    }

    if (log.result === "success" || log.result === "cooldown") {
      break;
    }
  }

  return failures;
}

export function buildCooldownUntil(policy: UnlockPolicy, now = new Date()) {
  return addMinutes(now, policy.cooldownMinutes);
}

export function isCorrectAnswer(input: string, expectedNormalizedAnswer: string) {
  return normalizeBookAnswer(input) === normalizeBookAnswer(expectedNormalizedAnswer);
}
