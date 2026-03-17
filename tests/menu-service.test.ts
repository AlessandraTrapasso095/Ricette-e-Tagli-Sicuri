import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let menuServiceTestables: typeof import("@/server/chat/menu-service").__menuServiceTestables;

beforeAll(async () => {
  const importedMenuService = await import("@/server/chat/menu-service");
  menuServiceTestables = importedMenuService.__menuServiceTestables;
});

describe("menu-service", () => {
  it("non scarta le colazioni baby solo per note come 'senza zucchero'", () => {
    const recipe = menuServiceTestables.selectRecipeFromCatalog({
      style: "classico",
      mealType: "colazione",
      seed: "regression-classico-colazione",
      forbiddenTerms: ["sale aggiunto", "zucchero", "miele", "mais", "pop corn", "funghi"],
    });

    expect(recipe.mealType).toBe("colazione");
    expect(recipe.dishName.length).toBeGreaterThan(0);
  });
});
