import type { CalendarEvent, FamilyMember } from "@/types";

export function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function memberById(
  familyMembers: FamilyMember[],
  id?: string,
) {
  return familyMembers.find((member) => member.id === id) ?? familyMembers[0];
}

export function getEventTimeLabel(event: CalendarEvent, timeZone: string) {
  if (event.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.start));
}
