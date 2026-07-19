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
  memberType?: "account" | "local";
  email?: string | null;
  status?: "active" | "removed";
  calendarConnected?: boolean;
  showCalendarOnHub?: boolean;
  uid?: string | null;
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
  source?: "mock" | "google" | "hub";
};

export type HubCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  calendarId: string;
  memberId?: string;
  ownerUid: string;
  ownerName?: string;
  ownerColor?: string;
  location?: string;
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

export type AuthenticatedUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
};

export type HubMemberRole = "owner" | "admin" | "member" | "child" | "local" | "kiosk";

export type HubMemberRecord = {
  id: string;
  type: "account" | "local";
  uid: string | null;
  email: string | null;
  displayName: string;
  role: HubMemberRole;
  status: "active" | "removed";
  calendarConnected: boolean;
  showCalendarOnHub: boolean;
  color: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  joinedAt?: string | null;
};

export type HubInviteRecord = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "expired" | "revoked";
  createdBy: string;
  createdAt?: string | null;
  expiresAt?: string | null;
  acceptedByUid?: string | null;
  acceptedAt?: string | null;
};

export type HubSummary = {
  id: string;
  name: string;
  ownerUid: string;
  currentUserRole: HubMemberRole;
};

export type VoiceEventDraft = {
  title: string;
  allDay: boolean;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};
