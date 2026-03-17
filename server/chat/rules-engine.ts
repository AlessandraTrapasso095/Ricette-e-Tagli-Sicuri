import { differenceInMonths } from "date-fns";

import { businessRulesConfig } from "@/config/business-rules";
import type { ChildProfile, DailyMenuChildProfileSummary, FeedingStyle } from "@/types/domain";
import { buildUserPromptContext, normalizeFreeText } from "@/server/chat/input-normalizer";

export type AgeStage = "under_6" | "6_8" | "8_10" | "10_12" | "12_24" | "24_plus" | "unknown";

export interface MenuPolicyContext {
  hasChildProfile: boolean;
  ageMonths: number | null;
  ageStage: AgeStage;
  feedingStyle: FeedingStyle;
  forbiddenTerms: string[];
  customExclusions: string[];
  promptPreferences: string[];
  allergies: string[];
  foodsToAvoid: string[];
  foodsIntroduced: string[];
  mainMealCompositionText: string;
}

export function computeAgeInMonths(child: ChildProfile): number | null {
  if (child.age_mode === "months") {
    return child.age_months;
  }

  if (!child.birth_date) {
    return null;
  }

  const age = differenceInMonths(new Date(), new Date(child.birth_date));
  return age >= 0 ? age : null;
}

export function getAgeStage(ageMonths: number | null): AgeStage {
  if (ageMonths === null) {
    return "unknown";
  }
  if (ageMonths < 6) {
    return "under_6";
  }
  if (ageMonths <= 8) {
    return "6_8";
  }
  if (ageMonths <= 10) {
    return "8_10";
  }
  if (ageMonths <= 12) {
    return "10_12";
  }
  if (ageMonths < 24) {
    return "12_24";
  }
  return "24_plus";
}

function matchesExclusionAlias(term: string, alias: string) {
  const normalizedTerm = normalizeFreeText(term);
  const normalizedAlias = normalizeFreeText(alias);

  if (!normalizedTerm || !normalizedAlias) {
    return false;
  }

  return normalizedTerm === normalizedAlias || normalizedTerm.includes(normalizedAlias) || normalizedAlias.includes(normalizedTerm);
}

function getExclusionAliasScore(term: string, alias: string) {
  return matchesExclusionAlias(term, alias) ? normalizeFreeText(alias).length : -1;
}

const EXCLUSION_CATEGORY_ALIASES = {
  carne: ["carne"],
  legumi: ["legumi"],
  verdure: ["verdure"],
  cereali: ["cereali"],
  frutta: ["frutta"],
  latticini: ["latticini", "formaggi", "formaggi freschi"],
  pesce: ["pesce"],
  fruttaSecca: ["frutta secca", "frutta secca intera"],
  glutine: ["glutine"],
  uovo: ["uovo", "uova", "frittata"],
} as const satisfies Record<keyof typeof businessRulesConfig.exclusionExpansionGroups, string[]>;

export function expandForbiddenTerm(term: string) {
  const normalizedTerm = normalizeFreeText(term);
  const expanded = new Set<string>();

  if (!normalizedTerm) {
    return [];
  }

  expanded.add(normalizedTerm);

  let bestGroupKey: keyof typeof EXCLUSION_CATEGORY_ALIASES | null = null;
  let bestScore = -1;

  for (const [groupKey, aliases] of Object.entries(EXCLUSION_CATEGORY_ALIASES) as Array<
    [keyof typeof EXCLUSION_CATEGORY_ALIASES, string[]]
  >) {
    const groupScore = Math.max(...aliases.map((alias) => getExclusionAliasScore(normalizedTerm, alias)));
    if (groupScore > bestScore) {
      bestScore = groupScore;
      bestGroupKey = groupKey;
    }
  }

  if (bestGroupKey && bestScore >= 0) {
    businessRulesConfig.exclusionExpansionGroups[bestGroupKey].forEach((alias) => expanded.add(normalizeFreeText(alias)));
  }

  return [...expanded];
}

export function expandForbiddenTerms(terms: string[]) {
  return [...new Set(terms.flatMap((term) => expandForbiddenTerm(term)).filter(Boolean))];
}

