import "server-only";

import OpenAI from "openai";

import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { dailyMenuJsonSchema, dailyMenuSchema, type DailyMenuSchema } from "@/server/chat/menu-schema";
import { buildChildProfileSummary, buildMenuSystemPrompt, hasCompleteMeals } from "@/server/chat/rules-engine";

const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

interface SavedMenuRow {
  id: string;
  title: string;
  menu_payload: unknown;
  created_at: string;
}

function menuToMessageText(menu: DailyMenuSchema) {
  const mealList = menu.meals
    .map((meal) => `- ${meal.mealType.toUpperCase()}: ${meal.dishName}`)
    .join("\n");

  return `${menu.title}\n\n${mealList}`;
}

function fallbackMenu(childSummary: string): DailyMenuSchema {
  return {
    title: "Menu giornaliero bilanciato",
    childProfileSummary: childSummary,
    meals: [
      {
        mealType: "colazione",
        dishName: "Porridge morbido mela e avena",
        ingredients: ["Fiocchi di avena", "Latte o bevanda vegetale adatta", "Mela grattugiata"],
        preparation: "Cuoci avena e latte a fuoco dolce, aggiungi mela e servi tiepido.",
        notes: ["Consistenza cremosa."],
        safetyNotes: ["Controlla temperatura prima di servire."],
        substitutions: ["Pera al posto della mela."],
      },
      {
        mealType: "pranzo",
        dishName: "Pasta piccola con crema di zucchine e ricotta",
        ingredients: ["Pasta formato piccolo", "Zucchine", "Ricotta vaccina"],
        preparation: "Cuoci la pasta, frulla zucchine cotte e unisci ricotta.",
        notes: ["Aggiungi olio EVO a crudo."],
        safetyNotes: ["Taglia eventuali pezzi grandi."],
        substitutions: ["Formaggio fresco spalmabile al posto della ricotta."],
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
        dishName: "Polpette morbide di lenticchie e patata",
        ingredients: ["Lenticchie già cotte", "Patata lessa", "Pan grattato q.b."],
        preparation: "Frulla, forma polpette morbide e cuoci in forno 15 minuti.",
        notes: ["Servi con contorno di verdure morbide."],
        safetyNotes: ["Controlla che la polpetta sia facilmente schiacciabile."],
        substitutions: ["Ceci al posto delle lenticchie."],
      },
    ],
    dailyNotes: ["Offri acqua durante tutta la giornata."],
    warnings: ["In caso di dubbi clinici confrontati con il pediatra."],
    shoppingList: [
      "Fiocchi di avena",
      "Mela",
      "Pasta piccola",
      "Zucchine",
      "Ricotta",
      "Yogurt bianco",
      "Banana",
      "Lenticchie",
      "Patata",
    ],
  };
}

async function generateDailyMenuWithOpenAI(systemPrompt: string, childSummary: string) {
  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return fallbackMenu(childSummary);
  }

  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: getEnv("OPENAI_MODEL") ?? DEFAULT_CHAT_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
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

  const outputText = response.output_text;
  const parsed = dailyMenuSchema.parse(JSON.parse(outputText));

  if (!hasCompleteMeals(parsed)) {
    throw new Error("Il modello non ha prodotto tutti i pasti richiesti.");
  }

  return parsed;
}

export async function getMenuSessions(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("menu_sessions")
    .select("id, title, last_message_at, created_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSessionMessages(userId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();

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
  saveMenu?: boolean;
}) {
  const admin = createSupabaseAdminClient();

  const child = await getPrimaryChildProfile(params.userId);
  const childSummary = buildChildProfileSummary(child);

  let sessionId = params.sessionId;
  if (sessionId) {
    const { data: session } = await admin
      .from("menu_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (!session) {
      throw new Error("Sessione chat non valida.");
    }
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
    childSummary,
    userPrompt: params.prompt,
  });

  const menu = await generateDailyMenuWithOpenAI(systemPrompt, childSummary);
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
