import { businessRulesConfig } from "@/config/business-rules";
import type { DailyMenuSchema } from "@/server/chat/menu-schema";

export type ProteinCategory = "carne" | "pesce" | "uova" | "legumi" | "formaggiFreschi";

export interface ProteinWeeklyStats {
  carne: number;
  pesce: number;
  uova: number;
  legumi: number;
  formaggiFreschi: number;
}

function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMealProteinCategory(text: string): ProteinCategory | null {
  const normalized = normalizeText(text);

  const orderedCategories: ProteinCategory[] = ["pesce", "carne", "uova", "legumi", "formaggiFreschi"];
  for (const category of orderedCategories) {
    const keywords = businessRulesConfig.proteinCategoryKeywords[category];
    if (keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return category;
    }
  }

  return null;
}

export function createEmptyProteinStats(): ProteinWeeklyStats {
  return {
    carne: 0,
    pesce: 0,
    uova: 0,
    legumi: 0,
    formaggiFreschi: 0,
  };
}

export function computeProteinWeeklyStats(menus: DailyMenuSchema[]): ProteinWeeklyStats {
  const stats = createEmptyProteinStats();

  for (const menu of menus) {
    for (const meal of menu.meals) {
      if (meal.mealType !== "pranzo" && meal.mealType !== "cena") {
        continue;
      }

      const sourceText = `${meal.dishName} ${meal.ingredients.join(" ")} ${meal.preparation}`;
      const category = detectMealProteinCategory(sourceText);
      if (category) {
        stats[category] += 1;
      }
    }
  }

  return stats;
}

export function buildProteinRotationHint(stats: ProteinWeeklyStats): string {
  const parts: string[] = [
    `Storico ultimi 7 giorni: carne ${stats.carne}, pesce ${stats.pesce}, uova ${stats.uova}, legumi ${stats.legumi}, formaggi freschi ${stats.formaggiFreschi}.`,
  ];

  const targets = businessRulesConfig.proteinFrequencyTargets;
  const underRepresented: string[] = [];
  const overRepresented: string[] = [];

  (Object.keys(targets) as ProteinCategory[]).forEach((category) => {
    const current = stats[category];
    const target = targets[category];
    if (current < target.min) {
      underRepresented.push(category);
    }
    if (current > target.max + 1) {
      overRepresented.push(category);
    }
  });

  if (underRepresented.length > 0) {
    parts.push(`Favorire oggi: ${underRepresented.join(", ")}.`);
  }
  if (overRepresented.length > 0) {
    parts.push(`Ridurre ripetizioni di: ${overRepresented.join(", ")}.`);
  }

  if (underRepresented.length === 0 && overRepresented.length === 0) {
    parts.push("Mantenere varietà senza ripetere la stessa proteina tra pranzo e cena.");
  }

  return parts.join(" ");
}