export function buildMenuPolicyContext(child: ChildProfile | null, userPrompt: string): MenuPolicyContext {
  const promptContext = buildUserPromptContext(userPrompt);
  const feedingStyle: FeedingStyle = child?.feeding_style ?? "misto";
  const ageMonths = child ? computeAgeInMonths(child) : null;
  const ageStage = getAgeStage(ageMonths);
  const allergies = (child?.allergies ?? []).map(normalizeFreeText).filter(Boolean);
  const foodsToAvoid = (child?.foods_to_avoid ?? []).map(normalizeFreeText).filter(Boolean);
  const foodsIntroduced = (child?.foods_introduced ?? []).map(normalizeFreeText).filter(Boolean);
  const customExclusions = promptContext.customExclusions.map(normalizeFreeText);
  const baseForbidden = businessRulesConfig.forbidden.always.map(normalizeFreeText);

  const forbiddenTerms = expandForbiddenTerms([
    ...baseForbidden,
    ...allergies,
    ...foodsToAvoid,
    ...customExclusions,
  ].filter(Boolean));

  const mainMealCompositionText =
    ageMonths !== null && ageMonths >= 24
      ? `Per pranzo e cena usa: ${businessRulesConfig.balancedPlate.over24Months.vegetablesRatio} verdure, ${businessRulesConfig.balancedPlate.over24Months.carbsRatio} carboidrati, ${businessRulesConfig.balancedPlate.over24Months.proteinsRatio} proteine + ${businessRulesConfig.balancedPlate.over24Months.healthyFats}.`
      : `Per pranzo e cena usa: ${businessRulesConfig.balancedPlate.under24Months.carbsRatio} carboidrati, ${businessRulesConfig.balancedPlate.under24Months.proteinsRatio} proteine, ${businessRulesConfig.balancedPlate.under24Months.vegetablesRatio} verdure + ${businessRulesConfig.balancedPlate.under24Months.healthyFats}.`;

  return {
    hasChildProfile: Boolean(child),
    ageMonths,
    ageStage,
    feedingStyle,
    forbiddenTerms,
    customExclusions,
    promptPreferences: promptContext.detectedPreferences,
    allergies,
    foodsToAvoid,
    foodsIntroduced,
    mainMealCompositionText,
  };
}

export function buildChildProfileSummary(child: ChildProfile | null, policy: MenuPolicyContext): DailyMenuChildProfileSummary {
  const notes: string[] = [];

  if (!child) {
    notes.push("Profilo bambino non configurato: menu prudente e semplice.");
  } else {
    notes.push(`Stile svezzamento: ${child.feeding_style}`);
  }

  if (policy.customExclusions.length > 0) {
    notes.push(`Esclusioni giornaliere: ${policy.customExclusions.join(", ")}`);
  }
  if (policy.allergies.length > 0) {
    notes.push(`Allergie/intolleranze: ${policy.allergies.join(", ")}`);
  }
  if (policy.foodsToAvoid.length > 0) {
    notes.push(`Alimenti da evitare: ${policy.foodsToAvoid.join(", ")}`);
  }
  if (policy.promptPreferences.length > 0) {
    notes.push(...policy.promptPreferences);
  }

  return {
    ageMonths: policy.ageMonths,
    weaningType: child?.feeding_style ?? "non_specificato",
    notes,
  };
}

export function buildChildProfilePromptSummary(child: ChildProfile | null, policy: MenuPolicyContext): string {
  if (!child) {
    return "Profilo bambino non configurato: usa porzioni prudenti e ricette semplici adatte allo svezzamento.";
  }

  const ageDescription = policy.ageMonths !== null ? `${policy.ageMonths} mesi` : "età non indicata";
  const allergies = child.allergies.length > 0 ? child.allergies.join(", ") : "nessuna";
  const foodsToAvoid = child.foods_to_avoid.length > 0 ? child.foods_to_avoid.join(", ") : "nessuno";
  const introduced = child.foods_introduced.length > 0 ? child.foods_introduced.join(", ") : "non specificati";

  return `Bambino: ${child.name}. Età: ${ageDescription}. Svezzamento: ${child.feeding_style}. Allergie/intolleranze: ${allergies}. Alimenti da evitare: ${foodsToAvoid}. Alimenti già introdotti: ${introduced}. Note: ${child.notes ?? "nessuna"}.`;
}

