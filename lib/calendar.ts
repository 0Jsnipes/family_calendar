import { appConfig, serverConfig } from "@/lib/config";
import { listHouseholdAccounts } from "@/lib/household";
import { getMockEvents } from "@/lib/mock-data";
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
  const householdAccounts = await listHouseholdAccounts();
  const linkedCalendarIds = householdAccounts
    .map((account) => account.calendarId?.trim() || account.email)
    .filter(Boolean);
  const calendarIds = Array.from(
    new Set([...serverConfig.googleCalendarIds, ...linkedCalendarIds]),
  );
  const configured =
    Boolean(serverConfig.googleClientId) &&
    Boolean(serverConfig.googleClientSecret) &&
    Boolean(serverConfig.googleRefreshToken) &&
    calendarIds.length > 0;

  if (!configured) {
    return { events: getMockEvents(), configured: false };
  }

  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: serverConfig.googleClientId,
        client_secret: serverConfig.googleClientSecret,
        refresh_token: serverConfig.googleRefreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      throw new Error("token-exchange-failed");
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new Error("missing-access-token");
    }

    const allEvents = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "50",
          timeZone: appConfig.timezone,
        });

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId,
          )}/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${tokenPayload.access_token}`,
            },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`calendar-fetch-failed:${calendarId}`);
        }

        const payload = (await response.json()) as {
          items?: Record<string, unknown>[];
        };

        return (payload.items ?? [])
          .map((event) => mapGoogleEventToCalendarEvent(event))
          .filter((event): event is CalendarEvent => Boolean(event));
      }),
    );

    const dedupedEvents = Array.from(
      new Map(
        allEvents
          .flat()
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((event) => [event.id, event]),
      ).values(),
    );

    return { events: dedupedEvents, configured: true };
  } catch {
    return { events: getMockEvents(), configured: true };
  }
}
