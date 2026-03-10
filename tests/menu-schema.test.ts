import { describe, expect, it } from "vitest";

import { dailyMenuSchema } from "@/server/chat/menu-schema";

describe("dailyMenuSchema", () => {
  it("valida un menu completo", () => {
    const result = dailyMenuSchema.safeParse({
      title: "Menu prova",
      childProfileSummary: {
        ageMonths: 12,
        weaningType: "misto",
        notes: ["Profilo demo"],
      },
      meals: [
        {
          mealType: "colazione",
          dishName: "Porridge",
          ingredients: ["Avena", "Mela"],
          preparation: "Cuoci e servi tiepido.",
          notes: ["Senza zucchero"],
          safetyNotes: ["Controlla temperatura"],
          substitutions: ["Pera"],
        },
        {
          mealType: "pranzo",
          dishName: "Pasta e zucchine",
          ingredients: ["Pasta", "Zucchine"],
          preparation: "Cuoci e frulla.",
          notes: ["Usa olio evo"],
          safetyNotes: ["Tagli sicuri"],
          substitutions: ["Zucca"],
          balancedPlate: {
            carbs: "2/4 pasta",
            proteins: "1/4 legumi",
            vegetables: "1/4 zucchine",
            healthyFats: "olio EVO a crudo",
          },
        },
        {
          mealType: "merenda",
          dishName: "Yogurt e banana",
          ingredients: ["Yogurt", "Banana"],
          preparation: "Mescola e servi.",
          notes: ["Senza zuccheri aggiunti"],
          safetyNotes: ["Consistenza omogenea"],
          substitutions: ["Pera"],
        },
        {
          mealType: "cena",
          dishName: "Polpette morbide",
          ingredients: ["Lenticchie", "Patata"],
          preparation: "Forma e cuoci in forno.",
          notes: ["Accompagna con verdure"],
          safetyNotes: ["Morbide e schiacciabili"],
          substitutions: ["Ceci"],
          balancedPlate: {
            carbs: "2/4 patata",
            proteins: "1/4 legumi",
            vegetables: "1/4 verdure",
            healthyFats: "olio EVO a crudo",
          },
        },
      ],
      dailyNotes: ["Offri acqua durante la giornata"],
      warnings: ["Confrontati col pediatra in caso di dubbi"],
      shoppingList: ["Avena", "Mela", "Pasta"],
    });

    expect(result.success).toBe(true);
  });

  it("rifiuta menu senza 4 pasti", () => {
    const result = dailyMenuSchema.safeParse({
      title: "Menu incompleto",
      childProfileSummary: {
        ageMonths: null,
        weaningType: "non_specificato",
        notes: [],
      },
      meals: [],
      dailyNotes: [],
      warnings: [],
      shoppingList: [],
    });

    expect(result.success).toBe(false);
  });
});
