import { z } from "zod";

export const mealTypeSchema = z.enum(["colazione", "pranzo", "merenda", "cena"]);

export const balancedPlateSchema = z.object({
  carbs: z.string().min(2),
  proteins: z.string().min(2),
  vegetables: z.string().min(2),
  healthyFats: z.string().min(2),
});

export const childProfileSummarySchema = z.object({
  ageMonths: z.number().int().min(0).max(120).nullable(),
  weaningType: z.enum(["classico", "autosvezzamento", "misto", "non_specificato"]),
  notes: z.array(z.string().min(2)).max(12),
});

export const dailyMenuSchema = z.object({
  title: z.string().min(3),
  childProfileSummary: childProfileSummarySchema,
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
        balancedPlate: balancedPlateSchema.nullable().optional(),
      }),
    )
    .min(4)
    .max(4)
    .superRefine((meals, ctx) => {
      const requiredMealTypes = ["colazione", "pranzo", "merenda", "cena"] as const;
      const typeCounts = new Map<string, number>();

      for (const meal of meals) {
        typeCounts.set(meal.mealType, (typeCounts.get(meal.mealType) ?? 0) + 1);
      }

      for (const mealType of requiredMealTypes) {
        if ((typeCounts.get(mealType) ?? 0) !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Il menu deve contenere una sola voce per ${mealType}.`,
            path: [],
          });
        }
      }
    }),
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
    childProfileSummary: {
      type: "object",
      additionalProperties: false,
      required: ["ageMonths", "weaningType", "notes"],
      properties: {
        ageMonths: { type: ["number", "null"] },
        weaningType: { type: "string", enum: ["classico", "autosvezzamento", "misto", "non_specificato"] },
        notes: { type: "array", items: { type: "string" } },
      },
    },
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
          balancedPlate: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["carbs", "proteins", "vegetables", "healthyFats"],
                properties: {
                  carbs: { type: "string" },
                  proteins: { type: "string" },
                  vegetables: { type: "string" },
                  healthyFats: { type: "string" },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
    dailyNotes: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    shoppingList: { type: "array", items: { type: "string" } },
  },
} as const;
