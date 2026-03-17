import { businessRulesConfig } from "@/config/business-rules";
import type { DailyMenuSchema } from "@/server/chat/menu-schema";
import type { MenuPolicyContext } from "@/server/chat/rules-engine";

interface MenuValidationResult {
  isValid: boolean;
  issues: string[];
}

const MAIN_MEALS = new Set(["pranzo", "cena"]);
const SOFT_TEXTURE_TERMS = ["crema", "vellutata", "morbid", "schiacciat", "frullat", "pappa", "purea", "passat"];
const SMALL_PIECES_TERMS = ["piccoli pezzi", "pezzi piccoli", "morbid", "schiacciat", "tritat"];
const CLASSICO_ALLOWED_TERMS = ["crema", "vellutata", "pappa", "schiacciat", "purea", "passat", "pastina", "baby riso", "porridge", "yogurt", "frullat"];
const CLASSICO_FORBIDDEN_TERMS = ["polpett", "burger", "pancake", "finger", "bastonc", "pane", "tort", "pezz", "formato grande", "frittat"];
const AUTOSVEZZAMENTO_TERMS = ["bastonc", "polpett", "finger", "frittat", "pancake", "pasta corta", "tagli sicuri", "burger", "pane", "tort", "porridge"];
const AUTOS_LUNCH_ALLOWED_CARBS = ["pasta", "riso", "quinoa", "cous cous", "orzo"];
const AUTOS_LUNCH_FORBIDDEN_TERMS = ["burger", "polpett", "cotolett", "frittat", "sformat"];
const INGREDIENT_QUANTITY_PATTERN =
  /\b(\d+(?:[.,]\d+)?\s?(?:g|gr|grammi|ml|cucchiaini?|cucchiai|vasetto|vasetti|fette?|pezzi?|pz)|1\/2|mezzo|mezza|q\.b\.|qb|un cucchiaino|una fetta|uno yogurt|una banana)\b/i;
const BROAD_KEYWORDS_TO_IGNORE = new Set(["carne", "pesce", "uovo", "uova", "legumi", "verdure", "frutta", "cereali"]);
const ADULT_SERVING_TERMS = ["per 2", "per due", "per 3", "per 4", "per tutta la famiglia", "porzione abbondante", "piatto abbondante"];

function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: readonly string[]) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function isForbiddenMention(content: string, forbiddenTerm: string) {
  const text = normalizeText(content);
  const term = normalizeText(forbiddenTerm);
  if (!text.includes(term)) {
    return false;
  }

  return !text.includes(`senza ${term}`) && !text.includes(`no ${term}`);
}

function buildCriticalMealText(menu: DailyMenuSchema) {
  return menu.meals
    .map((meal) => `${meal.dishName} ${meal.ingredients.join(" ")} ${meal.preparation}`)
    .join(" ");
}

function mealCategoryPresence(meal: DailyMenuSchema["meals"][number]) {
  const ingredientsText = normalizeText(meal.ingredients.join(" "));

  return {
    hasCarb: businessRulesConfig.ingredientGroups.carbs.some((item) => ingredientsText.includes(normalizeText(item))),
    hasProtein: businessRulesConfig.ingredientGroups.proteins.some((item) =>
      ingredientsText.includes(normalizeText(item)),
    ),
    hasVegetable: businessRulesConfig.ingredientGroups.vegetables.some((item) =>
      ingredientsText.includes(normalizeText(item)),
    ),
    hasHealthyFat: includesAny(
      `${meal.ingredients.join(" ")} ${meal.preparation} ${meal.notes.join(" ")} ${meal.safetyNotes.join(" ")}`,
      businessRulesConfig.ingredientGroups.healthyFats,
    ),
  };
}

function validateBalancedMeals(menu: DailyMenuSchema, issues: string[]) {
  for (const meal of menu.meals) {
    if (!MAIN_MEALS.has(meal.mealType)) {
      continue;
    }

    const categories = mealCategoryPresence(meal);
    if (!categories.hasCarb) {
      issues.push(`${meal.mealType}: manca una fonte chiara di carboidrati.`);
    }
    if (!categories.hasProtein) {
      issues.push(`${meal.mealType}: manca una fonte chiara di proteine.`);
    }
    if (!categories.hasVegetable) {
      issues.push(`${meal.mealType}: manca una fonte chiara di verdure.`);
    }
    if (!categories.hasHealthyFat) {
      issues.push(`${meal.mealType}: manca indicazione di olio EVO a crudo.`);
    }
  }
}

