import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Inserisci una email valida."),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
});

export const registerSchema = z
  .object({
    email: z.email("Inserisci una email valida."),
    password: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
    confirmPassword: z.string().min(8, "Conferma la password."),
    fullName: z.string().min(2, "Inserisci nome e cognome."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono.",
    path: ["confirmPassword"],
  });

export const unlockBookSchema = z.object({
  challengeId: z.string().uuid("Challenge non valida."),
  answer: z.string().min(1, "Inserisci la risposta.").max(120, "Risposta troppo lunga."),
});

export const childProfileSchema = z
  .object({
    name: z.string().min(2, "Inserisci il nome del bambino."),
    ageMode: z.enum(["birth_date", "months"]),
    birthDate: z.string().optional(),
    ageMonths: z.number().int().min(0).max(120).optional(),
    feedingStyle: z.enum(["classico", "autosvezzamento", "misto"]),
    allergies: z.string().optional(),
    foodsToAvoid: z.string().optional(),
    foodsIntroduced: z.string().optional(),
    notes: z.string().max(2000, "Note troppo lunghe.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.ageMode === "birth_date" && !data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "Inserisci la data di nascita.",
      });
    }

    if (data.ageMode === "months" && data.ageMonths === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ageMonths"],
        message: "Inserisci l'età in mesi.",
      });
    }
  });

export const supportTicketSchema = z.object({
  name: z.string().min(2, "Inserisci il nome."),
  email: z.email("Inserisci una email valida."),
  category: z.enum(["accesso", "bonus", "chat_menu", "tecnico", "altro"]),
  bookSlug: z.string().optional(),
  message: z.string().min(10, "Messaggio troppo breve.").max(4000, "Messaggio troppo lungo."),
});

export const chatPromptSchema = z.object({
  sessionId: z.preprocess((value) => (value === null ? undefined : value), z.string().uuid().optional()),
  sourceSessionId: z.preprocess((value) => (value === null ? undefined : value), z.string().uuid().optional()),
  prompt: z.string().min(2, "Scrivi una richiesta più chiara.").max(1200, "Messaggio troppo lungo."),
  saveMenu: z.boolean().optional().default(false),
});

export const adminChallengeSchema = z.object({
  bookId: z.string().uuid("Libro non valido."),
  pageNumber: z.number().int().positive(),
  promptText: z.string().min(5, "Prompt troppo breve.").max(220),
  acceptedAnswer: z.string().min(1, "Risposta richiesta.").max(120),
  isActive: z.boolean(),
});

export const adminBookSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Usa solo minuscole, numeri e trattini."),
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  challengeMaxAttempts: z.number().int().min(1).max(20),
  challengeCooldownMinutes: z.number().int().min(1).max(1440),
  isActive: z.boolean(),
});

export const adminBookCreateSchema = z.object({
  title: z.string().min(3, "Titolo troppo breve.").max(120, "Titolo troppo lungo."),
  subtitle: z.string().max(300, "Sottotitolo troppo lungo.").optional(),
  link: z.string().url("Inserisci un link valido.").optional().or(z.literal("")),
});

export const adminBookUpdateSchema = z.object({
  bookId: z.string().uuid("Libro non valido."),
  title: z.string().min(3, "Titolo troppo breve.").max(120, "Titolo troppo lungo."),
  subtitle: z.string().max(300, "Sottotitolo troppo lungo.").optional(),
  link: z.string().url("Inserisci un link valido.").optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const adminBookDeleteSchema = z.object({
  bookId: z.string().uuid("Libro non valido."),
});

export const adminBonusSchema = z.object({
  id: z.string().uuid("Bonus non valido.").optional(),
  bookId: z.string().uuid("Libro non valido."),
  title: z.string().min(3, "Titolo troppo breve.").max(140, "Titolo troppo lungo."),
  description: z.string().max(2000, "Descrizione troppo lunga.").optional(),
  storageBucket: z.string().min(2).max(120).default("bonus-files"),
  storagePath: z
    .string()
    .min(5, "Percorso storage troppo breve.")
    .max(400, "Percorso storage troppo lungo.")
    .regex(/^[a-z0-9/_\-.]+$/i, "Usa solo lettere, numeri, trattini, underscore e slash."),
  mimeType: z.string().min(5).max(120).default("application/pdf"),
  isActive: z.boolean(),
});

export const adminBonusStatusSchema = z.object({
  bonusId: z.string().uuid("Bonus non valido."),
  isActive: z.boolean(),
});

export const adminBonusDeleteSchema = z.object({
  bonusId: z.string().uuid("Bonus non valido."),
});

export const adminBookAccessSchema = z.object({
  targetUserId: z.string().uuid("Utente non valido."),
  bookId: z.string().uuid("Libro non valido."),
  reason: z.string().max(300, "Nota troppo lunga.").optional(),
});

export const adminUserSuspendSchema = z.object({
  userId: z.string().uuid("Utente non valido."),
  duration: z.enum(["1h", "24h", "168h", "permanent", "none"]),
});

export const adminBroadcastSchema = z.object({
  subject: z.string().min(3, "Oggetto troppo breve.").max(160, "Oggetto troppo lungo."),
  message: z.string().min(10, "Messaggio troppo breve.").max(12000, "Messaggio troppo lungo."),
});

export const adminReaderSettingsSchema = z.object({
  readerDisplayName: z.string().min(2, "Inserisci almeno 2 caratteri.").max(80, "Nome troppo lungo."),
});

export const accountProfileSettingsSchema = z.object({
  fullName: z.string().min(2, "Inserisci nome e cognome.").max(120, "Nome troppo lungo."),
  displayName: z.string().min(2, "Inserisci almeno 2 caratteri.").max(60, "Nome utente troppo lungo."),
});

export const supportTicketStatusSchema = z.enum(["inviato", "in_lavorazione", "risolto", "chiuso"]);
export const supportTicketCategorySchema = z.enum(["accesso", "bonus", "chat_menu", "tecnico", "altro"]);

export const adminSupportTicketFiltersSchema = z.object({
  status: z.enum(["all", "inviato", "in_lavorazione", "risolto", "chiuso"]).default("all"),
  category: z.enum(["all", "accesso", "bonus", "chat_menu", "tecnico", "altro"]).default("all"),
  q: z.string().max(120).optional(),
});

export const adminSupportTicketUpdateSchema = z.object({
  ticketId: z.string().uuid("Ticket non valido."),
  status: supportTicketStatusSchema,
  adminNotes: z.string().max(4000, "Note admin troppo lunghe.").optional(),
  replyMessage: z.string().max(4000, "Risposta troppo lunga.").optional(),
  notifyUser: z.boolean().optional().default(false),
});
