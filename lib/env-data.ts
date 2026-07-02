import "server-only";

import type { Chore, FamilyMember, MealPlanItem, Weather } from "@/types";

function parseJsonEnv<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const defaultWeather: Weather = {
  location: process.env.NEXT_PUBLIC_HOME_LOCATION_LABEL ?? "Home",
  temperature: 0,
  high: 0,
  low: 0,
  condition: "Not configured",
  icon: "cloud-off",
  source: "api",
};

export function getEnvFamilyMembers(): FamilyMember[] {
  const members = parseJsonEnv<Partial<FamilyMember>[]>(
    process.env.FAMILY_MEMBERS_JSON,
    [],
  );

  const normalizedMembers: Array<FamilyMember | null> = members.map((member, index) => {
      const name = sanitizeString(member.name);
      if (!name) return null;

      const id = sanitizeString(member.id) || slugify(name) || `member-${index + 1}`;

      return {
        id,
        name,
        role: sanitizeString(member.role) || "Family member",
        initials: sanitizeString(member.initials) || initialsFor(name),
        color: sanitizeString(member.color) || "#64748b",
        avatarUrl: sanitizeString(member.avatarUrl) || undefined,
      } satisfies FamilyMember;
    });

  return normalizedMembers.filter((member): member is FamilyMember => Boolean(member));
}

export function getEnvChores(): Chore[] {
  const chores = parseJsonEnv<Partial<Chore>[]>(
    process.env.CHORES_JSON,
    [],
  );

  const normalizedChores: Array<Chore | null> = chores.map((chore, index) => {
      const title = sanitizeString(chore.title);
      if (!title) return null;

      return {
        id: sanitizeString(chore.id) || `chore-${index + 1}`,
        title,
        ownerId: sanitizeString(chore.ownerId) || undefined,
        done: Boolean(chore.done),
        dueDate: sanitizeString(chore.dueDate) || undefined,
      } satisfies Chore;
    });

  return normalizedChores.filter((chore): chore is Chore => Boolean(chore));
}

export function getEnvMealPlan(): MealPlanItem[] {
  const meals = parseJsonEnv<Partial<MealPlanItem>[]>(
    process.env.MEAL_PLAN_JSON,
    [],
  );

  const normalizedMeals: Array<MealPlanItem | null> = meals.map((meal, index) => {
      const title = sanitizeString(meal.title);
      const date = sanitizeString(meal.date);
      const mealType = sanitizeString(meal.meal);

      if (!title || !date) return null;
      if (mealType !== "breakfast" && mealType !== "lunch" && mealType !== "dinner") {
        return null;
      }

      return {
        id: sanitizeString(meal.id) || `meal-${index + 1}`,
        title,
        date,
        meal: mealType,
      } satisfies MealPlanItem;
    });

  return normalizedMeals.filter((meal): meal is MealPlanItem => Boolean(meal));
}

export function getEnvWeather(): Weather {
  const weather = parseJsonEnv<Partial<Weather>>(
    process.env.WEATHER_JSON,
    defaultWeather,
  );

  return {
    location: sanitizeString(weather.location) || defaultWeather.location,
    temperature:
      typeof weather.temperature === "number"
        ? weather.temperature
        : defaultWeather.temperature,
    high: typeof weather.high === "number" ? weather.high : defaultWeather.high,
    low: typeof weather.low === "number" ? weather.low : defaultWeather.low,
    condition: sanitizeString(weather.condition) || defaultWeather.condition,
    icon: sanitizeString(weather.icon) || defaultWeather.icon,
    source: weather.source === "mock" ? "api" : "api",
  };
}
