import "server-only";

import OpenAI from "openai";
import { subDays } from "date-fns";

import { MENU_DAILY_MAX_ATTEMPTS, MENU_SESSION_RESET_TIMEZONE } from "@/config/chat-session";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStartOfDayInTimeZone } from "@/lib/timezone/day-boundary";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { ensureUserHasChatAccess } from "@/server/chat/chat-access";
import { normalizeFreeText } from "@/server/chat/input-normalizer";
import { dailyMenuJsonSchema, dailyMenuSchema, type DailyMenuSchema } from "@/server/chat/menu-schema";
import { buildProteinRotationHint, computeProteinWeeklyStats } from "@/server/chat/protein-rotation";
import { validateDailyMenu } from "@/server/chat/menu-validator";
import {
  buildChildProfilePromptSummary,
  buildChildProfileSummary,
  buildMenuPolicyContext,
  buildMenuSystemPrompt,
  hasCompleteMeals,
  type MenuPolicyContext,
} from "@/server/chat/rules-engine";

const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface SavedMenuRow {
  id: string;
  title: string;
  menu_payload: unknown;
  created_at: string;
}

const MEAL_TYPES = ["colazione", "pranzo", "merenda", "cena"] as const;
type MealType = (typeof MEAL_TYPES)[number];

interface IngredientReplacement {
  from: string;
  to: string;
}

interface MealChangeRequest {
  mealType: MealType;
  requestedDish?: string;
}

interface ForcedMenuAdjustments {
  replacements: IngredientReplacement[];
  avoidTerms: string[];
  mealChanges: MealChangeRequest[];
  requiresVariation: boolean;
}

function getMenuDayStartIso() {
  return getStartOfDayInTimeZone(new Date(), MENU_SESSION_RESET_TIMEZONE).toISOString();
}

function buildDailyAttemptLimitMessage() {
  return `Hai raggiunto il limite di ${MENU_DAILY_MAX_ATTEMPTS} tentativi giornalieri. Potrai riprovare dopo la mezzanotte.`;
}

async function archiveExpiredDailySessions(admin: AdminClient, userId: string, dayStartIso: string) {
  const { error } = await admin
    .from("menu_sessions")
    .update({ is_archived: true })
    .eq("user_id", userId)
    .eq("is_archived", false)
    .lt("created_at", dayStartIso);

  if (error) {
    throw new Error("Impossibile aggiornare le sessioni giornaliere.");
  }
}

