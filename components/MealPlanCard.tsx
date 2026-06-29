"use client";

import { Filter } from "lucide-react";
import { formatShortDate } from "@/lib/date";
import type { MealPlanItem } from "@/types";

type Props = {
  mealPlan: MealPlanItem[];
  timeZone: string;
};

export default function MealPlanCard({ mealPlan, timeZone }: Props) {
  return (
    <article className="mini-card">
      <div className="panel-header compact">
        <h2>Meal Plan</h2>
        <Filter className="icon" />
      </div>
      {mealPlan.map((meal) => (
        <div key={meal.id} className="meal-row">
          <strong>{meal.title}</strong>
          <p>
            {meal.meal} · {formatShortDate(new Date(meal.date), timeZone)}
          </p>
        </div>
      ))}
    </article>
  );
}
