export type ThemeMode = "light" | "dark" | "auto";
export type DisplayView = "home" | "today" | "week" | "month";
export type EventCategory =
  | "family"
  | "work"
  | "school"
  | "appointments"
  | "chores"
  | "meals"
  | "birthdays"
  | "travel";

export type FamilyMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  avatarUrl?: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  ownerId?: string;
  category: EventCategory;
  location?: string;
  description?: string;
  source?: "mock" | "google";
};

export type Chore = {
  id: string;
  title: string;
  ownerId?: string;
  done: boolean;
  dueDate?: string;
};

export type Weather = {
  location: string;
  temperature: number;
  condition: string;
  high?: number;
  low?: number;
  icon?: string;
  source: "mock" | "api";
};

export type MealPlanItem = {
  id: string;
  meal: "breakfast" | "lunch" | "dinner";
  title: string;
  date: string;
};

export type AppData = {
  familyMembers: FamilyMember[];
  events: CalendarEvent[];
  chores: Chore[];
  mealPlan: MealPlanItem[];
  weather: Weather;
  lastUpdated: string;
  providers: {
    calendarConfigured: boolean;
    weatherConfigured: boolean;
  };
};
