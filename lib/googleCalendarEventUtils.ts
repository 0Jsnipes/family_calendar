import type { HubCalendarEvent } from "@/types";

export type MinimalGoogleCalendarEvent = {
  id?: string | null;
  summary?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
};

export type CalendarApiAppError = {
  status: number;
  code: string;
  message: string;
};

export function mapGoogleCalendarEventToHubEvent(
  event: MinimalGoogleCalendarEvent,
  context: {
    uid: string;
    ownerName?: string;
    memberId?: string;
    ownerColor?: string;
    calendarId?: string;
  },
): HubCalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date ?? null;
  if (!start) return null;

  const end = event.end?.dateTime ?? event.end?.date ?? null;

  return {
    id: event.id ?? crypto.randomUUID(),
    title: event.summary?.trim() || "Untitled event",
    start,
    end,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    calendarId: context.calendarId ?? "primary",
    memberId: context.memberId,
    ownerUid: context.uid,
    ownerName: context.ownerName,
    ownerColor: context.ownerColor,
    location: event.location ?? undefined,
  };
}

export function mapGoogleStatusToCalendarApiError(
  status: number,
  reason: string,
): CalendarApiAppError {
  if (status === 401) {
    return {
      status: 409,
      code: "GOOGLE_RECONNECT_REQUIRED",
      message: "Reconnect Google Calendar to continue.",
    };
  }

  if (status === 403) {
    return {
      status: 403,
      code:
        reason === "insufficientPermissions" || reason === "forbidden"
          ? "GOOGLE_CALENDAR_PERMISSION_DENIED"
          : "GOOGLE_CALENDAR_FORBIDDEN",
      message: "Google Calendar permission was denied.",
    };
  }

  if (status === 429) {
    return {
      status: 429,
      code: "GOOGLE_CALENDAR_RATE_LIMITED",
      message: "Google Calendar is rate limited. Try again shortly.",
    };
  }

  if (status >= 500) {
    return {
      status: 503,
      code: "GOOGLE_CALENDAR_TEMPORARILY_UNAVAILABLE",
      message: "Google Calendar is temporarily unavailable.",
    };
  }

  return {
    status: 500,
    code: "GOOGLE_CALENDAR_REQUEST_FAILED",
    message: "Unable to load Google Calendar events.",
  };
}

export function isGoogleAccessTokenExpired(
  expiresAtMillis: number | null,
  now = Date.now(),
) {
  return !expiresAtMillis || expiresAtMillis <= now + 60 * 1000;
}