function validateBalancedPlatePayload(menu: DailyMenuSchema, policy: MenuPolicyContext, issues: string[]) {
  const expected =
    policy.ageMonths !== null && policy.ageMonths >= 24
      ? {
          carbsRatio: "1/4",
          proteinsRatio: "1/4",
          vegetablesRatio: "2/4",
          healthyFatHint: "olio",
        }
      : {
          carbsRatio: "2/4",
          proteinsRatio: "1/4",
          vegetablesRatio: "1/4",
          healthyFatHint: "olio",
        };

  for (const meal of menu.meals) {
    if (!MAIN_MEALS.has(meal.mealType)) {
      continue;
    }

    if (!meal.balancedPlate) {
      issues.push(`${meal.mealType}: manca il blocco balancedPlate.`);
      continue;
    }

    const carbs = normalizeText(meal.balancedPlate.carbs);
    const proteins = normalizeText(meal.balancedPlate.proteins);
    const vegetables = normalizeText(meal.balancedPlate.vegetables);
    const healthyFats = normalizeText(meal.balancedPlate.healthyFats);

    if (!carbs.includes(expected.carbsRatio)) {
      issues.push(`${meal.mealType}: balancedPlate.carbs deve indicare ${expected.carbsRatio}.`);
    }
    if (!proteins.includes(expected.proteinsRatio)) {
      issues.push(`${meal.mealType}: balancedPlate.proteins deve indicare ${expected.proteinsRatio}.`);
    }
    if (!vegetables.includes(expected.vegetablesRatio)) {
      issues.push(`${meal.mealType}: balancedPlate.vegetables deve indicare ${expected.vegetablesRatio}.`);
    }
    if (!healthyFats.includes(expected.healthyFatHint)) {
      issues.push(`${meal.mealType}: balancedPlate.healthyFats deve richiamare olio EVO a crudo.`);
    }
  }
}

function validateChildProfileSummary(menu: DailyMenuSchema, policy: MenuPolicyContext, issues: string[]) {
  if (policy.ageMonths !== null && menu.childProfileSummary.ageMonths !== policy.ageMonths) {
    issues.push("childProfileSummary.ageMonths non è coerente con il profilo bambino.");
  }

  const expectedWeaningType = policy.hasChildProfile ? policy.feedingStyle : "non_specificato";
  if (menu.childProfileSummary.weaningType !== expectedWeaningType) {
    issues.push("childProfileSummary.weaningType non è coerente con il profilo bambino.");
  }
}

function validateAgeConsistency(menu: DailyMenuSchema, policy: MenuPolicyContext, issues: string[]) {
  const mainMealsText = normalizeText(
    menu.meals
      .filter((meal) => MAIN_MEALS.has(meal.mealType))
      .map((meal) => `${meal.dishName} ${meal.preparation} ${meal.notes.join(" ")} ${meal.safetyNotes.join(" ")}`)
      .join(" "),
  );

  if (policy.ageStage === "under_6") {
    const warningsText = normalizeText(menu.warnings.join(" "));
    if (!warningsText.includes("latte")) {
      issues.push("Sotto i 6 mesi deve essere esplicitato che il latte resta centrale.");
    }
  }

  if (policy.ageStage === "6_8" && !includesAny(mainMealsText, SOFT_TEXTURE_TERMS)) {
    issues.push("Per 6-8 mesi servono consistenze molto morbide (creme/vellutate/schiacciato).");
  }

  if (policy.ageStage === "8_10" && policy.feedingStyle !== "classico" && !includesAny(mainMealsText, SMALL_PIECES_TERMS)) {
    issues.push("Per 8-10 mesi servono indicazioni su piccoli pezzi morbidi o consistenze equivalenti.");
  }
}

function validateFeedingStyle(menu: DailyMenuSchema, policy: MenuPolicyContext, issues: string[]) {
  const mainMealsText = normalizeText(
    menu.meals
      .filter((meal) => MAIN_MEALS.has(meal.mealType))
      .map((meal) => `${meal.dishName} ${meal.preparation} ${meal.notes.join(" ")} ${meal.safetyNotes.join(" ")}`)
      .join(" "),
  );

  if (policy.feedingStyle === "classico") {
    if (!includesAny(mainMealsText, CLASSICO_ALLOWED_TERMS)) {
      issues.push("Nello svezzamento classico devono comparire creme, puree, pastina, baby riso, porridge o consistenze frullate.");
    }

    if (includesAny(mainMealsText, CLASSICO_FORBIDDEN_TERMS)) {
      issues.push("Nello svezzamento classico non sono ammessi polpette, burger, pancake, finger food, pane, torte o pezzi.");
    }
  }

  if (policy.feedingStyle === "autosvezzamento" && !includesAny(mainMealsText, AUTOSVEZZAMENTO_TERMS)) {
    issues.push("Nell'autosvezzamento servono porridge, polpette, pancake, burger morbidi, pane o finger food nei tagli sicuri.");
  }

  if (policy.feedingStyle === "autosvezzamento") {
    const lunch = menu.meals.find((meal) => meal.mealType === "pranzo");
    if (lunch) {
      const lunchText = normalizeText(`${lunch.dishName} ${lunch.ingredients.join(" ")} ${lunch.preparation}`);
      const hasAllowedCarb = AUTOS_LUNCH_ALLOWED_CARBS.some((term) => lunchText.includes(normalizeText(term)));
      const hasForbiddenShape = AUTOS_LUNCH_FORBIDDEN_TERMS.some((term) => lunchText.includes(normalizeText(term)));

      if (!hasAllowedCarb || hasForbiddenShape) {
        issues.push(
          "Nell'autosvezzamento il pranzo deve essere un primo o un piatto a base di pasta, riso, quinoa, cous cous, orzo o cereali simili con proteina e verdura; burger, polpette, cotolette e frittate vanno a cena.",
        );
      }
    }
  }

  if (policy.feedingStyle === "misto") {
    const hasClassico = includesAny(mainMealsText, CLASSICO_ALLOWED_TERMS);
    const hasAuto = includesAny(mainMealsText, AUTOSVEZZAMENTO_TERMS);
    if (!hasClassico || !hasAuto) {
      issues.push("Nello svezzamento misto devi combinare davvero una proposta classica e una proposta da autosvezzamento.");
    }
  }
}

