import { addDays, addHours, startOfDay } from "@/lib/date";
import type {
  CalendarEvent,
  Chore,
  FamilyMember,
  MealPlanItem,
  Weather,
} from "@/types";

const memberPalette = [
  { id: "jared", name: "Jared", role: "Dad", initials: "J", color: "#2563eb" },
  { id: "angela", name: "Angela", role: "Mom", initials: "A", color: "#db2777" },
  { id: "ryleigh", name: "Ryleigh", role: "Kid", initials: "R", color: "#7c3aed" },
  { id: "mason", name: "Mason", role: "Kid", initials: "M", color: "#059669" },
  { id: "family", name: "Family", role: "Everyone", initials: "F", color: "#d97706" },
] satisfies FamilyMember[];

export function getFamilyMembers() {
  return memberPalette;
}

export function getMockEvents(now = new Date()): CalendarEvent[] {
  const base = startOfDay(now);
  return [
    {
      id: "school-dropoff",
      title: "School Drop-off",
      start: addHours(addDays(base, 0), 7.75).toISOString(),
      end: addHours(addDays(base, 0), 8.15).toISOString(),
      ownerId: "family",
      category: "school",
      location: "Main entrance",
      source: "mock",
    },
    {
      id: "standup",
      title: "Sales Review Call",
      start: addHours(addDays(base, 0), 9.5).toISOString(),
      end: addHours(addDays(base, 0), 10).toISOString(),
      ownerId: "jared",
      category: "work",
      location: "Home office",
      source: "mock",
    },
    {
      id: "lunch",
      title: "Lunch at Home",
      start: addHours(addDays(base, 0), 12).toISOString(),
      ownerId: "family",
      category: "meals",
      source: "mock",
    },
    {
      id: "dance",
      title: "Dance Class",
      start: addHours(addDays(base, 1), 17.5).toISOString(),
      ownerId: "ryleigh",
      category: "family",
      location: "Studio B",
      source: "mock",
    },
    {
      id: "soccer",
      title: "Soccer Practice",
      start: addHours(addDays(base, 2), 18).toISOString(),
      ownerId: "mason",
      category: "school",
      location: "Field 3",
      source: "mock",
    },
    {
      id: "appointment",
      title: "Doctor Appointment",
      start: addHours(addDays(base, 3), 14).toISOString(),
      end: addHours(addDays(base, 3), 15).toISOString(),
      ownerId: "angela",
      category: "appointments",
      location: "Carolina Pediatrics",
      source: "mock",
    },
    {
      id: "birthday",
      title: "Aunt Kim Birthday",
      start: addHours(addDays(base, 4), 0).toISOString(),
      allDay: true,
      ownerId: "family",
      category: "birthdays",
      source: "mock",
    },
    {
      id: "travel",
      title: "Weekend Trip",
      start: addHours(addDays(base, 5), 9).toISOString(),
      end: addHours(addDays(base, 5), 11).toISOString(),
      ownerId: "family",
      category: "travel",
      location: "Myrtle Beach",
      source: "mock",
    },
  ];
}

export function getChores(): Chore[] {
  return [
    { id: "pack-lunches", title: "Pack lunches", ownerId: "angela", done: true },
    { id: "water-plants", title: "Water plants", ownerId: "ryleigh", done: false },
    { id: "trash", title: "Take trash out", ownerId: "mason", done: false },
    { id: "tablets", title: "Charge tablets", ownerId: "jared", done: true },
  ];
}

export function getMealPlan(now = new Date()): MealPlanItem[] {
  const base = startOfDay(now);
  return [
    { id: "breakfast-1", meal: "breakfast", title: "Egg bites and fruit", date: addDays(base, 0).toISOString() },
    { id: "lunch-1", meal: "lunch", title: "Sandwiches and salad", date: addDays(base, 0).toISOString() },
    { id: "dinner-1", meal: "dinner", title: "Chicken tacos", date: addDays(base, 0).toISOString() },
    { id: "dinner-2", meal: "dinner", title: "Pasta night", date: addDays(base, 1).toISOString() },
  ];
}

export function getMockWeather(location: string): Weather {
  return {
    location,
    temperature: 84,
    high: 88,
    low: 74,
    condition: "Partly cloudy",
    icon: "cloud-sun",
    source: "mock",
  };
}
