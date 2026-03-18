import { describe, expect, it } from "vitest";

import { buildMenuPolicyContext, expandForbiddenTerm } from "@/server/chat/rules-engine";

describe("rules-engine", () => {
  it("non espande frutta secca intera in tutta la categoria frutta", () => {
    const expanded = expandForbiddenTerm("frutta secca intera");

    expect(expanded).toContain("frutta secca intera");
    expect(expanded).not.toContain("banana");
    expect(expanded).not.toContain("mela");
    expect(expanded).not.toContain("pera");
  });

  it("senza esclusioni utente non vieta la frutta base nelle colazioni e merende", () => {
    const policy = buildMenuPolicyContext(null, "Cosa mangiamo oggi?");

    expect(policy.forbiddenTerms).not.toContain("banana");
    expect(policy.forbiddenTerms).not.toContain("mela");
    expect(policy.forbiddenTerms).not.toContain("pera");
  });

  it("espande i termini alimentari anche nelle forme singolare e plurale", () => {
    const singular = expandForbiddenTerm("prugna");
    const plural = expandForbiddenTerm("prugne");

    expect(singular).toContain("prugna");
    expect(singular).toContain("prugne");
    expect(plural).toContain("prugna");
    expect(plural).toContain("prugne");
  });
});
