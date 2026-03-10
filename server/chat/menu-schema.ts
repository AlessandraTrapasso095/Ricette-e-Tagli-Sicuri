import { z } from "zod";

export const mealTypeSchema = z.enum(["colazione", "pranzo", "merenda", "cena"]);

export const dailyMenuSchema = z.object({
  title: z.string().min(3),
  childProfileSummary: z.string().min(10),
  meals: z
    .array(
      z.object({
        mealType: mealTypeSchema,
        dishName: z.string().min(3),
        ingredients: z.array(z.string().min(1)).min(1),
        preparation: z.string().min(10),
        notes: z.array(z.string().min(2)).max(5),
        safetyNotes: z.array(z.string().min(2)).max(5),
        substitutions: z.array(z.string().min(2)).max(4),
      }),
    )
    .min(4)
    .max(4),
  dailyNotes: z.array(z.string().min(2)).max(8),
  warnings: z.array(z.string().min(2)).max(5),
  shoppingList: z.array(z.string().min(2)).max(30),
});

export type DailyMenuSchema = z.infer<typeof dailyMenuSchema>;

export const dailyMenuJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "childProfileSummary", "meals", "dailyNotes", "warnings", "shoppingList"],
  properties: {
    title: { type: "string" },
    childProfileSummary: { type: "string" },
    meals: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "mealType",
          "dishName",
          "ingredients",
          "preparation",
          "notes",
          "safetyNotes",
          "substitutions",
        ],
        properties: {
          mealType: { type: "string", enum: ["colazione", "pranzo", "merenda", "cena"] },
          dishName: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          preparation: { type: "string" },
          notes: { type: "array", items: { type: "string" } },
          safetyNotes: { type: "array", items: { type: "string" } },
          substitutions: { type: "array", items: { type: "string" } },
        },
      },
    },
    dailyNotes: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    shoppingList: { type: "array", items: { type: "string" } },
  },
} as const;
