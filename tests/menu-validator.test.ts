import { describe, expect, it } from "vitest";

import type { DailyMenuSchema } from "@/server/chat/menu-schema";
import { validateDailyMenu } from "@/server/chat/menu-validator";
import type { MenuPolicyContext } from "@/server/chat/rules-engine";

function createBasePolicy(overrides: Partial<MenuPolicyContext> = {}): MenuPolicyContext {
  const base: MenuPolicyContext = {
    hasChildProfile: true,
    ageMonths: 8,
    ageStage: "6_8",
    feedingStyle: "classico",
    forbiddenTerms: ["sale aggiunto", "zucchero", "miele", "uovo"],
    customExclusions: ["uovo"],
    allergies: [],
    foodsToAvoid: [],
    foodsIntroduced: [],
    promptPreferences: [],
    mainMealCompositionText: "2/4 carboidrati, 1/4 proteine, 1/4 verdure + olio EVO",
  };

  return {
    ...base,
    ...overrides,
    promptPreferences: overrides.promptPreferences ?? base.promptPreferences,
  };
}

function createValidMenu(overrides: Partial<DailyMenuSchema> = {}): DailyMenuSchema {
  return {
    title: "Menu test",
    childProfileSummary: {
      ageMonths: 8,
      weaningType: "classico",
      notes: ["Niente uovo"],
    },
    meals: [
      {
        mealType: "colazione",
        dishName: "Porridge morbido mela e avena",
        ingredients: ["Avena", "Mela cotta"],
        preparation: "Cuoci e servi in crema morbida.",
        notes: ["Senza zucchero aggiunto"],
        safetyNotes: ["Servire tiepido"],
        substitutions: ["Pera cotta"],
      },
      {
        mealType: "pranzo",
        dishName: "Crema di riso con lenticchie e zucchine",
        ingredients: ["Riso", "Lenticchie decorticate", "Zucchine ben cotte"],
        preparation: "Cuoci tutto e frulla in crema liscia.",
        notes: ["Aggiungi olio EVO a crudo"],
        safetyNotes: ["Consistenza morbida adatta a 6-8 mesi"],
        substitutions: ["Farro al posto del riso"],
        balancedPlate: {
          carbs: "2/4 riso",
          proteins: "1/4 lenticchie",
          vegetables: "1/4 zucchine",
          healthyFats: "olio EVO a crudo",
        },
      },
      {
        mealType: "merenda",
        dishName: "Yogurt bianco con pera",
        ingredients: ["Yogurt bianco", "Pera cotta"],
        preparation: "Mescola e servi.",
        notes: ["Merenda semplice e nutriente"],
        safetyNotes: ["Consistenza omogenea"],
        substitutions: ["Banana matura"],
      },
      {
        mealType: "cena",
        dishName: "Vellutata di patate, merluzzo e carote",
        ingredients: ["Patata", "Merluzzo", "Carote ben cotte"],
        preparation: "Cuoci e frulla in vellutata morbida.",
        notes: ["Completa con olio extravergine a crudo"],
        safetyNotes: ["Controlla temperatura e consistenza"],
        substitutions: ["Ceci al posto del merluzzo"],
        balancedPlate: {
          carbs: "2/4 patata",
          proteins: "1/4 merluzzo",
          vegetables: "1/4 carote",
          healthyFats: "olio EVO a crudo",
        },
      },
    ],
    dailyNotes: ["Varia cereali e verdure nella settimana"],
    warnings: ["In caso di dubbi confrontati con il pediatra."],
    shoppingList: ["Avena", "Riso", "Lenticchie", "Zucchine", "Yogurt", "Pera", "Patata", "Merluzzo", "Carote"],
    ...overrides,
  };
}

describe("menu-validator", () => {
  it("accetta un menu coerente con le regole", () => {
    const result = validateDailyMenu(createValidMenu(), createBasePolicy());
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rifiuta menu con alimento vietato/escluso", () => {
    const menu = createValidMenu({
      meals: [
        {
          ...createValidMenu().meals[0],
          ingredients: ["Avena", "Miele"],
        },
        ...createValidMenu().meals.slice(1),
      ],
    });

    const result = validateDailyMenu(menu, createBasePolicy());
    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("vietato/escluso"))).toBe(true);
  });

  it("rifiuta pranzo o cena senza struttura bilanciata", () => {
    const menu = createValidMenu({
      meals: [
        createValidMenu().meals[0],
        {
          ...createValidMenu().meals[1],
          ingredients: ["Riso", "Lenticchie decorticate"],
        },
        createValidMenu().meals[2],
        createValidMenu().meals[3],
      ],
    });

    const result = validateDailyMenu(menu, createBasePolicy());
    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("manca una fonte chiara di verdure"))).toBe(true);
  });
});
