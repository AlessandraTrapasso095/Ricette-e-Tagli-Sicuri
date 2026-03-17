import "server-only";

import OpenAI from "openai";
import { subDays } from "date-fns";

import { businessRulesConfig } from "@/config/business-rules";
import { MENU_SESSION_MAX_DAILY, MENU_SESSION_RESET_TIMEZONE } from "@/config/chat-session";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStartOfDayInTimeZone } from "@/lib/timezone/day-boundary";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { ensureUserHasChatAccess } from "@/server/chat/chat-access";
import { extractCustomExclusions, normalizeFreeText } from "@/server/chat/input-normalizer";
import { dailyMenuJsonSchema, dailyMenuSchema, type DailyMenuSchema } from "@/server/chat/menu-schema";
import { buildProteinRotationHint, computeProteinWeeklyStats } from "@/server/chat/protein-rotation";
import { chatRecipeCatalog, type ChatRecipe } from "@/server/chat/recipe-catalog";
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

async function enforceDailySessionLimit(params: {
  admin: AdminClient;
  userId: string;
  dayStartIso: string;
}) {
  const { count, error } = await params.admin
    .from("menu_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("is_archived", false)
    .gte("created_at", params.dayStartIso);

  if (error) {
    throw new Error("Impossibile verificare il numero di sessioni menu disponibili.");
  }

  if ((count ?? 0) >= MENU_SESSION_MAX_DAILY) {
    throw new Error(
      `Hai raggiunto il limite di ${MENU_SESSION_MAX_DAILY} sessioni menu per oggi. Da mezzanotte potrai generarne di nuove; puoi comunque modificare una sessione già creata.`,
    );
  }
}

async function ensureSessionBelongsToUser(params: {
  admin: AdminClient;
  userId: string;
  sessionId: string;
  dayStartIso?: string;
}) {
  let query = params.admin
    .from("menu_sessions")
    .select("id")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("is_archived", false);

  if (params.dayStartIso) {
    query = query.gte("created_at", params.dayStartIso);
  }

  const { data: session, error } = await query.maybeSingle();

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

async function getLatestAssistantMenuForUser(params: {
  admin: AdminClient;
  userId: string;
  dayStartIso: string;
  excludeSessionId?: string;
}) {
  const { data, error } = await params.admin
    .from("menu_messages")
    .select("menu_payload, session_id")
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .not("menu_payload", "is", null)
    .gte("created_at", params.dayStartIso)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data) {
    return null;
  }

  for (const row of data) {
    if (params.excludeSessionId && row.session_id === params.excludeSessionId) {
      continue;
    }

    const parsed = dailyMenuSchema.safeParse(row.menu_payload);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
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

type ProteinGroup = "legumi" | "pesce" | "latticino" | "carne" | "uovo";

interface BuiltMealMeta {
  family: string;
  fruit?: string;
  carb?: string;
  protein?: string;
  vegetable?: string;
  proteinGroup?: ProteinGroup;
}

interface BuiltMealResult {
  meal: DailyMenuSchema["meals"][number];
  meta: BuiltMealMeta;
}

const RECIPE_FAMILY_ALLOWLIST = {
  classico: {
    colazione: ["porridge", "crema-latte", "yogurt", "budino", "frullato"],
    pranzo: ["pappa-classica", "pastina", "pasta", "riso", "quinoa", "cous-cous", "orzo"],
    merenda: ["purea", "yogurt", "porridge", "frullato", "budino", "pancake", "muffin", "torta", "plumcake"],
    cena: ["crema", "vellutata", "passato"],
  },
  autosvezzamento: {
    colazione: ["pancake", "muffin", "waffle", "crepes", "toast", "porridge", "torta", "banana-bread", "budino"],
    pranzo: ["pasta", "riso", "quinoa", "cous-cous", "orzo"],
    merenda: ["muffin", "pancake", "frullato", "yogurt", "biscotti", "ciambelline", "barrette", "budino", "banana-bread", "torta"],
    cena: ["polpette", "burger", "frittata", "vellutata", "cotoletta", "sformatino"],
  },
} as const;

const AUTOS_LUNCH_ALLOWED_CARBS = ["pasta", "riso", "quinoa", "cous cous", "orzo"];
const AUTOS_LUNCH_FORBIDDEN_TERMS = ["burger", "polpett", "cotolett", "frittat", "sformat"];

function buildVariationSeed(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("|");
}

function isInvalidAutosvezzamentoLunch(meal: DailyMenuSchema["meals"][number]) {
  const text = mealToText(meal);
  const hasAllowedCarb = AUTOS_LUNCH_ALLOWED_CARBS.some((term) => containsTermInText(text, term));
  const hasDinnerStyleShape = AUTOS_LUNCH_FORBIDDEN_TERMS.some((term) => containsTermInText(text, term));

  return !hasAllowedCarb || hasDinnerStyleShape;
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickSeededValue<T>(values: T[], seed: string) {
  if (values.length === 0) {
    throw new Error("Nessuna opzione disponibile per la selezione del menu.");
  }

  return values[hashSeed(seed) % values.length];
}

function buildBalancedPlateLabels(policy: MenuPolicyContext, carb: string, protein: string, vegetable: string) {
  return buildBalancedPlateForPolicy(policy, carb, protein, vegetable);
}

function getCatalogRecipes(style: "classico" | "autosvezzamento", mealType: MealType) {
  return [...chatRecipeCatalog[style][mealType]];
}

function recipeToSearchText(recipe: ChatRecipe) {
  return [
    recipe.family,
    recipe.dishName,
    ...recipe.ingredients,
    recipe.preparation,
    ...recipe.notes,
    ...recipe.safetyNotes,
    ...recipe.substitutions,
    recipe.meta.fruit ?? "",
    recipe.meta.carb ?? "",
    recipe.meta.protein ?? "",
    recipe.meta.vegetable ?? "",
  ].join(" ");
}

function recipeContainsAnyTerm(recipe: ChatRecipe, terms: string[]) {
  return terms.some((term) => term && containsTermInText(recipeToSearchText(recipe), term));
}

function findCatalogRecipeForMeal(meal: DailyMenuSchema["meals"][number]) {
  const mealSignature = getMealSignature(meal);

  for (const style of ["classico", "autosvezzamento"] as const) {
    for (const recipe of getCatalogRecipes(style, meal.mealType)) {
      const recipeSignature = `${meal.mealType}:${normalizeFreeText(recipe.dishName)}:${[...recipe.ingredients]
        .map((value) => normalizeFreeText(value))
        .sort()
        .join(",")}`;

      if (recipeSignature === mealSignature) {
        return recipe;
      }
    }
  }

  const normalizedDishName = normalizeFreeText(meal.dishName);
  for (const style of ["classico", "autosvezzamento"] as const) {
    const matchedByName = getCatalogRecipes(style, meal.mealType).find(
      (recipe) => normalizeFreeText(recipe.dishName) === normalizedDishName,
    );

    if (matchedByName) {
      return matchedByName;
    }
  }

  return null;
}

function areMealsTooSimilar(
  firstMeal: DailyMenuSchema["meals"][number],
  secondMeal: DailyMenuSchema["meals"][number],
) {
  const repeatedTerms = extractRepeatedMealTerms(firstMeal, secondMeal);
  const sameSignature = getMealSignature(firstMeal) === getMealSignature(secondMeal);
  const firstRecipe = findCatalogRecipeForMeal(firstMeal);
  const secondRecipe = findCatalogRecipeForMeal(secondMeal);
  const sameFamily = Boolean(firstRecipe?.family && secondRecipe?.family && firstRecipe.family === secondRecipe.family);

  return {
    repeatedTerms,
    sameSignature,
    sameFamily,
    tooSimilar: sameSignature || sameFamily || repeatedTerms.length > 0,
  };
}

function rebuildMealUntilDistinct(params: {
  mealType: MealType;
  referenceMeal: DailyMenuSchema["meals"][number];
  policy: MenuPolicyContext;
  variationSeed?: string;
  baseAvoidTerms: string[];
}) {
  let avoidTerms = dedupeValues(params.baseAvoidTerms);
  let candidate = buildAlternativeMeal({
    mealType: params.mealType,
    policy: params.policy,
    softAvoidTerms: avoidTerms,
    variationSeed: buildVariationSeed(params.variationSeed, params.mealType, "distinct-initial"),
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const comparison = areMealsTooSimilar(params.referenceMeal, candidate);
    if (!comparison.tooSimilar) {
      return {
        meal: candidate,
        avoidTerms,
      };
    }

    avoidTerms = dedupeValues([
      ...avoidTerms,
      ...extractMealAvoidTerms(candidate),
      ...(comparison.sameFamily ? [findCatalogRecipeForMeal(candidate)?.family ?? ""] : []),
    ]);

    candidate = buildAlternativeMeal({
      mealType: params.mealType,
      policy: params.policy,
      softAvoidTerms: avoidTerms,
      variationSeed: buildVariationSeed(params.variationSeed, params.mealType, "distinct", String(attempt), avoidTerms.join(",")),
    });
  }

  return {
    meal: candidate,
    avoidTerms,
  };
}

function extractMealAvoidTerms(meal: DailyMenuSchema["meals"][number]) {
  const keywords = getVarietyKeywords().filter((keyword) => containsTermInText(mealToText(meal), keyword));
  return dedupeValues([meal.dishName, ...meal.ingredients, ...keywords].filter(Boolean));
}

function selectRecipeFromCatalog(params: {
  style: "classico" | "autosvezzamento";
  mealType: MealType;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  disallowedProteinGroups?: ProteinGroup[];
  preferredFamilies?: string[];
  requireNonPastaCarb?: boolean;
}) {
  const allowedFamilies = RECIPE_FAMILY_ALLOWLIST[params.style][params.mealType] as readonly string[];
  const allRecipes = getCatalogRecipes(params.style, params.mealType).filter((recipe) => allowedFamilies.includes(recipe.family));
  const familyFilteredRecipes = allRecipes.filter((recipe) => !(params.excludeFamilies ?? []).includes(recipe.family));
  const preferredRecipes =
    params.preferredFamilies && params.preferredFamilies.length > 0
      ? familyFilteredRecipes.filter((recipe) => params.preferredFamilies?.includes(recipe.family))
      : familyFilteredRecipes;

  const applyRecipeFilters = (
    recipes: ChatRecipe[],
    options?: {
      ignoreExcludedTerms?: boolean;
      ignoreDisallowedGroups?: boolean;
    },
  ) => {
    return recipes.filter((recipe) => {
      if (recipeContainsAnyTerm(recipe, params.forbiddenTerms)) {
        return false;
      }

      if (params.requireNonPastaCarb && containsTermInText(recipe.meta.carb ?? "", "pasta")) {
        return false;
      }

      if (!options?.ignoreDisallowedGroups && recipe.meta.proteinGroup && params.disallowedProteinGroups?.includes(recipe.meta.proteinGroup)) {
        return false;
      }

      if (!options?.ignoreExcludedTerms && recipeContainsAnyTerm(recipe, params.excludeTerms ?? [])) {
        return false;
      }

      return true;
    });
  };

  const candidatePools = [
    applyRecipeFilters(preferredRecipes),
    applyRecipeFilters(familyFilteredRecipes),
    applyRecipeFilters(preferredRecipes, { ignoreExcludedTerms: true }),
    applyRecipeFilters(familyFilteredRecipes, { ignoreExcludedTerms: true }),
    applyRecipeFilters(familyFilteredRecipes, { ignoreExcludedTerms: true, ignoreDisallowedGroups: true }),
    applyRecipeFilters(allRecipes, { ignoreExcludedTerms: true, ignoreDisallowedGroups: true }),
    allRecipes.filter((recipe) => !recipeContainsAnyTerm(recipe, params.forbiddenTerms)),
  ];

  const selectedPool = candidatePools.find((pool) => pool.length > 0);
  if (selectedPool && selectedPool.length > 0) {
    return pickSeededValue(selectedPool, params.seed);
  }

  if (allRecipes.length === 0) {
    throw new Error(`Catalogo ricette non configurato correttamente per ${params.style} / ${params.mealType}.`);
  }

  throw new Error(
    `Con le esclusioni attuali non ci sono ricette compatibili per ${params.mealType}. Riduci le esclusioni nel profilo bambino o nella richiesta.`,
  );
}

function buildMealFromRecipe(recipe: ChatRecipe, policy: MenuPolicyContext): BuiltMealResult {
  return {
    meal: {
      mealType: recipe.mealType,
      dishName: recipe.dishName,
      ingredients: recipe.ingredients,
      preparation: recipe.preparation,
      notes: recipe.notes.slice(0, 5),
      safetyNotes: recipe.safetyNotes.slice(0, 5),
      substitutions: recipe.substitutions.slice(0, 4),
      balancedPlate:
        recipe.mealType === "pranzo" || recipe.mealType === "cena"
          ? buildBalancedPlateLabels(policy, recipe.meta.carb ?? "carboidrato", recipe.meta.protein ?? "proteina", recipe.meta.vegetable ?? "verdura")
          : undefined,
    },
    meta: {
      family: recipe.family,
      fruit: recipe.meta.fruit,
      carb: recipe.meta.carb,
      protein: recipe.meta.protein,
      vegetable: recipe.meta.vegetable,
      proteinGroup: recipe.meta.proteinGroup,
    },
  };
}

function buildClassicSweetMeal(params: {
  mealType: "colazione" | "merenda";
  policy: MenuPolicyContext;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  preferredFamilies?: string[];
}): BuiltMealResult {
  return buildMealFromRecipe(
    selectRecipeFromCatalog({
      style: "classico",
      mealType: params.mealType,
      seed: buildVariationSeed(params.seed, params.mealType),
      forbiddenTerms: params.forbiddenTerms,
      excludeFamilies: params.excludeFamilies,
      excludeTerms: params.excludeTerms,
      preferredFamilies: params.preferredFamilies,
    }),
    params.policy,
  );
}

function buildAutosvezzamentoSweetMeal(params: {
  mealType: "colazione" | "merenda";
  policy: MenuPolicyContext;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  preferredFamilies?: string[];
}): BuiltMealResult {
  return buildMealFromRecipe(
    selectRecipeFromCatalog({
      style: "autosvezzamento",
      mealType: params.mealType,
      seed: buildVariationSeed(params.seed, params.mealType),
      forbiddenTerms: params.forbiddenTerms,
      excludeFamilies: params.excludeFamilies,
      excludeTerms: params.excludeTerms,
      preferredFamilies: params.preferredFamilies,
    }),
    params.policy,
  );
}

function buildClassicoMainMeal(params: {
  mealType: "pranzo" | "cena";
  policy: MenuPolicyContext;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  disallowedProteinGroups?: ProteinGroup[];
  preferredFamilies?: string[];
  requireNonPastaCarb?: boolean;
}): BuiltMealResult {
  return buildMealFromRecipe(
    selectRecipeFromCatalog({
      style: "classico",
      mealType: params.mealType,
      seed: buildVariationSeed(params.seed, params.mealType),
      forbiddenTerms: params.forbiddenTerms,
      excludeFamilies: params.excludeFamilies,
      excludeTerms: params.excludeTerms,
      disallowedProteinGroups: params.disallowedProteinGroups,
      preferredFamilies: params.preferredFamilies,
      requireNonPastaCarb: params.requireNonPastaCarb,
    }),
    params.policy,
  );
}

function buildAutosvezzamentoLunchMeal(params: {
  policy: MenuPolicyContext;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  disallowedProteinGroups?: ProteinGroup[];
  preferredFamilies?: string[];
}): BuiltMealResult {
  return buildMealFromRecipe(
    selectRecipeFromCatalog({
      style: "autosvezzamento",
      mealType: "pranzo",
      seed: buildVariationSeed(params.seed, "pranzo"),
      forbiddenTerms: params.forbiddenTerms,
      excludeFamilies: params.excludeFamilies,
      excludeTerms: params.excludeTerms,
      disallowedProteinGroups: params.disallowedProteinGroups,
      preferredFamilies: params.preferredFamilies,
    }),
    params.policy,
  );
}

function buildAutosvezzamentoDinnerMeal(params: {
  policy: MenuPolicyContext;
  seed: string;
  forbiddenTerms: string[];
  excludeFamilies?: string[];
  excludeTerms?: string[];
  disallowedProteinGroups?: ProteinGroup[];
  preferredFamilies?: string[];
}): BuiltMealResult {
  return buildMealFromRecipe(
    selectRecipeFromCatalog({
      style: "autosvezzamento",
      mealType: "cena",
      seed: buildVariationSeed(params.seed, "cena"),
      forbiddenTerms: params.forbiddenTerms,
      excludeFamilies: params.excludeFamilies,
      excludeTerms: params.excludeTerms,
      disallowedProteinGroups: params.disallowedProteinGroups,
      preferredFamilies: params.preferredFamilies,
    }),
    params.policy,
  );
}

function buildFallbackMenuCandidate(params: {
  childProfileSummary: DailyMenuSchema["childProfileSummary"];
  policy: MenuPolicyContext;
  seed: string;
}): DailyMenuSchema {
  const forbiddenTerms = params.policy.forbiddenTerms;
  const style = params.policy.feedingStyle;
  const title = "Menu giornaliero bilanciato";

  let breakfast: BuiltMealResult;
  let lunch: BuiltMealResult;
  let snack: BuiltMealResult;
  let dinner: BuiltMealResult;

  if (style === "classico") {
    breakfast = buildClassicSweetMeal({
      mealType: "colazione",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "classico", "colazione"),
      forbiddenTerms,
    });
    lunch = buildClassicoMainMeal({
      mealType: "pranzo",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "classico", "pranzo"),
      forbiddenTerms,
    });
    snack = buildClassicSweetMeal({
      mealType: "merenda",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "classico", "merenda"),
      forbiddenTerms,
      excludeFamilies: [breakfast.meta.family],
      excludeTerms: [breakfast.meta.fruit ?? ""],
    });
    dinner = buildClassicoMainMeal({
      mealType: "cena",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "classico", "cena"),
      forbiddenTerms,
      excludeFamilies: [lunch.meta.family],
      excludeTerms: [lunch.meta.carb ?? "", lunch.meta.protein ?? "", lunch.meta.vegetable ?? ""],
      disallowedProteinGroups: lunch.meta.proteinGroup ? [lunch.meta.proteinGroup] : [],
      requireNonPastaCarb: true,
    });
  } else if (style === "autosvezzamento") {
    breakfast = buildAutosvezzamentoSweetMeal({
      mealType: "colazione",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "auto", "colazione"),
      forbiddenTerms,
    });
    lunch = buildAutosvezzamentoLunchMeal({
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "auto", "pranzo"),
      forbiddenTerms,
    });
    snack = buildAutosvezzamentoSweetMeal({
      mealType: "merenda",
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "auto", "merenda"),
      forbiddenTerms,
      excludeFamilies: [breakfast.meta.family],
      excludeTerms: [breakfast.meta.fruit ?? ""],
    });
    dinner = buildAutosvezzamentoDinnerMeal({
      policy: params.policy,
      seed: buildVariationSeed(params.seed, "auto", "cena"),
      forbiddenTerms,
      excludeFamilies: [lunch.meta.family],
      excludeTerms: [lunch.meta.carb ?? "", lunch.meta.protein ?? "", lunch.meta.vegetable ?? ""],
      disallowedProteinGroups: lunch.meta.proteinGroup ? [lunch.meta.proteinGroup] : [],
    });
  } else {
    const mistoPattern = pickSeededValue(["classico-auto", "auto-classico", "alternato"], buildVariationSeed(params.seed, "misto-pattern"));

    if (mistoPattern === "auto-classico") {
      breakfast = buildAutosvezzamentoSweetMeal({
        mealType: "colazione",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "colazione"),
        forbiddenTerms,
      });
      lunch = buildClassicoMainMeal({
        mealType: "pranzo",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "pranzo"),
        forbiddenTerms,
      });
      snack = buildClassicSweetMeal({
        mealType: "merenda",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "merenda"),
        forbiddenTerms,
        excludeTerms: [breakfast.meta.fruit ?? ""],
      });
      dinner = buildAutosvezzamentoDinnerMeal({
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "cena"),
        forbiddenTerms,
        excludeTerms: [lunch.meta.carb ?? "", lunch.meta.protein ?? "", lunch.meta.vegetable ?? ""],
        disallowedProteinGroups: lunch.meta.proteinGroup ? [lunch.meta.proteinGroup] : [],
      });
    } else if (mistoPattern === "alternato") {
      breakfast = buildClassicSweetMeal({
        mealType: "colazione",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "colazione"),
        forbiddenTerms,
      });
      lunch = buildAutosvezzamentoLunchMeal({
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "pranzo"),
        forbiddenTerms,
      });
      snack = buildAutosvezzamentoSweetMeal({
        mealType: "merenda",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "merenda"),
        forbiddenTerms,
        excludeFamilies: [breakfast.meta.family],
        excludeTerms: [breakfast.meta.fruit ?? ""],
      });
      dinner = buildClassicoMainMeal({
        mealType: "cena",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "cena"),
        forbiddenTerms,
        excludeTerms: [lunch.meta.carb ?? "", lunch.meta.protein ?? "", lunch.meta.vegetable ?? ""],
        disallowedProteinGroups: lunch.meta.proteinGroup ? [lunch.meta.proteinGroup] : [],
      });
    } else {
      breakfast = buildClassicSweetMeal({
        mealType: "colazione",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "colazione"),
        forbiddenTerms,
      });
      lunch = buildClassicoMainMeal({
        mealType: "pranzo",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "pranzo"),
        forbiddenTerms,
      });
      snack = buildAutosvezzamentoSweetMeal({
        mealType: "merenda",
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "merenda"),
        forbiddenTerms,
        excludeTerms: [breakfast.meta.fruit ?? ""],
      });
      dinner = buildAutosvezzamentoDinnerMeal({
        policy: params.policy,
        seed: buildVariationSeed(params.seed, "misto", "cena"),
        forbiddenTerms,
        excludeTerms: [lunch.meta.carb ?? "", lunch.meta.protein ?? "", lunch.meta.vegetable ?? ""],
        disallowedProteinGroups: lunch.meta.proteinGroup ? [lunch.meta.proteinGroup] : [],
      });
    }
  }

  return {
    title,
    childProfileSummary: params.childProfileSummary,
    meals: [breakfast.meal, lunch.meal, snack.meal, dinner.meal],
    dailyNotes: ["Offri acqua durante tutta la giornata e continua a variare frutta, verdure, cereali e proteine nella settimana."],
    warnings: ["In caso di dubbi clinici confrontati con il pediatra."],
    shoppingList: dedupeValues([breakfast, lunch, snack, dinner].flatMap((item) => item.meal.ingredients)),
  };
}

