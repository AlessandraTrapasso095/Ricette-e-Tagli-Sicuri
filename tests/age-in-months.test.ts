import { describe, expect, it } from "vitest";

import { computeAgeInMonthsFromBirthDate } from "@/lib/timezone/age-in-months";

describe("computeAgeInMonthsFromBirthDate", () => {
  it("usa la data locale italiana e non perde un mese vicino al complemese", () => {
    const age = computeAgeInMonthsFromBirthDate("2025-03-18", new Date("2026-03-17T23:30:00.000Z"));

    expect(age).toBe(12);
  });

  it("non anticipa il complemese prima della mezzanotte italiana", () => {
    const age = computeAgeInMonthsFromBirthDate("2025-03-18", new Date("2026-03-17T22:30:00.000Z"));

    expect(age).toBe(11);
  });

  it("ritorna null per date non valide", () => {
    expect(computeAgeInMonthsFromBirthDate("18/03/2025")).toBeNull();
  });
});
