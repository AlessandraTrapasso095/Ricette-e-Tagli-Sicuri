import { describe, expect, it } from "vitest";

import {
  buildCooldownUntil,
  countConsecutiveFailures,
  getActiveCooldown,
  isCorrectAnswer,
  type UnlockAttemptLog,
} from "@/server/books/unlock-engine";

describe("unlock-engine", () => {
  it("conta i fallimenti consecutivi fino all'ultimo success", () => {
    const logs: UnlockAttemptLog[] = [
      { result: "failed", created_at: "2026-03-10T10:10:00.000Z", cooldown_until: null },
      { result: "failed", created_at: "2026-03-10T10:09:00.000Z", cooldown_until: null },
      { result: "success", created_at: "2026-03-10T10:08:00.000Z", cooldown_until: null },
      { result: "failed", created_at: "2026-03-10T10:07:00.000Z", cooldown_until: null },
    ];

    expect(countConsecutiveFailures(logs)).toBe(2);
  });

  it("rileva cooldown attivo", () => {
    const now = new Date("2026-03-10T10:00:00.000Z");
    const logs: UnlockAttemptLog[] = [
      {
        result: "cooldown",
        created_at: "2026-03-10T09:59:00.000Z",
        cooldown_until: "2026-03-10T10:15:00.000Z",
      },
    ];

    const cooldown = getActiveCooldown(logs, now);
    expect(cooldown).not.toBeNull();
    expect(cooldown?.minutesLeft).toBeGreaterThanOrEqual(1);
  });

  it("calcola cooldownUntil e confronto risposta normalizzata", () => {
    const cooldown = buildCooldownUntil({ maxAttempts: 5, cooldownMinutes: 30 }, new Date("2026-03-10T10:00:00.000Z"));
    expect(cooldown.toISOString()).toBe("2026-03-10T10:30:00.000Z");

    expect(isCorrectAnswer("RASSICURANTE", "rassicurante")).toBe(true);
  });
});
