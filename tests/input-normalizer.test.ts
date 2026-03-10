import { describe, expect, it } from "vitest";

import { buildUserPromptContext, extractCustomExclusions, normalizeFreeText } from "@/server/chat/input-normalizer";

describe("input-normalizer", () => {
  it("normalizza testo libero con apostrofi e spazi", () => {
    expect(normalizeFreeText("  SENZA   UOVO  E ZUCCHERO’ ")).toBe("senza uovo e zucchero'");
  });

  it("estrae esclusioni custom dal prompt", () => {
    expect(extractCustomExclusions("Oggi senza uovo, no miele")).toEqual(["uovo", "miele"]);
  });

  it("rileva preferenze giornaliere pratiche", () => {
    const context = buildUserPromptContext("Ho poco tempo e siamo fuori casa, usa quello che ho in frigo");
    expect(context.detectedPreferences.length).toBeGreaterThanOrEqual(2);
  });
});
