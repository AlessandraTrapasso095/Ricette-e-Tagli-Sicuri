import type { DailyMenuSchema } from "@/server/chat/menu-schema";

type ChatSecurityAction =
  | "chat_prompt_blocked"
  | "chat_prompt_escalated"
  | "chat_prompt_flagged"
  | "chat_output_redacted"
  | "chat_output_fallback";

interface ChatSecurityReview {
  decision: "allow" | "block" | "escalate";
  reason: string | null;
  matchedRules: string[];
}

interface MenuSanitizationResult {
  menu: DailyMenuSchema;
  matchedRules: string[];
  redactedFields: string[];
}

const INPUT_RULES = [
  {
    id: "prompt_injection",
    regex:
      /\b(ignore|ignora|bypass|override|rivela|mostra|stampa)\b.{0,40}\b(istruzioni|instruction|system prompt|prompt di sistema|policy|regole)\b/i,
  },
  {
    id: "secret_request",
    regex:
      /\b(api key|chiave api|token|password|service role|secret|segreto|variabili ambiente|environment variables|env|supabase|sql|database|filesystem|file di configurazione|source code|codice sorgente)\b/i,
  },
  {
    id: "script_or_injection",
    regex: /<script|javascript:|onerror=|union\s+select|drop\s+table|insert\s+into|delete\s+from|curl\s+|wget\s+/i,
  },
  {
    id: "external_contact_or_link",
    regex: /https?:\/\/|www\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  },
  {
    id: "encoded_payload",
    regex: /(?:[A-Za-z0-9+/]{80,}={0,2})/,
  },
] as const;

const ESCALATION_RULES = [
  {
    id: "medical_emergency",
    regex:
      /\b(soffoca|soffocamento|non respira|difficolt[aà]\s+respiratoria|anafilassi|shock|pronto soccorso|118|emergenza|reazione allergica grave)\b/i,
    reason:
      "Per sintomi, emergenze o possibili reazioni allergiche non usare la chat menu. Contatta subito il pediatra, il pronto soccorso o il 118.",
  },
  {
    id: "clinical_advice",
    regex:
      /\b(farmaco|medicina|dosaggio|febbre alta|vomito continuo|diarrea persistente|convulsioni|saturazione|antibiotico)\b/i,
    reason:
      "Per dubbi clinici o sanitari non usare la chat menu. Contatta il pediatra o un professionista sanitario.",
  },
] as const;

const OUTPUT_PATTERNS = [
  {
    id: "email",
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    id: "url",
    regex: /https?:\/\/\S+|www\.\S+/gi,
  },
  {
    id: "api_key",
    regex: /\b(?:sk-[A-Za-z0-9_-]{12,}|re_[A-Za-z0-9_-]{12,}|vck_[A-Za-z0-9_-]{12,}|sbp_[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z\-_]{20,})\b/g,
  },
  {
    id: "iban",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  },
  {
    id: "codice_fiscale",
    regex: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi,
  },
] as const;