async function assertDailyAttemptLimit(params: {
  admin: AdminClient;
  userId: string;
  dayStartIso: string;
}) {
  const { count, error } = await params.admin
    .from("menu_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .not("menu_payload", "is", null)
    .gte("created_at", params.dayStartIso);

  if (error) {
    throw new Error("Impossibile verificare i tentativi giornalieri.");
  }

  if ((count ?? 0) >= MENU_DAILY_MAX_ATTEMPTS) {
    throw new Error(buildDailyAttemptLimitMessage());
  }
}

async function ensureSessionIsAvailableToday(params: {
  admin: AdminClient;
  userId: string;
  sessionId: string;
  dayStartIso: string;
}) {
  const { data: session, error } = await params.admin
    .from("menu_sessions")
    .select("id")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("is_archived", false)
    .gte("created_at", params.dayStartIso)
    .maybeSingle();

  if (error || !session) {
    throw new Error("Sessione non disponibile: genera un nuovo menu per oggi.");
  }
}

async function getLatestAssistantMenuFromSession(params: {
  admin: AdminClient;
  userId: string;
  sessionId: string;
}) {
  const { data, error } = await params.admin
    .from("menu_messages")
    .select("menu_payload")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .not("menu_payload", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.menu_payload) {
    return null;
  }

  const parsed = dailyMenuSchema.safeParse(data.menu_payload);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function buildModificationPrompt(params: {
  userPrompt: string;
  previousMenu: DailyMenuSchema;
  forcedAdjustments: ForcedMenuAdjustments;
}) {
  const previousMeals = params.previousMenu.meals
    .map((meal) => `${meal.mealType}: ${meal.dishName} (${meal.ingredients.join(", ")})`)
    .join(" | ");

  const intentLines: string[] = [];
  if (params.forcedAdjustments.replacements.length > 0) {
    intentLines.push(
      `Sostituzioni obbligatorie: ${params.forcedAdjustments.replacements.map((item) => `${item.from} -> ${item.to}`).join("; ")}.`,
    );
  }
  if (params.forcedAdjustments.avoidTerms.length > 0) {
    intentLines.push(`Ingredienti da evitare: ${params.forcedAdjustments.avoidTerms.join(", ")}.`);
  }
  if (params.forcedAdjustments.mealChanges.length > 0) {
    intentLines.push(
      `Pasti da cambiare: ${params.forcedAdjustments.mealChanges
        .map((item) => (item.requestedDish ? `${item.mealType} -> ${item.requestedDish}` : item.mealType))
        .join("; ")}.`,
    );
  }
  if (params.forcedAdjustments.requiresVariation) {
    intentLines.push("Il nuovo menu deve essere realmente diverso dal precedente.");
  }

  return [
    "Modifica il menu precedente rispettando tutte le regole obbligatorie della piattaforma.",
    `Menu precedente: ${previousMeals}`,
    `Richiesta di modifica del genitore: ${params.userPrompt}`,
    ...intentLines,
    "Mantieni struttura giornaliera completa (colazione, pranzo, merenda, cena), bilanciamento e sicurezza.",
  ].join("\n");
}

function hasExplicitModificationIntent(forced: ForcedMenuAdjustments) {
  return (
    forced.replacements.length > 0 ||
    forced.avoidTerms.length > 0 ||
    forced.mealChanges.length > 0 ||
    forced.requiresVariation
  );
}

function hasForbiddenTerm(text: string, forbiddenTerms: string[]) {
  const normalized = normalizeFreeText(text);
  return forbiddenTerms.some((term) => {
    const normalizedTerm = normalizeFreeText(term);
    return normalizedTerm.length > 0 && (normalized.includes(normalizedTerm) || normalizedTerm.includes(normalized));
  });
}

function pickAllowedOption(options: string[], forbiddenTerms: string[], fallback: string) {
  for (const option of options) {
    if (!hasForbiddenTerm(option, forbiddenTerms)) {
      return option;
    }
  }

  return fallback;
}

function dedupeValues(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = normalizeFreeText(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
  }

  return output;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanPromptTerm(raw: string) {
  return normalizeFreeText(raw)
    .replace(/^(?:il|lo|la|i|gli|le|un|uno|una)\s+/, "")
    .replace(/^(?:questo|questa|quello|quella|questi|queste|quelli|quelle)\s+/, "")
    .replace(/^(?:quello|quella|quelli|quelle)\s+di\s+/, "")
    .replace(/^di\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMealType(value: string): value is MealType {
  return MEAL_TYPES.includes(value as MealType);
}

function containsTermInText(text: string, term: string) {
  const normalizedText = normalizeFreeText(text);
  const normalizedTerm = cleanPromptTerm(term);
  if (!normalizedTerm) {
    return false;
  }

  return normalizedText.includes(normalizedTerm);
}

function mealToText(meal: DailyMenuSchema["meals"][number]) {
  return [
    meal.dishName,
    meal.ingredients.join(" "),
    meal.preparation,
    meal.notes.join(" "),
    meal.safetyNotes.join(" "),
    meal.substitutions.join(" "),
    meal.balancedPlate?.carbs ?? "",
    meal.balancedPlate?.proteins ?? "",
    meal.balancedPlate?.vegetables ?? "",
    meal.balancedPlate?.healthyFats ?? "",
  ].join(" ");
}

function menuToFullText(menu: DailyMenuSchema) {
  return menu.meals.map((meal) => mealToText(meal)).join(" ");
}

function containsTermInMeal(meal: DailyMenuSchema["meals"][number], term: string) {
  return containsTermInText(mealToText(meal), term);
}

function applyTextReplacements(input: string, replacements: IngredientReplacement[]) {
  return replacements.reduce((acc, replacement) => {
    if (!replacement.from || !replacement.to) {
      return acc;
    }

    const pattern = new RegExp(escapeRegExp(replacement.from), "gi");
    return acc.replace(pattern, replacement.to);
  }, input);
}

function applyReplacementsToMeal(meal: DailyMenuSchema["meals"][number], replacements: IngredientReplacement[]) {
  if (replacements.length === 0) {
    return meal;
  }

  return {
    ...meal,
    dishName: applyTextReplacements(meal.dishName, replacements),
    ingredients: dedupeValues(meal.ingredients.map((item) => applyTextReplacements(item, replacements))),
    preparation: applyTextReplacements(meal.preparation, replacements),
    notes: meal.notes.map((note) => applyTextReplacements(note, replacements)),
    safetyNotes: meal.safetyNotes.map((note) => applyTextReplacements(note, replacements)),
    substitutions: meal.substitutions.map((item) => applyTextReplacements(item, replacements)),
    balancedPlate: meal.balancedPlate
      ? {
          carbs: applyTextReplacements(meal.balancedPlate.carbs, replacements),
          proteins: applyTextReplacements(meal.balancedPlate.proteins, replacements),
          vegetables: applyTextReplacements(meal.balancedPlate.vegetables, replacements),
          healthyFats: applyTextReplacements(meal.balancedPlate.healthyFats, replacements),
        }
      : meal.balancedPlate,
  };
}

function getMealSignature(meal: DailyMenuSchema["meals"][number]) {
  const ingredients = [...meal.ingredients].map((value) => normalizeFreeText(value)).sort().join(",");
  return `${meal.mealType}:${normalizeFreeText(meal.dishName)}:${ingredients}`;
}

function buildAlternativeMeal(params: {
  mealType: MealType;
  policy: MenuPolicyContext;
  requestedDish?: string;
}): DailyMenuSchema["meals"][number] {
  const requestedDish = params.requestedDish ? cleanPromptTerm(params.requestedDish) : undefined;
  const prefersVellutata = requestedDish ? containsTermInText(requestedDish, "vellutata") || containsTermInText(requestedDish, "crema") : false;

  if (params.mealType === "colazione") {
    const fruit = pickAllowedOption(["Pera", "Banana", "Mela"], params.policy.forbiddenTerms, "Pera");
    const dishName = requestedDish ? `${requestedDish} con ${fruit.toLowerCase()}` : `Porridge morbido con ${fruit.toLowerCase()}`;

    return {
      mealType: "colazione",
      dishName,
      ingredients: ["Fiocchi di avena", "Latte o yogurt naturale", fruit],
      preparation: `Prepara una base morbida e aggiungi ${fruit.toLowerCase()} ben schiacciata.`,
      notes: ["Colazione semplice e nutriente, senza zucchero aggiunto."],
      safetyNotes: ["Servi tiepido e con consistenza morbida."],
      substitutions: ["Puoi usare altra frutta morbida di stagione."],
    };
  }

  if (params.mealType === "merenda") {
    const fruit = pickAllowedOption(["Pera", "Banana", "Mela cotta"], params.policy.forbiddenTerms, "Pera");
    const dishName = requestedDish ? requestedDish : "Merenda yogurt e frutta morbida";

    return {
      mealType: "merenda",
      dishName,
      ingredients: ["Yogurt bianco intero", fruit],
      preparation: `Unisci yogurt e ${fruit.toLowerCase()} in consistenza omogenea.`,
      notes: ["Merenda leggera, naturale e senza zuccheri aggiunti."],
      safetyNotes: ["Controlla che non ci siano pezzi duri."],
      substitutions: ["In alternativa pane morbido con crema 100% frutta secca (in forma sicura)."],
    };
  }

  const carb = pickAllowedOption(
    params.mealType === "pranzo" ? ["Riso", "Pasta formato piccolo", "Miglio"] : ["Patata", "Orzo", "Pasta corta"],
    params.policy.forbiddenTerms,
    "Riso",
  );
  const protein = pickAllowedOption(
    ["Tacchino", "Lenticchie decorticate", "Ricotta vaccina", "Ceci decorticati"],
    params.policy.forbiddenTerms,
    "Lenticchie decorticate",
  );
  const vegetable = pickAllowedOption(["Zucca", "Zucchine", "Carota", "Piselli"], params.policy.forbiddenTerms, "Zucca");

  const makeClassico = params.policy.feedingStyle === "classico" || prefersVellutata;
  const makeAuto = params.policy.feedingStyle === "autosvezzamento";
  const dishName = requestedDish
    ? requestedDish
    : makeClassico
      ? `Vellutata di ${vegetable.toLowerCase()} con ${protein.toLowerCase()}`
      : `Piatto morbido di ${carb.toLowerCase()} con ${protein.toLowerCase()} e ${vegetable.toLowerCase()}`;

  return {
    mealType: params.mealType,
    dishName,
    ingredients: [carb, protein, vegetable],
    preparation: makeClassico
      ? `Cuoci ${carb.toLowerCase()} e ${vegetable.toLowerCase()}, aggiungi ${protein.toLowerCase()} e frulla in crema morbida.`
      : `Cuoci ${carb.toLowerCase()} e ${vegetable.toLowerCase()}, unisci ${protein.toLowerCase()} in consistenza morbida e servila in tagli sicuri.`,
    notes: [
      "Completa con olio EVO a crudo.",
      makeAuto ? "Forma e servizio in tagli sicuri/finger food." : "Consistenza morbida e facilmente gestibile.",
    ],
    safetyNotes: [
      "Bambino seduto, schiena dritta e supervisione adulta.",
      makeAuto ? "Tagli sicuri adeguati all'età." : "Evita pezzi duri o di grande dimensione.",
    ],
    substitutions: ["Puoi sostituire la verdura con altra verdura di stagione."],
    balancedPlate: {
      carbs: params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `1/4 ${carb.toLowerCase()}` : `2/4 ${carb.toLowerCase()}`,
      proteins: `1/4 ${protein.toLowerCase()}`,
      vegetables:
        params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `2/4 ${vegetable.toLowerCase()}` : `1/4 ${vegetable.toLowerCase()}`,
      healthyFats: "olio EVO a crudo",
    },
  };
}

function pickReplacementForAvoidTerm(avoidTerm: string, policy: MenuPolicyContext) {
  const term = cleanPromptTerm(avoidTerm);
  if (term.includes("pollo")) return "tacchino";
  if (term.includes("pasta")) return "riso";
  if (term.includes("riso")) return "crema mais e tapioca";
  if (term.includes("zucchin")) return "zucca";
  if (term.includes("uovo")) return "ricotta vaccina";
  if (term.includes("latte")) return "yogurt naturale";

  return pickAllowedOption(["zucca", "carota", "patata", "lenticchie decorticate"], [term, ...policy.forbiddenTerms], "zucca");
}

function getForcedMenuAdjustments(userPrompt: string): ForcedMenuAdjustments {
  const normalizedPrompt = normalizeFreeText(userPrompt);
  const replacements: IngredientReplacement[] = [];
  const avoidTerms = new Set<string>();
  const mealChangesMap = new Map<MealType, MealChangeRequest>();
  let requiresVariation = /(?:proponimi|proponi)\s+altro|qualcos'?altro|menu diverso|cambia menu|fammi altro/.test(normalizedPrompt);

  const replacementRegex =
    /sostituisci\s+(.+?)\s+(?:al posto di|invece di|con il|con la|con lo|con i|con le|col|con)\s+(.+?)(?=,|\.|;|!|\?|$)/g;
  for (const match of normalizedPrompt.matchAll(replacementRegex)) {
    const from = cleanPromptTerm(match[1] ?? "");
    const to = cleanPromptTerm(match[2] ?? "");
    if (!from || !to) {
      continue;
    }

    if (isMealType(from)) {
      mealChangesMap.set(from, { mealType: from, requestedDish: to });
    } else {
      replacements.push({ from, to });
    }
    requiresVariation = true;
  }

  const mealWithTargetRegex =
    /(?:cambia|modifica|rifai|proponi)\s+(?:la|il)?\s*(colazione|pranzo|merenda|cena)\s+(?:con|in)\s+(.+?)(?=,|\.|;|!|\?|$)/g;
  for (const match of normalizedPrompt.matchAll(mealWithTargetRegex)) {
    const mealType = cleanPromptTerm(match[1] ?? "");
    const requestedDish = cleanPromptTerm(match[2] ?? "");

    if (isMealType(mealType)) {
      mealChangesMap.set(mealType, {
        mealType,
        requestedDish: requestedDish || undefined,
      });
      requiresVariation = true;
    }
  }

  for (const mealType of MEAL_TYPES) {
    const mealRegex = new RegExp(`(?:cambia|modifica|sostituisci|proponi|rifai)\\s+(?:la|il)?\\s*${mealType}(?:\\b|$)`);
    if (mealRegex.test(normalizedPrompt) && !mealChangesMap.has(mealType)) {
      mealChangesMap.set(mealType, { mealType });
      requiresVariation = true;
    }
  }

  const haveNotRegex = /ho\s+(.+?)\s+e\s+non\s+(.+?)(?=,|\.|;|!|\?|$)/g;
  for (const match of normalizedPrompt.matchAll(haveNotRegex)) {
    const preferred = cleanPromptTerm(match[1] ?? "");
    const notAvailable = cleanPromptTerm(match[2] ?? "");

    if (notAvailable) {
      avoidTerms.add(notAvailable);
    }
    if (preferred && notAvailable) {
      replacements.push({ from: notAvailable, to: preferred });
      requiresVariation = true;
    }
  }

  const nonHoRegex = /(?:non ho|non abbiamo)\s+(.+?)(?=,|\.|;|!|\?|$)/g;
  for (const match of normalizedPrompt.matchAll(nonHoRegex)) {
    const term = cleanPromptTerm(match[1] ?? "");
    if (term) {
      avoidTerms.add(term);
    }
  }

  const genericAvoidRegex = /(?:senza|no)\s+(.+?)(?=,|\.|;|!|\?|$)/g;
  for (const match of normalizedPrompt.matchAll(genericAvoidRegex)) {
    const term = cleanPromptTerm(match[1] ?? "");
    if (term) {
      avoidTerms.add(term);
    }
  }

  const uniqueReplacements: IngredientReplacement[] = [];
  const replacementKeys = new Set<string>();
  for (const replacement of replacements) {
    const key = `${replacement.from}->${replacement.to}`;
    if (replacementKeys.has(key) || replacement.from === replacement.to) {
      continue;
    }
    replacementKeys.add(key);
    uniqueReplacements.push(replacement);
  }

  return {
    replacements: uniqueReplacements,
    avoidTerms: [...avoidTerms],
    mealChanges: [...mealChangesMap.values()],
    requiresVariation,
  };
}

function applyForcedAdjustments(
  menu: DailyMenuSchema,
  policy: MenuPolicyContext,
  forced: ForcedMenuAdjustments,
  previousMenu?: DailyMenuSchema,
): DailyMenuSchema {
  let meals = menu.meals.map((meal) => applyReplacementsToMeal(meal, forced.replacements));
  const warnings: string[] = [...menu.warnings];

  for (const mealChange of forced.mealChanges) {
    const index = meals.findIndex((meal) => meal.mealType === mealChange.mealType);
    if (index === -1) {
      continue;
    }

    const currentMeal = meals[index];
    const previousMeal = previousMenu?.meals.find((meal) => meal.mealType === mealChange.mealType);
    const requestedMissing = mealChange.requestedDish ? !containsTermInMeal(currentMeal, mealChange.requestedDish) : false;

    if (requestedMissing) {
      meals[index] = buildAlternativeMeal({
        mealType: mealChange.mealType,
        policy,
        requestedDish: mealChange.requestedDish,
      });
      warnings.push(`Pasto ${mealChange.mealType} aggiornato con richiesta: ${mealChange.requestedDish}.`);
    }

    if (previousMeal && getMealSignature(meals[index]) === getMealSignature(previousMeal)) {
      meals[index] = buildAlternativeMeal({
        mealType: mealChange.mealType,
        policy,
        requestedDish: mealChange.requestedDish,
      });
      warnings.push(`Pasto ${mealChange.mealType} rigenerato con una variante alternativa.`);
    }
  }

  for (const avoidTerm of forced.avoidTerms) {
    const currentText = menuToFullText({ ...menu, meals });
    if (!containsTermInText(currentText, avoidTerm)) {
      continue;
    }

    const replacement = pickReplacementForAvoidTerm(avoidTerm, policy);
    meals = meals.map((meal) => applyReplacementsToMeal(meal, [{ from: avoidTerm, to: replacement }]));
    warnings.push(`Ingrediente non disponibile sostituito automaticamente: ${avoidTerm} -> ${replacement}.`);
  }

  if (forced.requiresVariation && previousMenu && isSameMenuAsPrevious({ ...menu, meals }, previousMenu)) {
    const targetMeal = forced.mealChanges[0]?.mealType ?? "cena";
    const index = meals.findIndex((meal) => meal.mealType === targetMeal);
    if (index !== -1) {
      meals[index] = buildAlternativeMeal({
        mealType: targetMeal,
        policy,
        requestedDish: forced.mealChanges[0]?.requestedDish,
      });
      warnings.push(`Menu variato automaticamente sul pasto ${targetMeal}.`);
    }
  }

  return {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues(warnings),
  };
}

function evaluateForcedAdjustments(
  menu: DailyMenuSchema,
  previousMenu: DailyMenuSchema | undefined,
  forced: ForcedMenuAdjustments,
) {
  const issues: string[] = [];
  const menuText = menuToFullText(menu);

  for (const replacement of forced.replacements) {
    if (containsTermInText(menuText, replacement.from)) {
      issues.push(`La sostituzione richiesta non è completa: rimuovi "${replacement.from}".`);
    }
    if (!containsTermInText(menuText, replacement.to)) {
      issues.push(`La sostituzione richiesta non è stata applicata: inserisci "${replacement.to}".`);
    }
  }

  for (const avoidTerm of forced.avoidTerms) {
    if (containsTermInText(menuText, avoidTerm)) {
      issues.push(`Ingrediente non disponibile ancora presente nel menu: "${avoidTerm}".`);
    }
  }

  for (const mealChange of forced.mealChanges) {
    const currentMeal = menu.meals.find((meal) => meal.mealType === mealChange.mealType);
    const previousMeal = previousMenu?.meals.find((meal) => meal.mealType === mealChange.mealType);

    if (!currentMeal) {
      issues.push(`Manca il pasto ${mealChange.mealType} nel menu aggiornato.`);
      continue;
    }

    if (mealChange.requestedDish && !containsTermInMeal(currentMeal, mealChange.requestedDish)) {
      issues.push(`Il pasto ${mealChange.mealType} non rispetta la richiesta "${mealChange.requestedDish}".`);
    }

    if (previousMeal && getMealSignature(currentMeal) === getMealSignature(previousMeal)) {
      issues.push(`Il pasto ${mealChange.mealType} non è stato modificato rispetto al menu precedente.`);
    }
  }

  if (forced.requiresVariation && previousMenu && isSameMenuAsPrevious(menu, previousMenu)) {
    issues.push("Il menu risulta ancora uguale al precedente: proponi una variante diversa.");
  }

  return issues;
}

function menuSignature(menu: DailyMenuSchema) {
  return menu.meals
    .map((meal) => {
      return getMealSignature(meal);
    })
    .sort()
    .join("|");
}

function isSameMenuAsPrevious(currentMenu: DailyMenuSchema, previousMenu: DailyMenuSchema) {
  return menuSignature(currentMenu) === menuSignature(previousMenu);
}

function menuToMessageText(menu: DailyMenuSchema) {
  const mealList = menu.meals
    .map((meal) => `- ${meal.mealType.toUpperCase()}: ${meal.dishName}`)
    .join("\n");

  return `${menu.title}\n\n${mealList}`;
}

function fallbackMenu(
  childProfileSummary: DailyMenuSchema["childProfileSummary"],
  policy: MenuPolicyContext,
  options?: {
    issues?: string[];
    previousMenu?: DailyMenuSchema;
    isModification?: boolean;
    forcedAdjustments?: ForcedMenuAdjustments;
  },
): DailyMenuSchema {
  const issues = options?.issues ?? [];
  const isModification = options?.isModification ?? false;

  const breakfastFruit = pickAllowedOption(
    isModification ? ["Pera grattugiata", "Banana schiacciata", "Mela grattugiata"] : ["Mela grattugiata", "Pera grattugiata", "Banana schiacciata"],
    policy.forbiddenTerms,
    "Frutta morbida di stagione",
  );
  const lunchCarb = pickAllowedOption(
    isModification ? ["Riso", "Pasta formato piccolo", "Semolino"] : ["Pasta formato piccolo", "Riso", "Semolino"],
    policy.forbiddenTerms,
    "Riso",
  );
  const lunchProtein = pickAllowedOption(
    isModification ? ["Lenticchie decorticate", "Ricotta vaccina"] : ["Ricotta vaccina", "Lenticchie decorticate"],
    policy.forbiddenTerms,
    "Legumi decorticati",
  );
  const lunchVegetable = pickAllowedOption(
    isModification ? ["Zucca", "Carota", "Zucchine"] : ["Zucchine", "Zucca", "Carota"],
    policy.forbiddenTerms,
    "Verdura morbida",
  );
  const dinnerCarb = pickAllowedOption(
    isModification ? ["Patata", "Pasta corta", "Orzo"] : ["Patata", "Orzo", "Pasta corta"],
    policy.forbiddenTerms,
    "Patata",
  );
  const dinnerProtein = pickAllowedOption(
    isModification ? ["Ceci già cotti", "Lenticchie già cotte"] : ["Lenticchie già cotte", "Ceci già cotti"],
    policy.forbiddenTerms,
    "Legumi decorticati",
  );
  const dinnerVegetable = pickAllowedOption(
    isModification ? ["Carota", "Piselli", "Zucca"] : ["Carota", "Zucca", "Piselli"],
    policy.forbiddenTerms,
    "Verdura morbida",
  );

  const warnings = ["In caso di dubbi clinici confrontati con il pediatra."];
  if (policy.ageStage === "under_6") {
    warnings.push("Prima dei 6 mesi il latte resta centrale: valuta con il pediatra quando iniziare lo svezzamento.");
  }
  if (issues.length > 0) {
    warnings.push("Menu generato con fallback sicuro per garantire il rispetto delle regole della piattaforma.");
  }
  if (isModification) {
    warnings.push("Menu aggiornato in base alla tua richiesta di modifica.");
  }

  const menu: DailyMenuSchema = {
    title: "Menu giornaliero bilanciato",
    childProfileSummary,
    meals: [
      {
        mealType: "colazione",
        dishName: `Porridge morbido con ${breakfastFruit.toLowerCase()}`,
        ingredients: ["Fiocchi di avena", "Latte o bevanda vegetale adatta", breakfastFruit],
        preparation: `Cuoci avena e latte a fuoco dolce, aggiungi ${breakfastFruit.toLowerCase()} e servi tiepido.`,
        notes: ["Consistenza cremosa."],
        safetyNotes: ["Controlla temperatura prima di servire."],
        substitutions: ["Pera al posto della mela."],
      },
      {
        mealType: "pranzo",
        dishName: `${lunchCarb} con crema di ${lunchVegetable.toLowerCase()} e ${lunchProtein.toLowerCase()}`,
        ingredients: [lunchCarb, lunchVegetable, lunchProtein],
        preparation: `Cuoci ${lunchCarb.toLowerCase()}, frulla ${lunchVegetable.toLowerCase()} cotta e unisci ${lunchProtein.toLowerCase()}.`,
        notes: ["Aggiungi olio EVO a crudo."],
        safetyNotes: ["Taglia eventuali pezzi grandi."],
        substitutions: ["Sostituisci con altra verdura morbida di stagione."],
        balancedPlate: {
          carbs: policy.ageMonths !== null && policy.ageMonths >= 24 ? `1/4 ${lunchCarb.toLowerCase()}` : `2/4 ${lunchCarb.toLowerCase()}`,
          proteins: `1/4 ${lunchProtein.toLowerCase()}`,
          vegetables:
            policy.ageMonths !== null && policy.ageMonths >= 24
              ? `2/4 ${lunchVegetable.toLowerCase()}`
              : `1/4 ${lunchVegetable.toLowerCase()}`,
          healthyFats: "olio EVO a crudo",
        },
      },
      {
        mealType: "merenda",
        dishName: "Yogurt bianco con frutta morbida",
        ingredients: ["Yogurt bianco intero", "Banana matura"],
        preparation: "Schiaccia la banana e uniscila allo yogurt.",
        notes: ["Servire senza zuccheri aggiunti."],
        safetyNotes: ["Consistenza omogenea e senza pezzi duri."],
        substitutions: ["Pera cotta al posto della banana."],
      },
      {
        mealType: "cena",
        dishName: `Polpette morbide di ${dinnerProtein.toLowerCase()} con ${dinnerCarb.toLowerCase()} e ${dinnerVegetable.toLowerCase()}`,
        ingredients: [dinnerProtein, `${dinnerCarb} lessa`, `${dinnerVegetable} ben cotta`, "Pan grattato q.b."],
        preparation: "Frulla, forma polpette morbide e cuoci in forno 15 minuti.",
        notes: ["Servi con olio EVO a crudo e verdure morbide."],
        safetyNotes: ["Controlla che la polpetta sia facilmente schiacciabile e in piccoli pezzi."],
        substitutions: ["Ceci al posto delle lenticchie."],
        balancedPlate: {
          carbs: policy.ageMonths !== null && policy.ageMonths >= 24 ? `1/4 ${dinnerCarb.toLowerCase()}` : `2/4 ${dinnerCarb.toLowerCase()}`,
          proteins: `1/4 ${dinnerProtein.toLowerCase()}`,
          vegetables:
            policy.ageMonths !== null && policy.ageMonths >= 24
              ? `2/4 ${dinnerVegetable.toLowerCase()}`
              : `1/4 ${dinnerVegetable.toLowerCase()}`,
          healthyFats: "olio EVO a crudo",
        },
      },
    ],
    dailyNotes: ["Offri acqua durante tutta la giornata."],
    warnings,
    shoppingList: [
      "Fiocchi di avena",
      breakfastFruit,
      lunchCarb,
      lunchVegetable,
      lunchProtein,
      "Yogurt bianco",
      "Banana",
      dinnerProtein,
      dinnerCarb,
      dinnerVegetable,
    ],
  };

  return applyForcedAdjustments(
    menu,
    policy,
    options?.forcedAdjustments ?? { replacements: [], avoidTerms: [], mealChanges: [], requiresVariation: false },
    options?.previousMenu,
  );
}

function buildRetryPrompt(userPrompt: string, issues: string[]) {
  return [
    userPrompt,
    "",
    "Correggi il menu rispettando TUTTE le regole obbligatorie. Violazioni da risolvere:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

function buildDeterministicModifiedMenu(params: {
  previousMenu: DailyMenuSchema;
  childProfileSummary: DailyMenuSchema["childProfileSummary"];
  policy: MenuPolicyContext;
  forcedAdjustments: ForcedMenuAdjustments;
}) {
  const baseMenu: DailyMenuSchema = {
    ...params.previousMenu,
    title: "Menu giornaliero aggiornato",
    childProfileSummary: params.childProfileSummary,
  };

  return applyForcedAdjustments(baseMenu, params.policy, params.forcedAdjustments, params.previousMenu);
}

async function generateDailyMenuWithOpenAI(params: {
  systemPrompt: string;
  childProfileSummary: DailyMenuSchema["childProfileSummary"];
  userPrompt: string;
  policy: MenuPolicyContext;
  previousMenu?: DailyMenuSchema;
  isModification?: boolean;
  forcedAdjustments: ForcedMenuAdjustments;
}) {
  if (params.previousMenu && hasExplicitModificationIntent(params.forcedAdjustments)) {
    const deterministicMenu = buildDeterministicModifiedMenu({
      previousMenu: params.previousMenu,
      childProfileSummary: params.childProfileSummary,
      policy: params.policy,
      forcedAdjustments: params.forcedAdjustments,
    });

    const deterministicIssues: string[] = [];
    if (!hasCompleteMeals(deterministicMenu)) {
      deterministicIssues.push("Il menu deve includere esattamente colazione, pranzo, merenda e cena.");
    }

    const deterministicValidation = validateDailyMenu(deterministicMenu, params.policy);
    if (!deterministicValidation.isValid) {
      deterministicIssues.push(...deterministicValidation.issues);
    }
    deterministicIssues.push(...evaluateForcedAdjustments(deterministicMenu, params.previousMenu, params.forcedAdjustments));

    if (!isSameMenuAsPrevious(deterministicMenu, params.previousMenu) && deterministicIssues.length === 0) {
      return deterministicMenu;
    }
  }

  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return fallbackMenu(params.childProfileSummary, params.policy, {
      previousMenu: params.previousMenu,
      isModification: params.isModification,
      forcedAdjustments: params.forcedAdjustments,
    });
  }

  const client = new OpenAI({ apiKey });
  let attemptPrompt = params.userPrompt;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await client.responses.create({
      model: getEnv("OPENAI_MODEL") ?? DEFAULT_CHAT_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: params.systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: attemptPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "daily_menu",
          schema: dailyMenuJsonSchema,
          strict: true,
        },
      },
    });

    try {
      const outputText = response.output_text;
      const parsed = dailyMenuSchema.parse(JSON.parse(outputText));
      const adjustedMenu = applyForcedAdjustments(parsed, params.policy, params.forcedAdjustments, params.previousMenu);
      const issues: string[] = [];

      if (!hasCompleteMeals(adjustedMenu)) {
        issues.push("Il menu deve includere esattamente colazione, pranzo, merenda e cena.");
      }

      const validation = validateDailyMenu(adjustedMenu, params.policy);
      if (!validation.isValid) {
        issues.push(...validation.issues);
      }
      issues.push(...evaluateForcedAdjustments(adjustedMenu, params.previousMenu, params.forcedAdjustments));
      if (params.previousMenu && isSameMenuAsPrevious(adjustedMenu, params.previousMenu)) {
        issues.push("Il menu è troppo simile al precedente: cambia ingredienti principali e almeno due piatti.");
      }

      if (issues.length === 0) {
        return adjustedMenu;
      }

      lastIssues = issues;
      attemptPrompt = buildRetryPrompt(params.userPrompt, issues);
    } catch {
      lastIssues = ["Output non valido o non parsabile rispetto allo schema JSON richiesto."];
      attemptPrompt = buildRetryPrompt(params.userPrompt, lastIssues);
    }
  }

  return fallbackMenu(params.childProfileSummary, params.policy, {
    issues: lastIssues,
    previousMenu: params.previousMenu,
    isModification: params.isModification,
    forcedAdjustments: params.forcedAdjustments,
  });
}

async function getProteinRotationHintForUser(userId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const startDateIso = subDays(new Date(), 7).toISOString();

  const { data, error } = await admin
    .from("menu_messages")
    .select("menu_payload")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .not("menu_payload", "is", null)
    .gte("created_at", startDateIso)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return "Storico proteine non disponibile: applica varietà massima evitando ripetizioni.";
  }

  const parsedMenus: DailyMenuSchema[] = [];
  for (const row of data) {
    const parsed = dailyMenuSchema.safeParse(row.menu_payload);
    if (parsed.success) {
      parsedMenus.push(parsed.data);
    }
  }

  if (parsedMenus.length === 0) {
    return "Nessuno storico settimanale: varia proteine tra pranzo e cena.";
  }

  const stats = computeProteinWeeklyStats(parsedMenus);
  return buildProteinRotationHint(stats);
}

export async function getMenuSessions(userId: string) {
  await ensureUserHasChatAccess(userId);
  const admin = createSupabaseAdminClient();
  const dayStartIso = getMenuDayStartIso();

  await archiveExpiredDailySessions(admin, userId, dayStartIso);

  const { data, error } = await admin
    .from("menu_sessions")
    .select("id, title, last_message_at, created_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .gte("created_at", dayStartIso)
    .order("last_message_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSessionMessages(userId: string, sessionId: string) {
  await ensureUserHasChatAccess(userId);
  const admin = createSupabaseAdminClient();
  const dayStartIso = getMenuDayStartIso();

  await archiveExpiredDailySessions(admin, userId, dayStartIso);
  await ensureSessionIsAvailableToday({
    admin,
    userId,
    sessionId,
    dayStartIso,
  });

  const { data, error } = await admin
    .from("menu_messages")
    .select("id, role, content, menu_payload, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function generateMenuFromPrompt(params: {
  userId: string;
  prompt: string;
  sessionId?: string;
  sourceSessionId?: string;
  saveMenu?: boolean;
}) {
  await ensureUserHasChatAccess(params.userId);
  const admin = createSupabaseAdminClient();
  const dayStartIso = getMenuDayStartIso();

  await archiveExpiredDailySessions(admin, params.userId, dayStartIso);
  await assertDailyAttemptLimit({
    admin,
    userId: params.userId,
    dayStartIso,
  });

  if (params.sessionId && params.sourceSessionId) {
    throw new Error("Richiesta non valida: usa sessionId oppure sourceSessionId.");
  }

  const child = await getPrimaryChildProfile(params.userId);
  const policy = buildMenuPolicyContext(child, params.prompt);
  const childProfileSummary = buildChildProfileSummary(child, policy);
  const childSummaryForPrompt = buildChildProfilePromptSummary(child, policy);
  const proteinRotationHint = await getProteinRotationHintForUser(params.userId);
  const forcedAdjustments = getForcedMenuAdjustments(params.prompt);
  let promptForModel = params.prompt;
  let previousMenuForModification: DailyMenuSchema | undefined;

  if (params.sourceSessionId) {
    await ensureSessionIsAvailableToday({
      admin,
      userId: params.userId,
      sessionId: params.sourceSessionId,
      dayStartIso,
    });

    const previousMenu = await getLatestAssistantMenuFromSession({
      admin,
      userId: params.userId,
      sessionId: params.sourceSessionId,
    });

    if (previousMenu) {
      previousMenuForModification = previousMenu;
      promptForModel = buildModificationPrompt({
        userPrompt: params.prompt,
        previousMenu,
        forcedAdjustments,
      });
    }
  }

  let sessionId = params.sessionId;
  if (sessionId) {
    await ensureSessionIsAvailableToday({
      admin,
      userId: params.userId,
      sessionId,
      dayStartIso,
    });
  } else {
    const { data: createdSession, error: sessionError } = await admin
      .from("menu_sessions")
      .insert({
        user_id: params.userId,
        child_id: child?.id ?? null,
        title: "Cosa mangiamo oggi?",
      })
      .select("id")
      .single();

    if (sessionError || !createdSession) {
      throw new Error("Impossibile creare la sessione chat.");
    }

    sessionId = createdSession.id;
  }

  await admin.from("menu_messages").insert({
    session_id: sessionId,
    user_id: params.userId,
    role: "user",
    content: params.prompt,
  });

  const systemPrompt = buildMenuSystemPrompt({
    childSummaryForPrompt,
    userPrompt: params.prompt,
    policy,
    proteinRotationHint,
  });

  const menu = await generateDailyMenuWithOpenAI({
    systemPrompt,
    childProfileSummary,
    userPrompt: promptForModel,
    policy,
    previousMenu: previousMenuForModification,
    isModification: Boolean(params.sourceSessionId),
    forcedAdjustments,
  });
  const assistantText = menuToMessageText(menu);

  const { data: assistantMessage, error: assistantError } = await admin
    .from("menu_messages")
    .insert({
      session_id: sessionId,
      user_id: params.userId,
      role: "assistant",
      content: assistantText,
      menu_payload: menu,
    })
    .select("id")
    .single();

  if (assistantError || !assistantMessage) {
    throw new Error("Impossibile salvare la risposta del menu.");
  }

  await admin
    .from("menu_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      title: menu.title,
      child_id: child?.id ?? null,
    })
    .eq("id", sessionId)
    .eq("user_id", params.userId);

  if (params.saveMenu) {
    await admin.from("saved_menus").insert({
      user_id: params.userId,
      session_id: sessionId,
      child_id: child?.id ?? null,
      source_message_id: assistantMessage.id,
      title: menu.title,
      menu_payload: menu,
    });
  }

  return {
    sessionId,
    assistantMessageId: assistantMessage.id,
    menu,
  };
}

export async function getSavedMenus(userId: string) {
  await ensureUserHasChatAccess(userId);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("saved_menus")
    .select("id, title, menu_payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as SavedMenuRow[];
}

export async function saveMenuFromMessage(params: {
  userId: string;
  sessionId: string;
  messageId: string;
  title?: string;
}) {
  await ensureUserHasChatAccess(params.userId);
  const admin = createSupabaseAdminClient();

  const { data: message, error } = await admin
    .from("menu_messages")
    .select("menu_payload")
    .eq("id", params.messageId)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .maybeSingle();

  if (error || !message?.menu_payload) {
    throw new Error("Messaggio menu non trovato.");
  }

  const parsedMenu = dailyMenuSchema.parse(message.menu_payload);

  const { data, error: saveError } = await admin
    .from("saved_menus")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      source_message_id: params.messageId,
      title: params.title ?? parsedMenu.title,
      menu_payload: parsedMenu,
    })
    .select("id")
    .single();

  if (saveError || !data) {
    throw new Error("Impossibile salvare il menu.");
  }

  return data;
}
