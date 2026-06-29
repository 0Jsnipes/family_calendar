import { appConfig, serverConfig } from "@/lib/config";
import { getFamilyMembers, getMockEvents } from "@/lib/mock-data";
import type { CalendarEvent } from "@/types";

export function mapGoogleEventToCalendarEvent(
  event: Record<string, unknown>,
): CalendarEvent | null {
  const start =
    typeof event.start === "object" && event.start !== null
      ? ((event.start as { dateTime?: string; date?: string }).dateTime ??
        (event.start as { dateTime?: string; date?: string }).date ??
        null)
      : null;

  if (!start || typeof event.summary !== "string") return null;

  return {
    id: typeof event.id === "string" ? event.id : crypto.randomUUID(),
    title: event.summary,
    start,
    end:
      typeof event.end === "object" && event.end !== null
        ? ((event.end as { dateTime?: string; date?: string }).dateTime ??
          (event.end as { dateTime?: string; date?: string }).date)
        : undefined,
    allDay:
      typeof event.start === "object" &&
      event.start !== null &&
      "date" in event.start,
    ownerId:
      typeof event.creator === "object" &&
      event.creator !== null &&
      typeof (event.creator as { email?: string }).email === "string"
        ? (event.creator as { email?: string }).email
        : undefined,
    category: "family",
    location:
      typeof event.location === "string" ? event.location : undefined,
    description:
      typeof event.description === "string" ? event.description : undefined,
    source: "google",
  };
}

export async function getCalendarEvents(): Promise<{
  events: CalendarEvent[];
  configured: boolean;
}> {
  const configured =
    Boolean(serverConfig.googleClientId) &&
    Boolean(serverConfig.googleClientSecret) &&
    Boolean(serverConfig.googleRefreshToken) &&
    serverConfig.googleCalendarIds.length > 0;

  if (!configured) {
    return { events: getMockEvents(), configured: false };
  }

  // Future integration hook:
  // 1. Read GOOGLE_CALENDAR_IDS from serverConfig.googleCalendarIds.
  // 2. Use OAuth refresh-token or service-account style server flow.
  // 3. Fetch events from Google Calendar and map them with mapGoogleEventToCalendarEvent().
  // 4. Persist and reuse nextSyncToken for incremental sync later.
  // 5. Fall back to mock events if any integration step fails.
  void appConfig;
  void getFamilyMembers;

  return { events: getMockEvents(), configured: true };
}
