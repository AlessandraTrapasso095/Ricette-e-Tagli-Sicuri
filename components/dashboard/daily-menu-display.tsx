import { cn } from "@/lib/utils";
import type { DailyMenu } from "@/types/domain";

const mealLabels: Record<DailyMenu["meals"][number]["mealType"], string> = {
  colazione: "Colazione",
  pranzo: "Pranzo",
  merenda: "Merenda",
  cena: "Cena",
};

interface DailyMenuDisplayProps {
  menu: DailyMenu;
  className?: string;
}

export function DailyMenuDisplay({ menu, className }: DailyMenuDisplayProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        {menu.meals.map((meal) => (
          <div key={`${meal.mealType}-${meal.dishName}`} className="rounded-2xl border border-rose-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{mealLabels[meal.mealType]}</p>
            <h4 className="font-semibold text-zinc-800">{meal.dishName}</h4>

            <div className="mt-3">
              <p className="text-sm font-medium text-zinc-800">Ingredienti</p>
              <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                {meal.ingredients.map((ingredient, index) => (
                  <li key={`${meal.mealType}-${meal.dishName}-ingredient-${index}`} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                    <span>{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-800">Preparazione</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{meal.preparation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
