import type { MealType } from "@/config/business-rules";

export type FeedingStyle = "classico" | "autosvezzamento" | "misto";

export type BookUnlockResult = "failed" | "success" | "cooldown" | "revoked";

export interface Book {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  challenge_max_attempts: number;
  challenge_cooldown_minutes: number;
  is_active: boolean;
}

export interface UnlockedBook extends Book {
  unlocked_at: string;
  status: "active" | "revoked";
}

export interface ChildProfile {
  id: string;
  user_id: string;
  name: string;
  age_mode: "birth_date" | "months";
  birth_date: string | null;
  age_months: number | null;
  feeding_style: FeedingStyle;
  allergies: string[];
  foods_to_avoid: string[];
  foods_introduced: string[];
  notes: string | null;
  is_primary: boolean;
}

export interface DailyMenuMeal {
  mealType: MealType;
  dishName: string;
  ingredients: string[];
  preparation: string;
  notes: string[];
  safetyNotes: string[];
  substitutions: string[];
  balancedPlate?: {
    carbs: string;
    proteins: string;
    vegetables: string;
    healthyFats: string;
  } | null;
}

export interface DailyMenuChildProfileSummary {
  ageMonths: number | null;
  weaningType: FeedingStyle | "non_specificato";
  notes: string[];
}

export interface DailyMenu {
  title: string;
  childProfileSummary: DailyMenuChildProfileSummary;
  meals: DailyMenuMeal[];
  dailyNotes: string[];
  warnings: string[];
  shoppingList: string[];
}
