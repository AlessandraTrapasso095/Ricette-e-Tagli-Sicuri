import { describe, expect, it } from "vitest";

import { normalizeBookAnswer } from "@/lib/text/normalize-answer";

describe("normalizeBookAnswer", () => {
  it("normalizza maiuscole, spazi e apostrofi tipografici", () => {
    expect(normalizeBookAnswer("  Rassicurante  ")).toBe("rassicurante");
    expect(normalizeBookAnswer("l’olio")).toBe("l'olio");
    expect(normalizeBookAnswer("  parola   multipla  ")).toBe("parola multipla");
  });

  it("gestisce unicode normalization", () => {
    expect(normalizeBookAnswer("caffe\u0301")).toBe(normalizeBookAnswer("caffé"));
  });
});
