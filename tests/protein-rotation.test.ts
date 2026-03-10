import { describe, expect, it } from "vitest";

import {
  buildProteinRotationHint,
  computeProteinWeeklyStats,
  createEmptyProteinStats,
} from "@/server/chat/protein-rotation";
import type { DailyMenuSchema } from "@/server/chat/menu-schema";

function createMenuWithProteins(pranzoIngredients: string[], cenaIngredients: string[]): DailyMenuSchema {
  return {
    title: "Menu",
    childProfileSummary: {
      ageMonths: 10,
      weaningType: "misto",
      notes: [],
    },
    meals: [
      {
        mealType: "colazione",
        dishName: "Colazione",
        ingredients: ["Yogurt", "Avena"],
        preparation: "Mescola e servi.",
        notes: ["Semplice"],
        safetyNotes: ["Tiepido"],
        substitutions: ["Pera"],
      },
      {
        mealType: "pranzo",
        dishName: "Pranzo",
        ingredients: pranzoIngredients,
        preparation: "Cuoci bene e servi.",
        notes: ["Aggiungi olio EVO"],
        safetyNotes: ["Tagli sicuri"],
        substitutions: ["Alternativa"],
        balancedPlate: {
          carbs: "2/4 carboidrati",
          proteins: "1/4 proteine",
          vegetables: "1/4 verdure",
          healthyFats: "olio EVO a crudo",
        },
      },
      {
        mealType: "merenda",
        dishName: "Merenda",
        ingredients: ["Frutta"],
        preparation: "Servi morbida.",
        notes: ["Senza zucchero"],
        safetyNotes: ["Tagli sicuri"],
        substitutions: ["Banana"],
      },
      {
        mealType: "cena",
        dishName: "Cena",
        ingredients: cenaIngredients,
        preparation: "Cuoci bene e servi.",
        notes: ["Aggiungi olio EVO"],
        safetyNotes: ["Tagli sicuri"],
        substitutions: ["Alternativa"],
        balancedPlate: {
          carbs: "2/4 carboidrati",
          proteins: "1/4 proteine",
          vegetables: "1/4 verdure",
          healthyFats: "olio EVO a crudo",
        },
      },
    ],
    dailyNotes: [],
    warnings: [],
    shoppingList: [],
  };
}

describe("protein-rotation", () => {
  it("calcola statistiche proteine dai menu", () => {
    const menus: DailyMenuSchema[] = [
      createMenuWithProteins(["Riso", "Pollo"], ["Patata", "Merluzzo"]),
      createMenuWithProteins(["Farro", "Lenticchie"], ["Pasta", "Ricotta"]),
    ];

    const stats = computeProteinWeeklyStats(menus);
    expect(stats.carne).toBe(1);
    expect(stats.pesce).toBe(1);
    expect(stats.legumi).toBe(1);
    expect(stats.formaggiFreschi).toBe(1);
  });

  it("genera hint utile con preferenze di rotazione", () => {
    const stats = createEmptyProteinStats();
    const hint = buildProteinRotationHint(stats);
    expect(hint.includes("Favorire oggi")).toBe(true);
  });
});