function normalizePrompt(prompt: string) {
  return prompt.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function sanitizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function redactSensitiveContent(text: string) {
  let current = text;
  const matchedRules = new Set<string>();

  for (const pattern of OUTPUT_PATTERNS) {
    const next = current.replace(pattern.regex, "[dato rimosso]");
    if (next !== current) {
      matchedRules.add(pattern.id);
      current = next;
    }
  }

  return {
    value: sanitizeText(current),
    matchedRules: [...matchedRules],
  };
}

function sanitizeStringField(value: string, fieldPath: string, matchedRules: Set<string>, redactedFields: Set<string>) {
  const sanitized = redactSensitiveContent(value);

  if (sanitized.matchedRules.length > 0) {
    sanitized.matchedRules.forEach((rule) => matchedRules.add(rule));
    redactedFields.add(fieldPath);
  }

  return sanitized.value;
}

export function evaluateChatPromptSecurity(prompt: string): ChatSecurityReview {
  const normalized = normalizePrompt(prompt);
  const escalationMatch = ESCALATION_RULES.find((rule) => rule.regex.test(normalized));

  if (escalationMatch) {
    return {
      decision: "escalate",
      reason: escalationMatch.reason,
      matchedRules: [escalationMatch.id],
    };
  }

  const matchedRules = INPUT_RULES.filter((rule) => rule.regex.test(normalized)).map((rule) => rule.id);

  if (matchedRules.length === 0) {
    return {
      decision: "allow",
      reason: null,
      matchedRules: [],
    };
  }

  return {
    decision: "block",
    reason:
      "La chat menu accetta solo richieste sul menu del bambino. Non inviare link, credenziali, istruzioni tecniche o richieste fuori ambito.",
    matchedRules,
  };
}

export function sanitizeGeneratedMenuOutput(menu: DailyMenuSchema): MenuSanitizationResult {
  const matchedRules = new Set<string>();
  const redactedFields = new Set<string>();

  const sanitizedMenu: DailyMenuSchema = {
    ...menu,
    title: sanitizeStringField(menu.title, "title", matchedRules, redactedFields),
    childProfileSummary: {
      ...menu.childProfileSummary,
      notes: menu.childProfileSummary.notes.map((note, index) =>
        sanitizeStringField(note, `childProfileSummary.notes[${index}]`, matchedRules, redactedFields),
      ),
    },
    meals: menu.meals.map((meal, mealIndex) => ({
      ...meal,
      dishName: sanitizeStringField(meal.dishName, `meals[${mealIndex}].dishName`, matchedRules, redactedFields),
      ingredients: meal.ingredients.map((ingredient, ingredientIndex) =>
        sanitizeStringField(
          ingredient,
          `meals[${mealIndex}].ingredients[${ingredientIndex}]`,
          matchedRules,
          redactedFields,
        ),
      ),
      preparation: sanitizeStringField(meal.preparation, `meals[${mealIndex}].preparation`, matchedRules, redactedFields),
      notes: meal.notes.map((note, noteIndex) =>
        sanitizeStringField(note, `meals[${mealIndex}].notes[${noteIndex}]`, matchedRules, redactedFields),
      ),
      safetyNotes: meal.safetyNotes.map((note, noteIndex) =>
        sanitizeStringField(note, `meals[${mealIndex}].safetyNotes[${noteIndex}]`, matchedRules, redactedFields),
      ),
      substitutions: meal.substitutions.map((substitution, substitutionIndex) =>
        sanitizeStringField(
          substitution,
          `meals[${mealIndex}].substitutions[${substitutionIndex}]`,
          matchedRules,
          redactedFields,
        ),
      ),
      balancedPlate: meal.balancedPlate
        ? {
            carbs: sanitizeStringField(meal.balancedPlate.carbs, `meals[${mealIndex}].balancedPlate.carbs`, matchedRules, redactedFields),
            proteins: sanitizeStringField(
              meal.balancedPlate.proteins,
              `meals[${mealIndex}].balancedPlate.proteins`,
              matchedRules,
              redactedFields,
            ),
            vegetables: sanitizeStringField(
              meal.balancedPlate.vegetables,
              `meals[${mealIndex}].balancedPlate.vegetables`,
              matchedRules,
              redactedFields,
            ),
            healthyFats: sanitizeStringField(
              meal.balancedPlate.healthyFats,
              `meals[${mealIndex}].balancedPlate.healthyFats`,
              matchedRules,
              redactedFields,
            ),
          }
        : meal.balancedPlate,
    })),
    dailyNotes: menu.dailyNotes.map((note, index) =>
      sanitizeStringField(note, `dailyNotes[${index}]`, matchedRules, redactedFields),
    ),
    warnings: menu.warnings.map((warning, index) =>
      sanitizeStringField(warning, `warnings[${index}]`, matchedRules, redactedFields),
    ),
    shoppingList: menu.shoppingList.map((item, index) =>
      sanitizeStringField(item, `shoppingList[${index}]`, matchedRules, redactedFields),
    ),
  };

  return {
    menu: sanitizedMenu,
    matchedRules: [...matchedRules],
    redactedFields: [...redactedFields],
  };
}

export async function logChatSecurityEvent(params: {
  userId: string;
  action: ChatSecurityAction;
  details: Record<string, unknown>;
}) {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();

    await admin.from("audit_logs").insert({
      actor_user_id: params.userId,
      entity: "chat_menu",
      action: params.action,
      details: params.details,
    });
  } catch {
    // Intentionally ignore logging failures to avoid breaking the chat flow.
  }
}