export function buildMenuSystemPrompt(params: {
  childSummaryForPrompt: string;
  userPrompt: string;
  policy: MenuPolicyContext;
  proteinRotationHint?: string;
}): string {
  const stageGuidance =
    params.policy.ageStage === "under_6"
      ? businessRulesConfig.ageStageRules.under6
      : params.policy.ageStage === "6_8"
        ? businessRulesConfig.ageStageRules.from6To8
        : params.policy.ageStage === "8_10"
          ? businessRulesConfig.ageStageRules.from8To10
          : params.policy.ageStage === "10_12"
            ? businessRulesConfig.ageStageRules.from10To12
            : params.policy.ageStage === "12_24"
              ? businessRulesConfig.ageStageRules.from12To24
              : params.policy.ageStage === "24_plus"
                ? businessRulesConfig.ageStageRules.over24
                : "Se età non chiara, restare prudenti con consistenze morbide e tagli sicuri.";

  const styleGuidance =
    businessRulesConfig.feedingStyleGuidance[params.policy.feedingStyle as keyof typeof businessRulesConfig.feedingStyleGuidance];

  return [
    "Sei l'assistente nutrizionale guidato della piattaforma Ricette e Tagli Sicuri.",
    "Genera esclusivamente menu giornalieri pratici per bambini piccoli.",
    "Rispondi in italiano semplice, rassicurante e professionale.",
    `Regole obbligatorie: ${businessRulesConfig.hardSafetyRules.join(" ")}`,
    `${params.policy.mainMealCompositionText}`,
    `Adattamento età: ${stageGuidance}`,
    `Adattamento stile svezzamento (${params.policy.feedingStyle}): ${styleGuidance.join(" ")}`,
    `Alternanza pasti (${params.policy.feedingStyle}): ${businessRulesConfig.mealAlternationGuidance[params.policy.feedingStyle as keyof typeof businessRulesConfig.mealAlternationGuidance].join(" ")}`,
    `Regole tagli sicuri: ${businessRulesConfig.safeCutRules.join(" ")}`,
    `Frequenza proteine settimanale da rispettare nel medio periodo: carne rossa ${businessRulesConfig.proteinFrequencyWeekly.carneRossa}, carne bianca ${businessRulesConfig.proteinFrequencyWeekly.carneBianca}, pesce ${businessRulesConfig.proteinFrequencyWeekly.pesce}, uova ${businessRulesConfig.proteinFrequencyWeekly.uova}, legumi ${businessRulesConfig.proteinFrequencyWeekly.legumi}, formaggi freschi ${businessRulesConfig.proteinFrequencyWeekly.formaggiFreschi}.`,
    `Regola porzioni: ${businessRulesConfig.portionGuidance.text}`,
    params.proteinRotationHint ? `Rotazione proteine settimanale (storico): ${params.proteinRotationHint}` : "",
    `Esclusioni assolute: ${params.policy.forbiddenTerms.join(", ") || "nessuna"}.`,
    "Le esclusioni del profilo bambino e del messaggio utente sono tassative: se il genitore scrive 'no latticini' devi escludere anche latte, yogurt, ricotta e formaggi; se segnala allergie o alimenti da evitare non puoi proporli in nessuna forma.",
    "Le esclusioni non sono limitate agli esempi: ogni richiesta del tipo 'senza X', 'no X', 'niente X' o 'evita X' vale per qualsiasi alimento o categoria alimentare citata dal genitore.",
    "Le quantità devono essere sempre per 1 solo bambino, mai per 2 persone, mai per tutta la famiglia e mai abbondanti.",
    "Ogni nuovo menu deve essere diverso da quello precedente della stessa giornata: cambia davvero famiglie di ricette, ingredienti principali e combinazioni tra i pasti.",
    "Ogni ingrediente deve riportare un dosaggio o una misura concreta (es. 20 g, 2 cucchiai, 120 ml, 1/2 banana, q.b.).",
    "La preparazione deve essere completa, chiara e pratica: almeno 2-3 passaggi reali, non frasi vaghe.",
    "Nel classico usa solo consistenze cremose, frullate, passate o molto fluide: no polpette, no burger, no pancake, no pane, no torte, no finger food, no pezzi.",
    "Nell'autosvezzamento puoi usare polpette, pancake, burger morbidi, pane, torte morbide e formati piu grandi, sempre nei tagli sicuri adeguati.",
    "Nell'autosvezzamento a pranzo usa solo primi o piatti a base di pasta, riso, quinoa, cous cous, orzo o cereali simili con proteina e verdura.",
    "Nell'autosvezzamento burger, polpette, cotolette e frittate vanno a cena, non a pranzo.",
    "Nel misto devi mescolare davvero i due approcci: almeno una proposta classica cremosa e almeno una proposta da autosvezzamento morbida nei tagli sicuri.",
    "Se compare un alimento tondo, cilindrico o duro, specifica sempre il taglio/sicurezza corretto nelle safetyNotes.",
    "Devi proporre 4 pasti: colazione, pranzo, merenda, cena.",
    "Ogni pasto deve includere piatto, ingredienti con dosi, preparazione completa, note pratiche, note sicurezza e sostituzioni. Per pranzo e cena compila anche balancedPlate.",
    "Pranzo e cena devono essere completi e bilanciati; colazione e merenda più semplici ma nutrienti.",
    "Non ripetere lo stesso alimento principale tra colazione e merenda, né tra pranzo e cena: varia il più possibile frutta, cereali, proteine e verdure nella stessa giornata.",
    "Evita menu fotocopia: non proporre sempre porridge a colazione, burger con pasta a pranzo, yogurt con frutta a merenda e polpette a cena.",
    "Privilegia ricette con pochi ingredienti, naturali e non industriali; varia cereali/proteine/verdure nella giornata.",
    "Ricorda sempre che il bambino decide quanto mangiare: no pressioni o forzature.",
    "Output obbligatorio JSON valido e strutturato: childProfileSummary deve essere oggetto con ageMonths, weaningType e notes.",
    "Non inventare allergie o condizioni mediche. Se dati mancanti, aggiungi warnings prudenti.",
    `Profilo bambino: ${params.childSummaryForPrompt}`,
    `Richiesta del genitore: ${params.userPrompt}`,
  ].join("\n");
}

export function hasCompleteMeals(menu: { meals: { mealType: string }[] }) {
  const set = new Set(menu.meals.map((meal) => meal.mealType));
  return businessRulesConfig.mealTypes.every((mealType) => set.has(mealType));
}
