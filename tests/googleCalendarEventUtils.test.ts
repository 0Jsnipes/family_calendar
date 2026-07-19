import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGoogleAccessTokenExpired,
  mapGoogleCalendarEventToHubEvent,
  mapGoogleStatusToCalendarApiError,
} from "@/lib/googleCalendarEventUtils";

describe("isGoogleAccessTokenExpired", () => {
  it("treats a non-expired token outside the refresh window as usable", () => {
    assert.equal(isGoogleAccessTokenExpired(200_000, 100_000), false);
  });

  it("treats an expired token as expired", () => {
    assert.equal(isGoogleAccessTokenExpired(99_999, 100_000), true);
  });

  it("treats a missing expiration as expired", () => {
    assert.equal(isGoogleAccessTokenExpired(null, 100_000), true);
  });
});

describe("mapGoogleStatusToCalendarApiError", () => {
  it("maps Google 401 to reconnect required", () => {
    assert.deepEqual(mapGoogleStatusToCalendarApiError(401, "authError"), {
      status: 409,
      code: "GOOGLE_RECONNECT_REQUIRED",
      message: "Reconnect Google Calendar to continue.",
    });
  });

  it("maps missing Calendar scope to a permission error", () => {
    assert.deepEqual(
      mapGoogleStatusToCalendarApiError(403, "insufficientPermissions"),
      {
        status: 403,
        code: "GOOGLE_CALENDAR_PERMISSION_DENIED",
        message: "Google Calendar permission was denied.",
      },
    );
  });

  it("maps rate limits and temporary Google failures", () => {
    assert.equal(
      mapGoogleStatusToCalendarApiError(429, "rateLimitExceeded").code,
      "GOOGLE_CALENDAR_RATE_LIMITED",
    );
    assert.deepEqual(mapGoogleStatusToCalendarApiError(503, "backendError"), {
      status: 503,
      code: "GOOGLE_CALENDAR_TEMPORARILY_UNAVAILABLE",
      message: "Google Calendar is temporarily unavailable.",
    });
  });
});

describe("mapGoogleCalendarEventToHubEvent", () => {
  const context = {
    uid: "user-1",
    ownerName: "Jared",
    memberId: "member-1",
    ownerColor: "#2563eb",
  };

  it("returns null when a Google event has no start", () => {
    assert.equal(
      mapGoogleCalendarEventToHubEvent({ id: "event-1", summary: "No start" }, context),
      null,
    );
  });

  it("normalizes an empty Google Calendar response to no events", () => {
    const events = [] as ReturnType<typeof mapGoogleCalendarEventToHubEvent>[];
    assert.deepEqual(events.filter(Boolean), []);
  });

  it("normalizes all-day events without shifting the date string", () => {
    assert.deepEqual(
      mapGoogleCalendarEventToHubEvent(
        {
          id: "all-day-1",
          summary: "Beach day",
          start: { date: "2026-07-20" },
          end: { date: "2026-07-21" },
        },
        context,
      ),
      {
        id: "all-day-1",
        title: "Beach day",
        start: "2026-07-20",
        end: "2026-07-21",
        allDay: true,
        calendarId: "primary",
        memberId: "member-1",
        ownerUid: "user-1",
        ownerName: "Jared",
        ownerColor: "#2563eb",
        location: undefined,
      },
    );
  });

  it("normalizes timed events", () => {
    assert.deepEqual(
      mapGoogleCalendarEventToHubEvent(
        {
          id: "timed-1",
          summary: "Dentist",
          location: "Myrtle Beach",
          start: { dateTime: "2026-07-20T09:00:00-04:00" },
          end: { dateTime: "2026-07-20T10:00:00-04:00" },
        },
        context,
      ),
      {
        id: "timed-1",
        title: "Dentist",
        start: "2026-07-20T09:00:00-04:00",
        end: "2026-07-20T10:00:00-04:00",
        allDay: false,
        calendarId: "primary",
        memberId: "member-1",
        ownerUid: "user-1",
        ownerName: "Jared",
        ownerColor: "#2563eb",
        location: "Myrtle Beach",
      },
    );
  });
});
