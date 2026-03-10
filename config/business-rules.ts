export const businessRulesConfig = {
  mealTypes: ["colazione", "pranzo", "merenda", "cena"] as const,
  allowedFeedingStyles: ["classico", "autosvezzamento", "misto"] as const,
  hardSafetyRules: [
    "Non proporre alimenti esclusi per allergie o intolleranze.",
    "Usare consistenze e tagli coerenti con l'età del bambino.",
    "Evitare preparazioni con rischio di soffocamento senza note di sicurezza.",
    "Evitare suggerimenti medici: fornire sempre nota di confronto con pediatra in caso di dubbi.",
    "Preferire ricette semplici, ingredienti reperibili e varianti pratiche.",
  ],
  outputConstraints: {
    maxIngredientsPerMeal: 12,
    maxNotesPerMeal: 5,
    maxSubstitutionsPerMeal: 4,
  },
};

export type MealType = (typeof businessRulesConfig.mealTypes)[number];