function validateIngredientQuantities(menu: DailyMenuSchema, issues: string[]) {
  for (const meal of menu.meals) {
    for (const ingredient of meal.ingredients) {
      if (!INGREDIENT_QUANTITY_PATTERN.test(ingredient)) {
        issues.push(`${meal.mealType}: ogni ingrediente deve includere un dosaggio o una misura concreta (${ingredient}).`);
      }
    }
  }
}

function validatePortionSizes(menu: DailyMenuSchema, issues: string[]) {
  const thresholds = businessRulesConfig.portionGuidance.maxThresholds;

  for (const meal of menu.meals) {
    const mealText = normalizeText(`${meal.dishName} ${meal.ingredients.join(" ")} ${meal.preparation} ${meal.notes.join(" ")}`);
    if (ADULT_SERVING_TERMS.some((term) => mealText.includes(normalizeText(term)))) {
      issues.push(`${meal.mealType}: il menu deve essere per 1 solo bambino, non per più persone.`);
    }

    for (const ingredient of meal.ingredients) {
      const normalizedIngredient = normalizeText(ingredient);
      const matches = [...normalizedIngredient.matchAll(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml|cucchiai?|cucchiaini?|fette?|pezzi?|pz)\b/g)];

      for (const match of matches) {
        const rawValue = match[1]?.replace(",", ".");
        const unit = match[2];
        const value = rawValue ? Number(rawValue) : Number.NaN;
        if (!Number.isFinite(value) || !unit) {
          continue;
        }

        if ((unit === "g" || unit === "gr" || unit === "grammi") && value > thresholds.grams) {
          issues.push(`${meal.mealType}: quantità troppo alta per 1 bambino (${ingredient}).`);
        }

        if (unit === "ml" && value > thresholds.milliliters) {
          issues.push(`${meal.mealType}: liquidi troppo abbondanti per 1 bambino (${ingredient}).`);
        }

        if ((unit === "cucchiai" || unit === "cucchiaio") && value > thresholds.tablespoons) {
          issues.push(`${meal.mealType}: troppi cucchiai per una porzione piccola (${ingredient}).`);
        }

        if ((unit === "cucchiaini" || unit === "cucchiaino") && value > thresholds.teaspoons) {
          issues.push(`${meal.mealType}: troppi cucchiaini per una porzione piccola (${ingredient}).`);
        }

        if ((unit === "fette" || unit === "fetta" || unit === "pezzi" || unit === "pezzo" || unit === "pz") && value > thresholds.pieces) {
          issues.push(`${meal.mealType}: porzione troppo grande per 1 bambino (${ingredient}).`);
        }
      }
    }
  }
}

function validateSafeCuts(menu: DailyMenuSchema, issues: string[]) {
  const fullText = normalizeText(
    menu.meals
      .map((meal) => `${meal.dishName} ${meal.ingredients.join(" ")} ${meal.safetyNotes.join(" ")}`)
      .join(" "),
  );
  const isSoftPreparation = includesAny(fullText, ["crema", "vellutata", "frullat", "schiacciat", "cott"]);

  const mentionsRoundFood = businessRulesConfig.forbidden.roundFoods.some((item) => fullText.includes(normalizeText(item)));
  if (mentionsRoundFood && !isSoftPreparation && !includesAny(fullText, ["quarti", "spicchi"])) {
    issues.push("Se usi alimenti tondi (es. uva/pomodorini) indica taglio in quarti o spicchi.");
  }

  const mentionsCylindrical = businessRulesConfig.forbidden.cylindricalFoods.some((item) =>
    fullText.includes(normalizeText(item)),
  );
  if (mentionsCylindrical && !isSoftPreparation && !includesAny(fullText, ["bastonc", "longitudinal"])) {
    issues.push("Se usi alimenti cilindrici (es. carote/zucchine) indica bastoncino o taglio longitudinale.");
  }

  const mentionsHardFood = businessRulesConfig.forbidden.hardFoods.some((item) => fullText.includes(normalizeText(item)));
  if (mentionsHardFood && !includesAny(fullText, ["cott", "grattugiat", "crema"])) {
    issues.push("I cibi duri devono essere cotti, grattugiati o ridotti in crema.");
  }
}

