import "server-only";

import OpenAI from "openai";
import { subDays } from "date-fns";

import { businessRulesConfig } from "@/config/business-rules";
import { MENU_DAILY_MAX_ATTEMPTS, MENU_SESSION_RESET_TIMEZONE } from "@/config/chat-session";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStartOfDayInTimeZone } from "@/lib/timezone/day-boundary";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { ensureUserHasChatAccess } from "@/server/chat/chat-access";
import { extractCustomExclusions, normalizeFreeText } from "@/server/chat/input-normalizer";
import { dailyMenuJsonSchema, dailyMenuSchema, type DailyMenuSchema } from "@/server/chat/menu-schema";
import { buildProteinRotationHint, computeProteinWeeklyStats } from "@/server/chat/protein-rotation";
import { validateDailyMenu } from "@/server/chat/menu-validator";
import {
  buildChildProfilePromptSummary,
  buildChildProfileSummary,
  buildMenuPolicyContext,
  buildMenuSystemPrompt,
  expandForbiddenTerm,
  hasCompleteMeals,
  type MenuPolicyContext,
} from "@/server/chat/rules-engine";

const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface SavedMenuRow {
  id: string;
  title: string;
  menu_payload: DailyMenuSchema;
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

type RequestedDishMode =
  | "porridge"
  | "yogurt"
  | "pancake"
  | "vellutata"
  | "crema"
  | "pappa"
  | "pastina"
  | "pasta"
  | "riso"
  | "burger"
  | "polpette"
  | "pane"
  | "generic";

function getMenuDayStartIso() {
  return getStartOfDayInTimeZone(new Date(), MENU_SESSION_RESET_TIMEZONE).toISOString();
}

function buildDailyAttemptLimitMessage() {
  if (MENU_DAILY_MAX_ATTEMPTS === null) {
    return "Limite giornaliero disattivato.";
  }

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
  if (MENU_DAILY_MAX_ATTEMPTS === null) {
    return;
  }

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

function hasAnyForbiddenTerm(policy: MenuPolicyContext, candidates: string[]) {
  return candidates.some((candidate) => hasForbiddenTerm(candidate, policy.forbiddenTerms));
}

function mergeForbiddenTerms(...groups: Array<string[] | undefined>) {
  const merged = new Set<string>();

  for (const group of groups) {
    for (const item of group ?? []) {
      const normalized = normalizeFreeText(item);
      if (normalized) {
        merged.add(normalized);
      }
    }
  }

  return [...merged];
}

function pickAllowedOption(options: string[], forbiddenTerms: string[], fallback: string, safeFallback = fallback) {
  for (const option of options) {
    if (!hasForbiddenTerm(option, forbiddenTerms)) {
      return option;
    }
  }

  if (!hasForbiddenTerm(fallback, forbiddenTerms)) {
    return fallback;
  }

  return safeFallback;
}

function pickAllowedOptionExcluding(
  options: string[],
  forbiddenTerms: string[],
  excludedTerms: string[],
  fallback: string,
  safeFallback = fallback,
) {
  const excludedKeys = new Set(excludedTerms.map((item) => normalizeFreeText(item)).filter(Boolean));

  for (const option of options) {
    const normalizedOption = normalizeFreeText(option);
    if (excludedKeys.has(normalizedOption)) {
      continue;
    }

    if (!hasForbiddenTerm(option, forbiddenTerms)) {
      return option;
    }
  }

  return pickAllowedOption(options, forbiddenTerms, fallback, safeFallback);
}

function getExpandedAvoidTerms(rawTerm: string) {
  return expandForbiddenTerm(rawTerm).filter(Boolean);
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
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+(?:oggi|stasera|domani|per favore|grazie|ti prego)$/g, "")
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

function getRequestedDishMode(requestedDish?: string): RequestedDishMode {
  if (!requestedDish) {
    return "generic";
  }

  if (containsTermInText(requestedDish, "porridge")) {
    return "porridge";
  }
  if (containsTermInText(requestedDish, "yogurt")) {
    return "yogurt";
  }
  if (containsTermInText(requestedDish, "pancake")) {
    return "pancake";
  }
  if (containsTermInText(requestedDish, "vellutata")) {
    return "vellutata";
  }
  if (containsTermInText(requestedDish, "crema")) {
    return "crema";
  }
  if (containsTermInText(requestedDish, "pappa")) {
    return "pappa";
  }
  if (containsTermInText(requestedDish, "pastina")) {
    return "pastina";
  }
  if (containsTermInText(requestedDish, "pasta")) {
    return "pasta";
  }
  if (containsTermInText(requestedDish, "riso")) {
    return "riso";
  }
  if (containsTermInText(requestedDish, "burger")) {
    return "burger";
  }
  if (containsTermInText(requestedDish, "polpette")) {
    return "polpette";
  }
  if (containsTermInText(requestedDish, "pane")) {
    return "pane";
  }

  return "generic";
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
  explicitAvoidTerms?: string[];
}): DailyMenuSchema["meals"][number] {
  const forbiddenTerms = mergeForbiddenTerms(params.policy.forbiddenTerms, params.explicitAvoidTerms);
  const requestedDish = params.requestedDish ? cleanPromptTerm(params.requestedDish) : undefined;
  const requestedDishMode = getRequestedDishMode(requestedDish);
  const prefersVellutata = requestedDishMode === "vellutata" || requestedDishMode === "crema";
  const dairyForbidden = hasAnyForbiddenTerm({ ...params.policy, forbiddenTerms }, ["latticini", "latte", "yogurt", "ricotta", "formaggi"]);

  if (params.mealType === "colazione") {
    const fruit = pickAllowedOption(["Banana", "Mela", "Pera", "Prugna"], forbiddenTerms, "Banana", "Banana");
    const liquidBase = dairyForbidden ? "120 ml acqua" : "120 ml latte o acqua";

    if (requestedDishMode === "yogurt" && !dairyForbidden) {
      return {
        mealType: "colazione",
        dishName: `Yogurt con ${fruit.toLowerCase()} e avena morbida`,
        ingredients: ["80 g yogurt bianco intero", `40 g ${fruit.toLowerCase()} cotta o schiacciata`, "10 g fiocchi di avena morbidi"],
        preparation: `Metti lo yogurt in una ciotola. Aggiungi ${fruit.toLowerCase()} già cotta o schiacciata e completa con i fiocchi di avena ammorbiditi per qualche minuto, così la consistenza resta morbida e semplice da offrire.`,
        notes: ["Colazione fresca, semplice e senza zuccheri aggiunti."],
        safetyNotes: ["Servi con consistenza morbida e uniforme."],
        substitutions: ["Puoi sostituire la frutta con altra frutta morbida già introdotta."],
      };
    }

    if (requestedDishMode === "pancake" && params.policy.feedingStyle !== "classico") {
      return {
        mealType: "colazione",
        dishName: `Pancake morbido con ${fruit.toLowerCase()}`,
        ingredients: dairyForbidden
          ? ["20 g farina di avena", "40 g banana schiacciata", "20 ml acqua", `30 g ${fruit.toLowerCase()} schiacciata`]
          : ["20 g farina di avena", "40 g banana schiacciata", "20 g yogurt bianco", `30 g ${fruit.toLowerCase()} schiacciata`],
        preparation: `Mescola gli ingredienti fino a ottenere una pastella morbida. Cuoci un piccolo pancake in padella antiaderente a fuoco dolce, poi servi con ${fruit.toLowerCase()} schiacciata sopra o accanto in consistenza morbida.`,
        notes: ["Adatto ad autosvezzamento o misto se offerto morbido."],
        safetyNotes: ["Offri sempre in pezzi morbidi e nei tagli sicuri adeguati."],
        substitutions: ["Puoi sostituire la frutta con mela cotta o altra frutta morbida."],
      };
    }

    const dishName = `Porridge morbido con ${fruit.toLowerCase()}`;

    return {
      mealType: "colazione",
      dishName,
      ingredients: [`20 g fiocchi di avena`, liquidBase, `40 g ${fruit.toLowerCase()} cotta o schiacciata`],
      preparation: `Versa i fiocchi di avena in un pentolino con ${dairyForbidden ? "l'acqua" : "latte o acqua"}, cuoci a fuoco dolce per 5-6 minuti mescolando fino a ottenere una crema morbida. Aggiungi ${fruit.toLowerCase()} ben cotta o schiacciata e servi tiepido.`,
      notes: ["Colazione semplice e nutriente, senza zucchero aggiunto."],
      safetyNotes: ["Servi tiepido e con consistenza morbida."],
      substitutions: ["Puoi usare altra frutta morbida di stagione."],
    };
  }

  if (params.mealType === "merenda") {
    const fruit = pickAllowedOption(["Banana", "Mela cotta", "Pera", "Prugna"], forbiddenTerms, "Banana", "Banana");

    if (requestedDishMode === "pane" && params.policy.feedingStyle !== "classico") {
      return {
        mealType: "merenda",
        dishName: "Pane morbido con crema e frutta",
        ingredients: ["1 fetta di pane morbido", "20 g crema di legumi decorticati", `30 g ${fruit.toLowerCase()} schiacciata`],
        preparation: `Spalma la crema di legumi sul pane morbido in strato sottile. Accompagna con ${fruit.toLowerCase()} schiacciata o spalmata, mantenendo una consistenza semplice e sicura da offrire.`,
        notes: ["Merenda pratica per autosvezzamento o misto."],
        safetyNotes: ["Pane sempre morbido e offerto in forma sicura."],
        substitutions: ["Puoi sostituire il pane con un pancake morbido."],
      };
    }

    if (requestedDishMode === "yogurt" && !dairyForbidden) {
      return {
        mealType: "merenda",
        dishName: "Merenda yogurt e frutta morbida",
        ingredients: ["80 g yogurt bianco intero", `40 g ${fruit.toLowerCase()} cotta o schiacciata`],
        preparation: `Unisci lo yogurt con ${fruit.toLowerCase()} già cotta o schiacciata fino a ottenere una consistenza omogenea e morbida.`,
        notes: ["Merenda fresca e naturale."],
        safetyNotes: ["Controlla che la frutta sia ben morbida."],
        substitutions: ["Puoi usare altra frutta morbida di stagione."],
      };
    }

    const dishName = dairyForbidden ? "Merenda di frutta morbida e porridge" : "Merenda yogurt e frutta morbida";

    return {
      mealType: "merenda",
      dishName,
      ingredients: dairyForbidden
        ? [`15 g fiocchi di avena`, `100 ml acqua`, `40 g ${fruit.toLowerCase()} cotta o schiacciata`]
        : [`80 g yogurt bianco intero`, `40 g ${fruit.toLowerCase()} cotta o schiacciata`],
      preparation: dairyForbidden
        ? `Cuoci i fiocchi di avena con l'acqua fino a ottenere un porridge morbido. Aggiungi ${fruit.toLowerCase()} cotta o schiacciata e mescola fino a ottenere una consistenza omogenea.`
        : `Unisci lo yogurt con ${fruit.toLowerCase()} cotta o schiacciata fino a ottenere una consistenza omogenea e morbida.`,
      notes: ["Merenda leggera, naturale e senza zuccheri aggiunti."],
      safetyNotes: ["Controlla che non ci siano pezzi duri."],
      substitutions: dairyForbidden
        ? ["Puoi usare anche purea di frutta morbida con porridge semplice."]
        : ["In alternativa yogurt con altra frutta morbida di stagione."],
    };
  }

  const carb = pickAllowedOption(
    params.mealType === "pranzo" ? ["Riso", "Pasta formato piccolo", "Miglio"] : ["Patata", "Orzo", "Pasta corta"],
    forbiddenTerms,
    "Riso",
    "Miglio",
  );
  const protein = pickAllowedOption(
    ["Tacchino", "Lenticchie decorticate", "Ceci decorticati", "Ricotta vaccina", "Merluzzo"],
    forbiddenTerms,
    "Lenticchie decorticate",
    "Ceci decorticati",
  );
  const vegetable = pickAllowedOption(["Zucca", "Carota", "Piselli", "Zucchine", "Broccoli"], forbiddenTerms, "Zucca", "Carota");

  if ((requestedDishMode === "burger" || requestedDishMode === "polpette") && params.policy.feedingStyle !== "classico") {
    const isBurger = requestedDishMode === "burger";
    return {
      mealType: params.mealType,
      dishName: isBurger
        ? `Burger morbido di ${protein.toLowerCase()} con ${carb.toLowerCase()} e ${vegetable.toLowerCase()}`
        : `Polpette morbide di ${protein.toLowerCase()} con ${carb.toLowerCase()} e ${vegetable.toLowerCase()}`,
      ingredients: [`40 g ${protein.toLowerCase()}`, `20 g ${vegetable.toLowerCase()} cotta nell'impasto`, `60 g ${carb.toLowerCase()}`, `40 g ${vegetable.toLowerCase()} cotta come contorno`, "1 cucchiaino olio EVO a crudo"],
      preparation: `Cuoci ${vegetable.toLowerCase()} fino a renderla morbida. Schiaccia o trita ${protein.toLowerCase()}, uniscila a parte della verdura e forma ${isBurger ? "un burger soffice" : "polpette molto morbide"}. Cuoci finché il composto resta morbido, poi servi con ${carb.toLowerCase()} ben cotto e la restante verdura. Completa con olio EVO a crudo.`,
      notes: ["Preparazione morbida e realistica per autosvezzamento o misto."],
      safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'età del bambino."],
      substitutions: [isBurger ? "Puoi trasformarlo in polpette morbide con lo stesso impasto." : "Puoi sostituire con un burger morbido dello stesso impasto."],
      balancedPlate: {
        carbs: params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `1/4 ${carb.toLowerCase()}` : `2/4 ${carb.toLowerCase()}`,
        proteins: `1/4 ${protein.toLowerCase()}`,
        vegetables:
          params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `2/4 ${vegetable.toLowerCase()}` : `1/4 ${vegetable.toLowerCase()}`,
        healthyFats: "olio EVO a crudo",
      },
    };
  }

  if (requestedDishMode === "pasta" || requestedDishMode === "riso" || requestedDishMode === "pastina") {
    const selectedCarb =
      requestedDishMode === "pasta"
        ? pickAllowedOption(["Pasta formato piccolo", "Pasta corta", "Miglio"], forbiddenTerms, carb, "Miglio")
        : requestedDishMode === "riso"
          ? pickAllowedOption(["Riso", "Baby riso", "Miglio"], forbiddenTerms, carb, "Miglio")
          : pickAllowedOption(["Pastina", "Baby riso", "Semolino"], forbiddenTerms, carb, "Semolino");
    const makeClassico = params.policy.feedingStyle === "classico" || requestedDishMode === "pastina";

    return {
      mealType: params.mealType,
      dishName: makeClassico
        ? `${selectedCarb} cremosa con ${vegetable.toLowerCase()} e ${protein.toLowerCase()}`
        : `${selectedCarb} morbida con ${protein.toLowerCase()} e ${vegetable.toLowerCase()}`,
      ingredients: [`25 g ${selectedCarb.toLowerCase()}`, `30 g ${protein.toLowerCase()}`, `60 g ${vegetable.toLowerCase()} cotta`, "1 cucchiaino olio EVO a crudo"],
      preparation: makeClassico
        ? `Cuoci ${selectedCarb.toLowerCase()} e ${vegetable.toLowerCase()} fino a renderli molto morbidi. Unisci ${protein.toLowerCase()} e frulla o schiaccia bene fino a ottenere una consistenza cremosa. Completa con olio EVO a crudo.`
        : `Cuoci ${selectedCarb.toLowerCase()} fino a renderla ben morbida. Unisci ${protein.toLowerCase()} in consistenza soffice e ${vegetable.toLowerCase()} ben cotta, poi servi tutto in forma morbida e semplice da gestire. Completa con olio EVO a crudo.`,
      notes: [makeClassico ? "Consistenza cremosa e omogenea." : "Piatto morbido e bilanciato."],
      safetyNotes: [makeClassico ? "Evita pezzi o consistenze troppo dense." : "Offri in consistenza morbida e adatta all'età."],
      substitutions: ["Puoi sostituire la verdura con altra verdura di stagione."],
      balancedPlate: {
        carbs: params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `1/4 ${selectedCarb.toLowerCase()}` : `2/4 ${selectedCarb.toLowerCase()}`,
        proteins: `1/4 ${protein.toLowerCase()}`,
        vegetables:
          params.policy.ageMonths !== null && params.policy.ageMonths >= 24 ? `2/4 ${vegetable.toLowerCase()}` : `1/4 ${vegetable.toLowerCase()}`,
        healthyFats: "olio EVO a crudo",
      },
    };
  }

  const makeClassico = params.policy.feedingStyle === "classico" || prefersVellutata || requestedDishMode === "pappa";
  const makeAuto = params.policy.feedingStyle === "autosvezzamento";
  const dishName = makeClassico
    ? `Vellutata di ${vegetable.toLowerCase()} con ${protein.toLowerCase()} e ${carb.toLowerCase()}`
    : `Piatto morbido di ${carb.toLowerCase()} con ${protein.toLowerCase()} e ${vegetable.toLowerCase()}`;

  return {
    mealType: params.mealType,
    dishName,
    ingredients: [`25 g ${carb.toLowerCase()}`, `30 g ${protein.toLowerCase()}`, `60 g ${vegetable.toLowerCase()} cotta`, `1 cucchiaino olio EVO a crudo`],
    preparation: makeClassico
      ? `Cuoci ${carb.toLowerCase()} e ${vegetable.toLowerCase()} fino a renderli molto morbidi. Unisci ${protein.toLowerCase()} e frulla o schiaccia bene fino a ottenere una crema liscia, completando con olio EVO a crudo.`
      : `Cuoci ${carb.toLowerCase()} e ${vegetable.toLowerCase()} fino a renderli morbidi. Prepara ${protein.toLowerCase()} in consistenza soffice, uniscilo al piatto e servi tutto in forma morbida e nei tagli sicuri adeguati, completando con olio EVO a crudo.`,
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
    /(?:cambia|modifica|rifai|proponi|trasforma)\s+(?:la|il)?\s*(colazione|pranzo|merenda|cena)\s+(?:con|in)\s+(.+?)(?=,|\.|;|!|\?|$)/g;
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
    const mealRegex = new RegExp(`(?:cambia|modifica|sostituisci|proponi|rifai|trasforma)\\s+(?:la|il)?\\s*${mealType}(?:\\b|$)`);
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

  for (const extractedTerm of extractCustomExclusions(userPrompt)) {
    const term = cleanPromptTerm(extractedTerm);
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

function sanitizeMenuAgainstForbiddenTerms(menu: DailyMenuSchema, policy: MenuPolicyContext): DailyMenuSchema {
  let replacedMeals = false;

  const meals = menu.meals.map((meal) => {
    const matchedForbiddenTerms = policy.forbiddenTerms.filter((term) => containsTermInMeal(meal, term));
    if (matchedForbiddenTerms.length === 0) {
      return meal;
    }

    replacedMeals = true;
    return buildAlternativeMeal({
      mealType: meal.mealType,
      policy,
      explicitAvoidTerms: matchedForbiddenTerms,
    });
  });

  if (!replacedMeals) {
    return menu;
  }

  return {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues([...menu.warnings, "Alcuni alimenti esclusi sono stati rimossi automaticamente dal menu."]),
  };
}

const BROAD_VARIETY_TERMS_TO_IGNORE = new Set(["carne", "pesce", "uovo", "uova", "legumi", "verdure", "frutta", "cereali"]);

function getVarietyKeywords() {
  return [
    ...businessRulesConfig.ingredientGroups.carbs,
    ...businessRulesConfig.ingredientGroups.proteins,
    ...businessRulesConfig.ingredientGroups.vegetables,
    ...businessRulesConfig.ingredientGroups.fruits,
    ...Object.values(businessRulesConfig.proteinCategoryKeywords).flat(),
  ]
    .map((item) => normalizeFreeText(item))
    .filter((item) => item.length > 1 && !BROAD_VARIETY_TERMS_TO_IGNORE.has(item));
}

function extractRepeatedMealTerms(firstMeal: DailyMenuSchema["meals"][number], secondMeal: DailyMenuSchema["meals"][number]) {
  const keywords = getVarietyKeywords();
  const firstText = normalizeFreeText(`${firstMeal.dishName} ${firstMeal.ingredients.join(" ")} ${firstMeal.preparation}`);
  const secondText = normalizeFreeText(`${secondMeal.dishName} ${secondMeal.ingredients.join(" ")} ${secondMeal.preparation}`);

  return [...new Set(keywords.filter((keyword) => firstText.includes(keyword) && secondText.includes(keyword)))];
}

function enforceDailyMealVariety(menu: DailyMenuSchema, policy: MenuPolicyContext): DailyMenuSchema {
  const meals = [...menu.meals];
  const warnings = [...menu.warnings];

  const breakfastIndex = meals.findIndex((meal) => meal.mealType === "colazione");
  const snackIndex = meals.findIndex((meal) => meal.mealType === "merenda");
  if (breakfastIndex !== -1 && snackIndex !== -1) {
    const repeated = extractRepeatedMealTerms(meals[breakfastIndex], meals[snackIndex]);
    if (repeated.length > 0) {
      meals[snackIndex] = buildAlternativeMeal({
        mealType: "merenda",
        policy,
        explicitAvoidTerms: mergeForbiddenTerms(policy.forbiddenTerms, repeated),
      });
      warnings.push(`Merenda variata automaticamente per evitare ripetizioni con la colazione (${repeated.join(", ")}).`);
    }
  }

  const lunchIndex = meals.findIndex((meal) => meal.mealType === "pranzo");
  const dinnerIndex = meals.findIndex((meal) => meal.mealType === "cena");
  if (lunchIndex !== -1 && dinnerIndex !== -1) {
    const repeated = extractRepeatedMealTerms(meals[lunchIndex], meals[dinnerIndex]);
    if (repeated.length > 0) {
      meals[dinnerIndex] = buildAlternativeMeal({
        mealType: "cena",
        policy,
        explicitAvoidTerms: mergeForbiddenTerms(policy.forbiddenTerms, repeated),
      });
      warnings.push(`Cena variata automaticamente per evitare ripetizioni con il pranzo (${repeated.join(", ")}).`);
    }
  }

  return {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues(warnings),
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
        explicitAvoidTerms: policy.forbiddenTerms,
      });
      warnings.push(`Pasto ${mealChange.mealType} aggiornato con richiesta: ${mealChange.requestedDish}.`);
    }

    if (previousMeal && getMealSignature(meals[index]) === getMealSignature(previousMeal)) {
      meals[index] = buildAlternativeMeal({
        mealType: mealChange.mealType,
        policy,
        requestedDish: mealChange.requestedDish,
        explicitAvoidTerms: policy.forbiddenTerms,
      });
      warnings.push(`Pasto ${mealChange.mealType} rigenerato con una variante alternativa.`);
    }
  }

  for (const avoidTerm of forced.avoidTerms) {
    const expandedTerms = getExpandedAvoidTerms(avoidTerm);
    const currentText = menuToFullText({ ...menu, meals });
    const matchedTerms = expandedTerms.filter((term) => containsTermInText(currentText, term));

    if (matchedTerms.length === 0) {
      continue;
    }

    meals = meals.map((meal) => {
      const mealHasMatchedTerm = matchedTerms.some((term) => containsTermInMeal(meal, term));
      if (!mealHasMatchedTerm) {
        return meal;
      }

      return buildAlternativeMeal({
        mealType: meal.mealType,
        policy,
        explicitAvoidTerms: mergeForbiddenTerms(policy.forbiddenTerms, matchedTerms),
      });
    });

    warnings.push(`Ingrediente non disponibile o escluso sostituito automaticamente: ${avoidTerm}.`);
  }

  if (forced.requiresVariation && previousMenu && isSameMenuAsPrevious({ ...menu, meals }, previousMenu)) {
    const targetMeal = forced.mealChanges[0]?.mealType ?? "cena";
    const index = meals.findIndex((meal) => meal.mealType === targetMeal);
    if (index !== -1) {
      meals[index] = buildAlternativeMeal({
        mealType: targetMeal,
        policy,
        requestedDish: forced.mealChanges[0]?.requestedDish,
        explicitAvoidTerms: policy.forbiddenTerms,
      });
      warnings.push(`Menu variato automaticamente sul pasto ${targetMeal}.`);
    }
  }

  const adjustedMenu = {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues(warnings),
  };

  return enforceDailyMealVariety(sanitizeMenuAgainstForbiddenTerms(adjustedMenu, policy), policy);
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
    const expandedTerms = getExpandedAvoidTerms(avoidTerm);
    if (expandedTerms.some((term) => containsTermInText(menuText, term))) {
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

function buildBalancedPlateForPolicy(policy: MenuPolicyContext, carbLabel: string, proteinLabel: string, vegetableLabel: string) {
  return {
    carbs: policy.ageMonths !== null && policy.ageMonths >= 24 ? `1/4 ${carbLabel}` : `2/4 ${carbLabel}`,
    proteins: `1/4 ${proteinLabel}`,
    vegetables: policy.ageMonths !== null && policy.ageMonths >= 24 ? `2/4 ${vegetableLabel}` : `1/4 ${vegetableLabel}`,
    healthyFats: "olio EVO a crudo",
  };
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
  const dairyForbidden = hasAnyForbiddenTerm(policy, ["latticini", "latte", "yogurt", "ricotta", "formaggi"]);
  const breakfastFruit = pickAllowedOption(
    isModification ? ["banana", "mela", "pera"] : ["mela", "banana", "pera"],
    policy.forbiddenTerms,
    "banana",
    "Banana",
  );
  const snackFruit = pickAllowedOptionExcluding(
    isModification ? ["banana", "mela cotta", "pera"] : ["mela cotta", "banana", "pera"],
    policy.forbiddenTerms,
    [breakfastFruit],
    "mela cotta",
    "banana",
  );
  const classicLunchCarb = pickAllowedOption(
    isModification ? ["baby riso", "pastina", "semolino"] : ["pastina", "baby riso", "semolino"],
    policy.forbiddenTerms,
    "baby riso",
    "miglio",
  );
  const classicDinnerCarb = pickAllowedOption(
    isModification ? ["pastina", "baby riso", "semolino"] : ["semolino", "pastina", "baby riso"],
    policy.forbiddenTerms,
    "pastina",
    "semolino",
  );
  const classicLunchProtein = pickAllowedOption(
    isModification ? ["lenticchie decorticate", "ricotta fresca"] : ["ricotta fresca", "lenticchie decorticate"],
    policy.forbiddenTerms,
    "lenticchie decorticate",
    "ceci decorticati",
  );
  const classicDinnerProtein = pickAllowedOption(
    isModification ? ["ceci decorticati", "ricotta fresca"] : ["ceci decorticati", "ricotta fresca"],
    policy.forbiddenTerms,
    "ceci decorticati",
    "lenticchie decorticate",
  );
  const autoLunchProtein = pickAllowedOption(
    isModification ? ["tacchino", "ceci decorticati", "merluzzo"] : ["tacchino", "merluzzo", "ceci decorticati"],
    policy.forbiddenTerms,
    "tacchino",
    "merluzzo",
  );
  const autoDinnerProtein = pickAllowedOption(
    isModification ? ["ceci decorticati", "tacchino", "merluzzo"] : ["ceci decorticati", "tacchino", "merluzzo"],
    policy.forbiddenTerms,
    "ceci decorticati",
    "tacchino",
  );
  const classicLunchVegetable = pickAllowedOption(
    isModification ? ["zucca", "carota", "zucchine"] : ["zucchine", "zucca", "carota"],
    policy.forbiddenTerms,
    "zucchine",
    "zucca",
  );
  const classicDinnerVegetable = pickAllowedOption(
    isModification ? ["carota", "piselli", "zucca"] : ["carota", "zucca", "piselli"],
    policy.forbiddenTerms,
    "carota",
    "piselli",
  );
  const autoLunchVegetable = pickAllowedOption(
    isModification ? ["zucchine", "carota", "zucca"] : ["zucchine", "carota", "zucca"],
    policy.forbiddenTerms,
    "zucchine",
    "carota",
  );
  const autoDinnerVegetable = pickAllowedOption(
    isModification ? ["zucca", "carota", "zucchine"] : ["zucca", "carota", "zucchine"],
    policy.forbiddenTerms,
    "zucca",
    "broccoli",
  );
  const autoLunchCarb = pickAllowedOption(
    isModification ? ["pasta corta", "riso", "patata"] : ["pasta corta", "patata", "riso"],
    policy.forbiddenTerms,
    "pasta corta",
    "riso",
  );
  const autoDinnerCarb = pickAllowedOption(
    isModification ? ["cous cous", "patata", "pasta corta"] : ["cous cous", "patata", "pasta corta"],
    policy.forbiddenTerms,
    "patata",
    "orzo",
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

  const classicoMenu: DailyMenuSchema = {
    title: "Menu giornaliero bilanciato",
    childProfileSummary,
    meals: [
      {
        mealType: "colazione",
        dishName: `Porridge morbido con ${breakfastFruit}`,
        ingredients: [`20 g fiocchi di avena`, dairyForbidden ? `120 ml acqua` : `120 ml latte o acqua`, `40 g ${breakfastFruit} cotta o schiacciata`],
        preparation: `Versa i fiocchi di avena in un pentolino con ${dairyForbidden ? "l'acqua" : "latte o acqua"}, cuoci a fuoco dolce per 5-6 minuti mescolando fino a ottenere una crema morbida. Aggiungi la ${breakfastFruit} cotta o schiacciata e servi tiepido.`,
        notes: ["Consistenza morbida e cremosa."],
        safetyNotes: ["Servire tiepido e senza pezzi grandi."],
        substitutions: ["Sostituisci la frutta con altra frutta morbida di stagione."],
      },
      {
        mealType: "pranzo",
        dishName: `Crema di ${classicLunchCarb} con ${classicLunchVegetable} e ${classicLunchProtein}`,
        ingredients: [`25 g ${classicLunchCarb}`, `150 ml brodo vegetale leggero`, `60 g ${classicLunchVegetable} cotta`, `30 g ${classicLunchProtein}`, `1 cucchiaino olio EVO a crudo`],
        preparation: `Cuoci ${classicLunchVegetable} finche molto morbida. Cuoci ${classicLunchCarb} nel brodo vegetale, unisci ${classicLunchProtein} e frulla tutto con la verdura fino a ottenere una crema liscia. Completa con olio EVO a crudo.`,
        notes: ["Preparazione morbida, fluida e omogenea."],
        safetyNotes: ["Nessun pezzo intero o consistenza densa."],
        substitutions: ["Puoi sostituire la verdura con un'altra verdura ben cotta e frullata."],
        balancedPlate: buildBalancedPlateForPolicy(policy, classicLunchCarb, classicLunchProtein, classicLunchVegetable),
      },
      {
        mealType: "merenda",
        dishName: dairyForbidden ? `Porridge morbido con purea di ${snackFruit}` : `Yogurt bianco con purea di ${snackFruit}`,
        ingredients: dairyForbidden
          ? [`15 g fiocchi di avena`, `100 ml acqua`, `40 g ${snackFruit} cotta o schiacciata`]
          : [`80 g yogurt bianco intero`, `40 g ${snackFruit} cotta o schiacciata`],
        preparation: dairyForbidden
          ? `Cuoci i fiocchi di avena con l'acqua fino a ottenere un porridge morbido. Aggiungi la ${snackFruit} gia cotta o schiacciata e mescola fino a rendere la consistenza uniforme.`
          : `Metti lo yogurt in una ciotola, aggiungi la ${snackFruit} gia cotta o schiacciata e mescola fino a ottenere una consistenza uniforme e morbida.`,
        notes: ["Merenda semplice e cremosa."],
        safetyNotes: ["Servire senza pezzi grossi o consistenze dense."],
        substitutions: ["Puoi usare altra frutta morbida ben schiacciata."],
      },
      {
        mealType: "cena",
        dishName: `Pastina cremosa con ${classicDinnerVegetable} e ${classicDinnerProtein}`,
        ingredients: [`25 g ${classicDinnerCarb}`, `150 ml brodo vegetale leggero`, `60 g ${classicDinnerVegetable} cotta`, `30 g ${classicDinnerProtein}`, `1 cucchiaino olio EVO a crudo`],
        preparation: `Cuoci ${classicDinnerVegetable} finche morbida. Porta a cottura ${classicDinnerCarb} nel brodo, aggiungi ${classicDinnerProtein} e la verdura, poi frulla o schiaccia fino a ottenere una crema fluida. Completa con olio EVO a crudo.`,
        notes: ["Consistenza classica, morbida e omogenea."],
        safetyNotes: ["No pezzi, no composti densi, no formati grandi."],
        substitutions: [
          dairyForbidden
            ? "Puoi sostituire i legumi con un'altra purea di legumi decorticati gia introdotti."
            : "Puoi sostituire i legumi con ricotta fresca se gia introdotta.",
        ],
        balancedPlate: buildBalancedPlateForPolicy(policy, classicDinnerCarb, classicDinnerProtein, classicDinnerVegetable),
      },
    ],
    dailyNotes: ["Offri acqua durante tutta la giornata."],
    warnings,
    shoppingList: [
      "fiocchi di avena",
      breakfastFruit,
      classicLunchCarb,
      classicLunchVegetable,
      classicLunchProtein,
      ...(dairyForbidden ? [] : ["yogurt bianco intero"]),
      classicDinnerCarb,
      classicDinnerVegetable,
      classicDinnerProtein,
    ],
  };

  const autosvezzamentoMenu: DailyMenuSchema = {
    title: "Menu giornaliero bilanciato",
    childProfileSummary,
    meals: [
      {
        mealType: "colazione",
        dishName: `Porridge con ${breakfastFruit} morbida`,
        ingredients: [`20 g fiocchi di avena`, dairyForbidden ? `120 ml acqua` : `120 ml latte o acqua`, `40 g ${breakfastFruit} schiacciata`],
        preparation: `Cuoci i fiocchi di avena con ${dairyForbidden ? "l'acqua" : "latte o acqua"} finche diventano morbidi e cremosi. Aggiungi la ${breakfastFruit} schiacciata e servi tiepido in una consistenza facile da raccogliere con il cucchiaio.`,
        notes: ["Colazione morbida e facile da offrire in autonomia assistita."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: ["Puoi sostituire la frutta con altra frutta morbida ben matura."],
      },
      {
        mealType: "pranzo",
        dishName: `Burger morbido di ${autoLunchProtein} con ${autoLunchCarb} e ${autoLunchVegetable}`,
        ingredients: [`40 g ${autoLunchProtein}`, `20 g ${autoLunchVegetable} cotta nell'impasto`, `60 g ${autoLunchCarb}`, `50 g ${autoLunchVegetable} cotta come contorno`, `1 cucchiaino olio EVO a crudo`],
        preparation: `Cuoci bene ${autoLunchVegetable}. Trita o schiaccia ${autoLunchProtein}, uniscilo a una parte della verdura e forma un burger molto morbido. Cuocilo in padella o forno finche resta soffice. Servi con ${autoLunchCarb} ben cotto e la restante verdura, completando con olio EVO a crudo.`,
        notes: ["Preparazione morbida, facile da afferrare e non asciutta."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: ["Puoi sostituire il burger con polpette morbide dello stesso impasto."],
        balancedPlate: buildBalancedPlateForPolicy(policy, autoLunchCarb, autoLunchProtein, autoLunchVegetable),
      },
      {
        mealType: "merenda",
        dishName: "Pane morbido con crema di ceci e frutta",
        ingredients: [`1 fetta pane morbido`, `25 g ceci decorticati cotti e schiacciati`, `30 g ${snackFruit} schiacciata`],
        preparation: `Schiaccia i ceci fino a ottenere una crema morbida, spalmarla sul pane e servi accanto la ${snackFruit} schiacciata oppure spalmata in strato sottile.`,
        notes: ["Merenda semplice da gestire."],
        safetyNotes: ["Pane e frutta sempre offerti in forma morbida e nei tagli sicuri."],
        substitutions: ["Puoi sostituire il pane con pancake morbido se gia tollerato."],
      },
      {
        mealType: "cena",
        dishName: `Polpette morbide di ${autoDinnerProtein} con ${autoDinnerCarb} e ${autoDinnerVegetable}`,
        ingredients: [`40 g ${autoDinnerProtein}`, `25 g ${autoDinnerCarb}`, `60 g ${autoDinnerVegetable} cotta`, `1 cucchiaino olio EVO a crudo`, `1 cucchiaino pangrattato q.b.`],
        preparation: `Cuoci ${autoDinnerVegetable} finche morbida. Schiaccia o frulla ${autoDinnerProtein}, mescolalo con parte della verdura e poca base legante q.b. fino a ottenere un composto molto morbido. Forma piccole polpette schiacciabili, cuocile in forno o padella e servi con ${autoDinnerCarb} ben cotto e la restante verdura, completando con olio EVO a crudo.`,
        notes: ["Polpette molto morbide e umide."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: ["Puoi sostituire le polpette con burger morbidi usando lo stesso impasto."],
        balancedPlate: buildBalancedPlateForPolicy(policy, autoDinnerCarb, autoDinnerProtein, autoDinnerVegetable),
      },
    ],
    dailyNotes: ["Offri acqua durante tutta la giornata."],
    warnings,
    shoppingList: [
      "fiocchi di avena",
      breakfastFruit,
      autoLunchProtein,
      autoLunchCarb,
      autoLunchVegetable,
      "pane morbido",
      "ceci decorticati",
      autoDinnerProtein,
      autoDinnerCarb,
      autoDinnerVegetable,
    ],
  };

  const mistoMenu: DailyMenuSchema = {
    title: "Menu giornaliero bilanciato",
    childProfileSummary,
    meals: [
      {
        mealType: "colazione",
        dishName: `Porridge morbido con ${breakfastFruit}`,
        ingredients: [`20 g fiocchi di avena`, dairyForbidden ? `120 ml acqua` : `120 ml latte o acqua`, `40 g ${breakfastFruit} schiacciata`],
        preparation: `Cuoci i fiocchi di avena con ${dairyForbidden ? "l'acqua" : "latte o acqua"} fino a ottenere una crema morbida. Aggiungi la ${breakfastFruit} schiacciata e servi tiepido.`,
        notes: ["Colazione semplice e cremosa."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: ["Puoi usare altra frutta morbida di stagione."],
      },
      {
        mealType: "pranzo",
        dishName: `Crema di ${classicLunchCarb} con ${classicLunchVegetable} e ${classicLunchProtein}`,
        ingredients: [`25 g ${classicLunchCarb}`, `150 ml brodo vegetale leggero`, `60 g ${classicLunchVegetable} cotta`, `30 g ${classicLunchProtein}`, `1 cucchiaino olio EVO a crudo`],
        preparation: `Cuoci ${classicLunchVegetable} finche molto morbida. Cuoci ${classicLunchCarb} nel brodo, unisci ${classicLunchProtein} e frulla tutto fino a ottenere una crema liscia. Completa con olio EVO a crudo.`,
        notes: ["Pasto in stile classico."],
        safetyNotes: ["Consistenza morbida e omogenea."],
        substitutions: ["Puoi sostituire la verdura con altra verdura cotta e frullata."],
        balancedPlate: buildBalancedPlateForPolicy(policy, classicLunchCarb, classicLunchProtein, classicLunchVegetable),
      },
      {
        mealType: "merenda",
        dishName: dairyForbidden ? "Porridge morbido con frutta schiacciata" : "Yogurt bianco con frutta morbida",
        ingredients: dairyForbidden
          ? [`15 g fiocchi di avena`, `100 ml acqua`, `40 g ${snackFruit} schiacciata`]
          : [`80 g yogurt bianco intero`, `40 g ${snackFruit} schiacciata`],
        preparation: dairyForbidden
          ? `Cuoci i fiocchi di avena con l'acqua fino a ottenere un porridge morbido. Aggiungi la ${snackFruit} schiacciata e mescola fino a rendere il tutto uniforme e semplice da offrire.`
          : `Mescola lo yogurt con la ${snackFruit} schiacciata fino a ottenere una consistenza uniforme e facile da offrire.`,
        notes: ["Merenda semplice."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: [
          dairyForbidden ? "Puoi sostituire con purea di frutta e cereale morbido." : "Puoi sostituire lo yogurt con porridge morbido.",
        ],
      },
      {
        mealType: "cena",
        dishName: `Burger morbido di ${autoDinnerProtein} con ${autoDinnerCarb} e ${autoDinnerVegetable}`,
        ingredients: [`40 g ${autoDinnerProtein}`, `20 g ${autoDinnerVegetable} cotta nell'impasto`, `60 g ${autoDinnerCarb}`, `50 g ${autoDinnerVegetable} cotta come contorno`, `1 cucchiaino olio EVO a crudo`],
        preparation: `Cuoci ${autoDinnerVegetable} finche molto morbida. Trita o schiaccia ${autoDinnerProtein}, uniscilo a parte della verdura e forma un burger soffice. Cuocilo finche morbido e servilo con ${autoDinnerCarb} ben cotto e la restante verdura, completando con olio EVO a crudo.`,
        notes: ["Pasto in stile autosvezzamento, morbido e facile da afferrare."],
        safetyNotes: ["Offrire sempre nei tagli sicuri adeguati all'eta del bambino."],
        substitutions: ["Puoi sostituire il burger con polpette morbide dello stesso impasto."],
        balancedPlate: buildBalancedPlateForPolicy(policy, autoDinnerCarb, autoDinnerProtein, autoDinnerVegetable),
      },
    ],
    dailyNotes: ["Offri acqua durante tutta la giornata."],
    warnings,
    shoppingList: [
      "fiocchi di avena",
      breakfastFruit,
      classicLunchCarb,
      classicLunchVegetable,
      classicLunchProtein,
      ...(dairyForbidden ? [] : ["yogurt bianco intero"]),
      autoDinnerProtein,
      autoDinnerCarb,
      autoDinnerVegetable,
    ],
  };

  const menu =
    policy.feedingStyle === "classico"
      ? classicoMenu
      : policy.feedingStyle === "autosvezzamento"
        ? autosvezzamentoMenu
        : mistoMenu;

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

  return (data ?? [])
    .map((row) => {
      const parsedMenu = dailyMenuSchema.safeParse(row.menu_payload);
      if (!parsedMenu.success) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        menu_payload: parsedMenu.data,
        created_at: row.created_at,
      } satisfies SavedMenuRow;
    })
    .filter((row): row is SavedMenuRow => row !== null);
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
