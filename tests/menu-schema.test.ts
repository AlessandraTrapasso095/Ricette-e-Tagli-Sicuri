import { describe, expect, it } from "vitest";

import { dailyMenuSchema } from "@/server/chat/menu-schema";

describe("dailyMenuSchema", () => {
  it("valida un menu completo", () => {
    const result = dailyMenuSchema.safeParse({
      title: "Menu prova",
      childProfileSummary: "Bambino 12 mesi, svezzamento misto.",
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
      childProfileSummary: "Profilo",
      meals: [],
      dailyNotes: [],
      warnings: [],
      shoppingList: [],
    });

    expect(result.success).toBe(false);
  });
});