function validateForbiddenTerms(menu: DailyMenuSchema, policy: MenuPolicyContext, issues: string[]) {
  const criticalMealText = buildCriticalMealText(menu);

  for (const forbidden of policy.forbiddenTerms) {
    if (isForbiddenMention(criticalMealText, forbidden)) {
      issues.push(`Menu non valido: contiene o suggerisce un alimento vietato/escluso (${forbidden}).`);
    }
  }
}

function validateVariety(menu: DailyMenuSchema, issues: string[]) {
  const ingredients = menu.meals.flatMap((meal) => meal.ingredients.map((ingredient) => normalizeText(ingredient)));
  const uniqueCount = new Set(ingredients).size;

  if (uniqueCount < 8) {
    issues.push("Varietà insufficiente: aumenta la rotazione di ingredienti, cereali, proteine e verdure.");
  }
}

function getSpecificFoodKeywords() {
  return [
    ...businessRulesConfig.ingredientGroups.carbs,
    ...businessRulesConfig.ingredientGroups.proteins,
    ...businessRulesConfig.ingredientGroups.vegetables,
    ...businessRulesConfig.ingredientGroups.fruits,
    ...Object.values(businessRulesConfig.proteinCategoryKeywords).flat(),
  ]
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 1 && !BROAD_KEYWORDS_TO_IGNORE.has(item));
}

function extractRepeatedFoods(firstMeal: DailyMenuSchema["meals"][number], secondMeal: DailyMenuSchema["meals"][number]) {
  const keywords = getSpecificFoodKeywords();
  const firstText = normalizeText(`${firstMeal.dishName} ${firstMeal.ingredients.join(" ")} ${firstMeal.preparation}`);
  const secondText = normalizeText(`${secondMeal.dishName} ${secondMeal.ingredients.join(" ")} ${secondMeal.preparation}`);

  return keywords.filter((keyword) => firstText.includes(keyword) && secondText.includes(keyword));
}

function getMealSignature(meal: DailyMenuSchema["meals"][number]) {
  const ingredients = [...meal.ingredients].map((value) => normalizeText(value)).sort().join(",");
  return `${meal.mealType}:${normalizeText(meal.dishName)}:${ingredients}`;
}

function validateDailyRotation(menu: DailyMenuSchema, issues: string[]) {
  const breakfast = menu.meals.find((meal) => meal.mealType === "colazione");
  const snack = menu.meals.find((meal) => meal.mealType === "merenda");
  const lunch = menu.meals.find((meal) => meal.mealType === "pranzo");
  const dinner = menu.meals.find((meal) => meal.mealType === "cena");

  if (breakfast && snack) {
    const repeated = extractRepeatedFoods(breakfast, snack);
    if (repeated.length > 0 || getMealSignature(breakfast) === getMealSignature(snack)) {
      const detail = repeated.length > 0 ? ` (${[...new Set(repeated)].join(", ")})` : "";
      issues.push(`Colazione e merenda non devono ripetere gli stessi alimenti principali${detail}.`);
    }
  }

  if (lunch && dinner) {
    const repeated = extractRepeatedFoods(lunch, dinner);
    if (repeated.length > 0 || getMealSignature(lunch) === getMealSignature(dinner)) {
      const detail = repeated.length > 0 ? ` (${[...new Set(repeated)].join(", ")})` : "";
      issues.push(`Pranzo e cena non devono ripetere gli stessi alimenti principali${detail}.`);
    }
  }
}

export function validateDailyMenu(menu: DailyMenuSchema, policy: MenuPolicyContext): MenuValidationResult {
  const issues: string[] = [];

  validateChildProfileSummary(menu, policy, issues);
  validateForbiddenTerms(menu, policy, issues);
  validateBalancedMeals(menu, issues);
  validateBalancedPlatePayload(menu, policy, issues);
  validateAgeConsistency(menu, policy, issues);
  validateFeedingStyle(menu, policy, issues);
  validateSafeCuts(menu, issues);
  validateIngredientQuantities(menu, issues);
  validatePortionSizes(menu, issues);
  validateVariety(menu, issues);
  validateDailyRotation(menu, issues);

  return {
    isValid: issues.length === 0,
    issues,
  };
}
