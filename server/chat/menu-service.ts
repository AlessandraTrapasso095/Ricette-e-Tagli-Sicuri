import "server-only";

import OpenAI from "openai";
import { subDays } from "date-fns";

import { MAX_DAILY_MENU_MODIFICATIONS, MENU_SESSION_RESET_TIMEZONE } from "@/config/chat-session";
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

function buildModificationPrompt(params: { userPrompt: string; previousMenu: DailyMenuSchema }) {
  const previousMeals = params.previousMenu.meals
    .map((meal) => `${meal.mealType}: ${meal.dishName} (${meal.ingredients.join(", ")})`)
    .join(" | ");

  return [
    "Modifica il menu precedente rispettando tutte le regole obbligatorie della piattaforma.",
    `Menu precedente: ${previousMeals}`,
    `Richiesta di modifica del genitore: ${params.userPrompt}`,
    "Mantieni struttura giornaliera completa (colazione, pranzo, merenda, cena), bilanciamento e sicurezza.",
  ].join("\n");
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

function menuSignature(menu: DailyMenuSchema) {
  return menu.meals
    .map((meal) => {
      const ingredients = [...meal.ingredients].map((value) => normalizeFreeText(value)).sort().join(",");
      return `${meal.mealType}:${normalizeFreeText(meal.dishName)}:${ingredients}`;
    })
    .sort()
    .join("|");
}

function isSameMenuAsPrevious(currentMenu: DailyMenuSchema, previousMenu: DailyMenuSchema) {
  return menuSignature(currentMenu) === menuSignature(previousMenu);
}

async function getTodaySessionCount(admin: AdminClient, userId: string, dayStartIso: string) {
  const { count, error } = await admin
    .from("menu_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false)
    .gte("created_at", dayStartIso);

  if (error) {
    throw new Error("Impossibile verificare il limite modifiche giornaliere.");
  }

  return count ?? 0;
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

  return {
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
}

function buildRetryPrompt(userPrompt: string, issues: string[]) {
  return [
    userPrompt,
    "",
    "Correggi il menu rispettando TUTTE le regole obbligatorie. Violazioni da risolvere:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

async function generateDailyMenuWithOpenAI(params: {
  systemPrompt: string;
  childProfileSummary: DailyMenuSchema["childProfileSummary"];
  userPrompt: string;
  policy: MenuPolicyContext;
  previousMenu?: DailyMenuSchema;
  isModification?: boolean;
}) {
  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return fallbackMenu(params.childProfileSummary, params.policy, {
      previousMenu: params.previousMenu,
      isModification: params.isModification,
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
      const issues: string[] = [];

      if (!hasCompleteMeals(parsed)) {
        issues.push("Il menu deve includere esattamente colazione, pranzo, merenda e cena.");
      }

      const validation = validateDailyMenu(parsed, params.policy);
      if (!validation.isValid) {
        issues.push(...validation.issues);
      }
      if (params.previousMenu && isSameMenuAsPrevious(parsed, params.previousMenu)) {
        issues.push("Il menu è troppo simile al precedente: cambia ingredienti principali e almeno due piatti.");
      }

      if (issues.length === 0) {
        return parsed;
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

  if (params.sessionId && params.sourceSessionId) {
    throw new Error("Richiesta non valida: usa sessionId oppure sourceSessionId.");
  }

  const child = await getPrimaryChildProfile(params.userId);
  const policy = buildMenuPolicyContext(child, params.prompt);
  const childProfileSummary = buildChildProfileSummary(child, policy);
  const childSummaryForPrompt = buildChildProfilePromptSummary(child, policy);
  const proteinRotationHint = await getProteinRotationHintForUser(params.userId);
  let promptForModel = params.prompt;
  let previousMenuForModification: DailyMenuSchema | undefined;

  if (params.sourceSessionId) {
    const todaySessionCount = await getTodaySessionCount(admin, params.userId, dayStartIso);
    const todayModificationCount = Math.max(0, todaySessionCount - 1);
    if (todayModificationCount >= MAX_DAILY_MENU_MODIFICATIONS) {
      throw new Error("Hai raggiunto il limite massimo di 3 modifiche menu per oggi. Da mezzanotte potrai modificarlo di nuovo.");
    }

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
