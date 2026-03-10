import { businessRulesConfig } from "@/config/business-rules";
import type { DailyMenuSchema } from "@/server/chat/menu-schema";
import type { MenuPolicyContext } from "@/server/chat/rules-engine";

interface MenuValidationResult {
  isValid: boolean;
  issues: string[];
}

const MAIN_MEALS = new Set(["pranzo", "cena"]);
const SOFT_TEXTURE_TERMS = ["crema", "vellutata", "morbid", "schiacciat", "frullat", "pappa"];
const SMALL_PIECES_TERMS = ["piccoli pezzi", "pezzi piccoli", "morbid", "schiacciat", "tritat"];
const CLASSICO_TERMS = ["crema", "vellutata", "pappa", "schiacciat"];
const AUTOSVEZZAMENTO_TERMS = ["bastonc", "polpett", "finger", "frittat", "pancake", "pasta corta", "tagli sicuri"];

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

  if (policy.ageStage === "8_10" && !includesAny(mainMealsText, SMALL_PIECES_TERMS)) {
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

  if (policy.feedingStyle === "classico" && !includesAny(mainMealsText, CLASSICO_TERMS)) {
    issues.push("Nello svezzamento classico devono comparire consistenze progressive (crema/vellutata/pappa).");
  }

  if (policy.feedingStyle === "autosvezzamento" && !includesAny(mainMealsText, AUTOSVEZZAMENTO_TERMS)) {
    issues.push("Nell'autosvezzamento servono pezzi/finger food e tagli sicuri espliciti.");
  }

  if (policy.feedingStyle === "misto") {
    const hasClassico = includesAny(mainMealsText, CLASSICO_TERMS);
    const hasAuto = includesAny(mainMealsText, AUTOSVEZZAMENTO_TERMS);
    if (!hasClassico || !hasAuto) {
      issues.push("Nello svezzamento misto combina elementi classici e autosvezzamento.");
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

export function validateDailyMenu(menu: DailyMenuSchema, policy: MenuPolicyContext): MenuValidationResult {
  const issues: string[] = [];

  validateChildProfileSummary(menu, policy, issues);
  validateForbiddenTerms(menu, policy, issues);
  validateBalancedMeals(menu, issues);
  validateBalancedPlatePayload(menu, policy, issues);
  validateAgeConsistency(menu, policy, issues);
  validateFeedingStyle(menu, policy, issues);
  validateSafeCuts(menu, issues);
  validateVariety(menu, issues);

  return {
    isValid: issues.length === 0,
    issues,
  };
}