function buildAlternativeMeal(params: {
  mealType: MealType;
  policy: MenuPolicyContext;
  requestedDish?: string;
  explicitAvoidTerms?: string[];
  softAvoidTerms?: string[];
  variationSeed?: string;
}): DailyMenuSchema["meals"][number] {
  const forbiddenTerms = mergeForbiddenTerms(params.policy.forbiddenTerms, params.explicitAvoidTerms);
  const softAvoidTerms = dedupeValues(params.softAvoidTerms ?? []);
  const requestedDish = params.requestedDish ? cleanPromptTerm(params.requestedDish) : undefined;
  const requestedDishMode = getRequestedDishMode(requestedDish);
  const baseSeed = buildVariationSeed(
    params.variationSeed,
    params.mealType,
    requestedDish,
    forbiddenTerms.join(","),
    softAvoidTerms.join(","),
  );

  if (params.mealType === "colazione" || params.mealType === "merenda") {
    const useAutos =
      params.policy.feedingStyle === "autosvezzamento" ||
      (params.policy.feedingStyle === "misto" && requestedDishMode === "pancake");
    const preferredFamilies =
      requestedDishMode === "porridge"
        ? ["porridge"]
        : requestedDishMode === "yogurt"
          ? ["yogurt"]
          : requestedDishMode === "pancake"
            ? ["pancake"]
            : [];

    const built = useAutos
      ? buildAutosvezzamentoSweetMeal({
          mealType: params.mealType,
          policy: params.policy,
          seed: baseSeed,
          forbiddenTerms,
          excludeTerms: softAvoidTerms,
          preferredFamilies,
        })
      : buildClassicSweetMeal({
          mealType: params.mealType,
          policy: params.policy,
          seed: baseSeed,
          forbiddenTerms,
          excludeTerms: softAvoidTerms,
          preferredFamilies,
        });

    return built.meal;
  }

  if (params.mealType === "pranzo") {
    if (requestedDishMode === "pasta" || params.policy.feedingStyle === "autosvezzamento") {
      return buildAutosvezzamentoLunchMeal({
        policy: params.policy,
        seed: baseSeed,
        forbiddenTerms,
        excludeTerms: softAvoidTerms,
        preferredFamilies: requestedDishMode === "pasta" ? ["pasta"] : requestedDishMode === "riso" ? ["riso"] : [],
      }).meal;
    }

    return buildClassicoMainMeal({
      mealType: "pranzo",
      policy: params.policy,
      seed: baseSeed,
      forbiddenTerms,
      excludeTerms: softAvoidTerms,
      preferredFamilies:
        requestedDishMode === "pastina"
          ? ["pastina"]
          : requestedDishMode === "riso"
            ? ["riso"]
            : [],
    }).meal;
  }

  const useAutosDinner =
    params.policy.feedingStyle === "autosvezzamento" ||
    (params.policy.feedingStyle === "misto" && !["vellutata", "crema", "pappa", "pastina", "riso"].includes(requestedDishMode));

  if (useAutosDinner) {
    const preferredFamilies =
      requestedDishMode === "burger"
        ? ["burger"]
        : requestedDishMode === "polpette"
          ? ["polpette"]
          : requestedDishMode === "vellutata" || requestedDishMode === "crema"
            ? ["vellutata"]
            : [];

    return buildAutosvezzamentoDinnerMeal({
      policy: params.policy,
      seed: baseSeed,
      forbiddenTerms,
      excludeTerms: softAvoidTerms,
      preferredFamilies,
    }).meal;
  }

  return buildClassicoMainMeal({
    mealType: "cena",
    policy: params.policy,
    seed: baseSeed,
    forbiddenTerms,
    excludeTerms: softAvoidTerms,
    preferredFamilies:
      requestedDishMode === "vellutata"
        ? ["vellutata"]
        : requestedDishMode === "crema"
          ? ["crema"]
          : requestedDishMode === "pappa"
            ? ["passato"]
            : [],
    requireNonPastaCarb: true,
  }).meal;
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

function sanitizeMenuAgainstForbiddenTerms(
  menu: DailyMenuSchema,
  policy: MenuPolicyContext,
  variationSeed?: string,
): DailyMenuSchema {
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
      variationSeed: buildVariationSeed(variationSeed, meal.mealType, matchedForbiddenTerms.join(",")),
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

function sanitizeAutosvezzamentoLunch(
  menu: DailyMenuSchema,
  policy: MenuPolicyContext,
  variationSeed?: string,
): DailyMenuSchema {
  if (policy.feedingStyle !== "autosvezzamento") {
    return menu;
  }

  const lunchIndex = menu.meals.findIndex((meal) => meal.mealType === "pranzo");
  if (lunchIndex === -1) {
    return menu;
  }

  const lunch = menu.meals[lunchIndex];
  if (!isInvalidAutosvezzamentoLunch(lunch)) {
    return menu;
  }

  const rebuiltLunch = buildAutosvezzamentoLunchMeal({
    policy,
    seed: buildVariationSeed(variationSeed, "autos-lunch-sanitize"),
    forbiddenTerms: policy.forbiddenTerms,
    excludeTerms: extractMealAvoidTerms(lunch),
  }).meal;

  const meals = [...menu.meals];
  meals[lunchIndex] = rebuiltLunch;

  return {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues([
      ...menu.warnings,
      "Pranzo autosvezzamento corretto automaticamente: usa sempre un primo o un piatto a base di cereale con proteina e verdura.",
    ]),
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

function enforceDailyMealVariety(
  menu: DailyMenuSchema,
  policy: MenuPolicyContext,
  variationSeed?: string,
): DailyMenuSchema {
  const meals = [...menu.meals];
  const warnings = [...menu.warnings];

  const breakfastIndex = meals.findIndex((meal) => meal.mealType === "colazione");
  const snackIndex = meals.findIndex((meal) => meal.mealType === "merenda");
  if (breakfastIndex !== -1 && snackIndex !== -1) {
    const comparison = areMealsTooSimilar(meals[breakfastIndex], meals[snackIndex]);
    if (comparison.tooSimilar) {
      const result = rebuildMealUntilDistinct({
        mealType: "merenda",
        referenceMeal: meals[breakfastIndex],
        policy,
        variationSeed: buildVariationSeed(variationSeed, "merenda", comparison.repeatedTerms.join(",")),
        baseAvoidTerms: dedupeValues([...comparison.repeatedTerms, ...extractMealAvoidTerms(meals[breakfastIndex])]),
      });
      meals[snackIndex] = result.meal;
      warnings.push(
        `Merenda variata automaticamente per evitare ripetizioni con la colazione (${result.avoidTerms.slice(0, 4).join(", ")}).`,
      );
    }
  }

  const lunchIndex = meals.findIndex((meal) => meal.mealType === "pranzo");
  const dinnerIndex = meals.findIndex((meal) => meal.mealType === "cena");
  if (lunchIndex !== -1 && dinnerIndex !== -1) {
    const comparison = areMealsTooSimilar(meals[lunchIndex], meals[dinnerIndex]);
    if (comparison.tooSimilar) {
      const result = rebuildMealUntilDistinct({
        mealType: "cena",
        referenceMeal: meals[lunchIndex],
        policy,
        variationSeed: buildVariationSeed(variationSeed, "cena", comparison.repeatedTerms.join(",")),
        baseAvoidTerms: dedupeValues([...comparison.repeatedTerms, ...extractMealAvoidTerms(meals[lunchIndex])]),
      });
      meals[dinnerIndex] = result.meal;
      warnings.push(
        `Cena variata automaticamente per evitare ripetizioni con il pranzo (${result.avoidTerms.slice(0, 4).join(", ")}).`,
      );
    }
  }

  return {
    ...menu,
    meals,
    shoppingList: dedupeValues(meals.flatMap((meal) => meal.ingredients)),
    warnings: dedupeValues(warnings),
  };
}

function enforceSessionVarietyAgainstPreviousMenu(
  menu: DailyMenuSchema,
  previousMenu: DailyMenuSchema | undefined,
  policy: MenuPolicyContext,
  variationSeed?: string,
): DailyMenuSchema {
  if (!previousMenu) {
    return menu;
  }

  const meals = [...menu.meals];
  const warnings = [...menu.warnings];

  for (const mealType of MEAL_TYPES) {
    const currentIndex = meals.findIndex((meal) => meal.mealType === mealType);
    const previousMeal = previousMenu.meals.find((meal) => meal.mealType === mealType);

    if (currentIndex === -1 || !previousMeal) {
      continue;
    }

    if (getMealSignature(meals[currentIndex]) !== getMealSignature(previousMeal)) {
      continue;
    }

    const avoidTerms = extractMealAvoidTerms(previousMeal);
    meals[currentIndex] = buildAlternativeMeal({
      mealType,
      policy,
      softAvoidTerms: avoidTerms,
      variationSeed: buildVariationSeed(variationSeed, mealType, "previous-session", avoidTerms.join(",")),
    });
    warnings.push(`Il pasto ${mealType} è stato variato automaticamente rispetto al menu precedente.`);
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
  variationSeed?: string,
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
        variationSeed: buildVariationSeed(variationSeed, mealChange.mealType, "requested"),
      });
      warnings.push(`Pasto ${mealChange.mealType} aggiornato con richiesta: ${mealChange.requestedDish}.`);
    }

    if (previousMeal && getMealSignature(meals[index]) === getMealSignature(previousMeal)) {
      meals[index] = buildAlternativeMeal({
        mealType: mealChange.mealType,
        policy,
        requestedDish: mealChange.requestedDish,
        explicitAvoidTerms: policy.forbiddenTerms,
        variationSeed: buildVariationSeed(variationSeed, mealChange.mealType, "previous"),
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
        variationSeed: buildVariationSeed(variationSeed, meal.mealType, avoidTerm),
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
        variationSeed: buildVariationSeed(variationSeed, targetMeal, "variation"),
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

  return enforceDailyMealVariety(
    enforceSessionVarietyAgainstPreviousMenu(
      sanitizeAutosvezzamentoLunch(
        sanitizeMenuAgainstForbiddenTerms(adjustedMenu, policy, variationSeed),
        policy,
        variationSeed,
      ),
      previousMenu,
      policy,
      variationSeed,
    ),
    policy,
    variationSeed,
  );
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
    variationSeed?: string;
  },
): DailyMenuSchema {
  const issues = options?.issues ?? [];
  const warnings = ["In caso di dubbi clinici confrontati con il pediatra."];
  if (policy.ageStage === "under_6") {
    warnings.push("Prima dei 6 mesi il latte resta centrale: valuta con il pediatra quando iniziare lo svezzamento.");
  }
  if (issues.length > 0) {
    warnings.push("Menu rigenerato con fallback strutturato per rispettare tutte le regole della piattaforma.");
  }
  if (options?.isModification) {
    warnings.push("Menu aggiornato in base alla tua richiesta di modifica.");
  }

  const baseSeed = options?.variationSeed ?? buildVariationSeed(policy.feedingStyle, String(policy.ageMonths ?? "na"), options?.isModification ? "mod" : "new");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = buildFallbackMenuCandidate({
      childProfileSummary,
      policy,
      seed: buildVariationSeed(baseSeed, `attempt-${attempt}`),
    });

    const candidateWithWarnings = {
      ...candidate,
      warnings: dedupeValues([...candidate.warnings, ...warnings]),
    };

    if (!options?.previousMenu || !isSameMenuAsPrevious(candidateWithWarnings, options.previousMenu)) {
      return applyForcedAdjustments(
        candidateWithWarnings,
        policy,
        options?.forcedAdjustments ?? { replacements: [], avoidTerms: [], mealChanges: [], requiresVariation: false },
        options?.previousMenu,
        buildVariationSeed(baseSeed, `attempt-${attempt}`),
      );
    }
  }

  return applyForcedAdjustments(
    {
      ...buildFallbackMenuCandidate({
        childProfileSummary,
        policy,
        seed: buildVariationSeed(baseSeed, "final"),
      }),
      warnings: dedupeValues(warnings),
    },
    policy,
    options?.forcedAdjustments ?? { replacements: [], avoidTerms: [], mealChanges: [], requiresVariation: false },
    options?.previousMenu,
    buildVariationSeed(baseSeed, "final"),
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
  variationSeed: string;
}) {
  const baseMenu: DailyMenuSchema = {
    ...params.previousMenu,
    title: "Menu giornaliero aggiornato",
    childProfileSummary: params.childProfileSummary,
  };

  return applyForcedAdjustments(baseMenu, params.policy, params.forcedAdjustments, params.previousMenu, params.variationSeed);
}

async function generateDailyMenuWithOpenAI(params: {
  systemPrompt: string;
  childProfileSummary: DailyMenuSchema["childProfileSummary"];
  userPrompt: string;
  policy: MenuPolicyContext;
  previousMenu?: DailyMenuSchema;
  isModification?: boolean;
  forcedAdjustments: ForcedMenuAdjustments;
  variationSeed: string;
}) {
  if (params.previousMenu && hasExplicitModificationIntent(params.forcedAdjustments)) {
    const deterministicMenu = buildDeterministicModifiedMenu({
      previousMenu: params.previousMenu,
      childProfileSummary: params.childProfileSummary,
      policy: params.policy,
      forcedAdjustments: params.forcedAdjustments,
      variationSeed: buildVariationSeed(params.variationSeed, "deterministic"),
    });

    const deterministicIssues: string[] = [];
    if (!hasCompleteMeals(deterministicMenu)) {
      deterministicIssues.push("Il menu deve includere esattamente colazione, pranzo, merenda e cena.");
    }

    deterministicIssues.push(...evaluateForcedAdjustments(deterministicMenu, params.previousMenu, params.forcedAdjustments));

    if (!isSameMenuAsPrevious(deterministicMenu, params.previousMenu) && deterministicIssues.length === 0) {
      return deterministicMenu;
    }

    const deterministicValidation = validateDailyMenu(deterministicMenu, params.policy);
    const blockingIssues = deterministicValidation.issues.filter((issue) => issue.includes("vietato/escluso"));

    if (!isSameMenuAsPrevious(deterministicMenu, params.previousMenu) && blockingIssues.length === 0) {
      return deterministicMenu;
    }
  }

  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return fallbackMenu(params.childProfileSummary, params.policy, {
      previousMenu: params.previousMenu,
      isModification: params.isModification,
      forcedAdjustments: params.forcedAdjustments,
      variationSeed: params.variationSeed,
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
      const adjustedMenu = applyForcedAdjustments(
        parsed,
        params.policy,
        params.forcedAdjustments,
        params.previousMenu,
        buildVariationSeed(params.variationSeed, `openai-attempt-${attempt}`),
      );
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
    variationSeed: buildVariationSeed(params.variationSeed, "fallback"),
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
    .limit(MENU_SESSION_MAX_DAILY);

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

  await ensureSessionBelongsToUser({
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
  let previousMenuForGeneration: DailyMenuSchema | undefined;

  if (params.sourceSessionId) {
    await ensureSessionBelongsToUser({
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
  if (!sessionId && params.sourceSessionId) {
    sessionId = params.sourceSessionId;
  }

  if (sessionId) {
    await ensureSessionBelongsToUser({
      admin,
      userId: params.userId,
      sessionId,
      dayStartIso,
    });
  } else {
    await enforceDailySessionLimit({
      admin,
      userId: params.userId,
      dayStartIso,
    });

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

  if (previousMenuForModification) {
    previousMenuForGeneration = previousMenuForModification;
  } else {
    previousMenuForGeneration =
      (await getLatestAssistantMenuForUser({
      admin,
      userId: params.userId,
      dayStartIso,
      excludeSessionId: sessionId,
      })) ?? undefined;
  }

  const variationSeed = buildVariationSeed(
    sessionId,
    params.prompt,
    previousMenuForGeneration ? menuSignature(previousMenuForGeneration) : undefined,
  );

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
    previousMenu: previousMenuForGeneration,
    isModification: Boolean(params.sourceSessionId),
    forcedAdjustments,
    variationSeed,
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
