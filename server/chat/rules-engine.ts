import { differenceInMonths } from "date-fns";

import { businessRulesConfig } from "@/config/business-rules";
import type { ChildProfile } from "@/types/domain";

function computeAgeInMonths(child: ChildProfile): number | null {
  if (child.age_mode === "months") {
    return child.age_months;
  }

  if (!child.birth_date) {
    return null;
  }

  const age = differenceInMonths(new Date(), new Date(child.birth_date));
  return age >= 0 ? age : null;
}

export function buildChildProfileSummary(child: ChildProfile | null): string {
  if (!child) {
    return "Profilo bambino non configurato: usa porzioni prudenti e ricette semplici adatte allo svezzamento.";
  }

  const ageMonths = computeAgeInMonths(child);
  const ageDescription = ageMonths !== null ? `${ageMonths} mesi` : "età non indicata";
  const allergies = child.allergies.length > 0 ? child.allergies.join(", ") : "nessuna";
  const foodsToAvoid = child.foods_to_avoid.length > 0 ? child.foods_to_avoid.join(", ") : "nessuno";
  const introduced = child.foods_introduced.length > 0 ? child.foods_introduced.join(", ") : "non specificati";

  return `Bambino: ${child.name}. Età: ${ageDescription}. Svezzamento: ${child.feeding_style}. Allergie/intolleranze: ${allergies}. Alimenti da evitare: ${foodsToAvoid}. Alimenti già introdotti: ${introduced}. Note: ${child.notes ?? "nessuna"}.`;
}

export function buildMenuSystemPrompt(params: {
  childSummary: string;
  userPrompt: string;
}): string {
  return [
    "Sei l'assistente nutrizionale guidato della piattaforma Ricette e Tagli Sicuri.",
    "Genera esclusivamente menu giornalieri pratici per bambini piccoli.",
    "Rispondi in italiano semplice, rassicurante e professionale.",
    `Regole obbligatorie: ${businessRulesConfig.hardSafetyRules.join(" ")}`,
    "Devi proporre 4 pasti: colazione, pranzo, merenda, cena.",
    "Ogni pasto deve includere piatto, ingredienti, preparazione breve, note pratiche, note sicurezza e sostituzioni.",
    "Non inventare allergie o condizioni mediche. Se dati mancanti, aggiungi warnings prudenti.",
    `Profilo bambino: ${params.childSummary}`,
    `Richiesta del genitore: ${params.userPrompt}`,
  ].join("\n");
}

export function hasCompleteMeals(menu: { meals: { mealType: string }[] }) {
  const set = new Set(menu.meals.map((meal) => meal.mealType));
  return businessRulesConfig.mealTypes.every((mealType) => set.has(mealType));
}
