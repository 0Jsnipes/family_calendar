import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin-core";
import { decryptToken } from "@/lib/tokenCrypto";
import { getGoogleCalendarOAuthClient } from "@/lib/googleCalendarOAuth";
import {
  getGoogleCalendarIntegrationDoc,
  getGoogleCalendarPrivateTokenDoc,
} from "@/lib/googleCalendarIntegration";
import { listActiveHubMembers } from "@/lib/hub";
import type { CalendarEvent } from "@/types";

type GoogleCalendarApiEvent = {
  id?: string | null;
  summary?: string | null;
  location?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
};

type HubCalendarEventDoc = {
  title?: string;
  start?: string;
  end?: string | null;
  allDay?: boolean;
  ownerId?: string | null;
  location?: string | null;
  description?: string | null;
};

const DEFAULT_HUB_ID = "default";

function calendarEventsRef(hubId = DEFAULT_HUB_ID) {
  return getFirebaseAdminDb().collection("hubs").doc(hubId).collection("calendarEvents");
}

function mapHubCalendarEventToCalendarEvent(
  eventId: string,
  data: HubCalendarEventDoc,
): CalendarEvent | null {
  if (!data.title?.trim() || !data.start?.trim()) {
    return null;
  }

  return {
    id: eventId,
    title: data.title.trim(),
    start: data.start,
    end: data.end ?? undefined,
    allDay: Boolean(data.allDay),
    ownerId: data.ownerId ?? undefined,
    category: "family",
    location: data.location?.trim() || undefined,
    description: data.description?.trim() || undefined,
    source: "hub",
  };
}

function mapGoogleEventToCalendarEvent(
  event: GoogleCalendarApiEvent,
  member: {
    id: string;
    uid: string | null;
    displayName: string;
  },
): CalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date ?? null;
  if (!start) return null;

  return {
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? "Untitled event",
    start,
    end: event.end?.dateTime ?? event.end?.date ?? undefined,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    ownerId: member.id,
    category: "family",
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    source: "google",
  };
}

async function listHubCalendarEvents() {
  if (!isFirebaseAdminConfigured()) {
    return [] as CalendarEvent[];
  }

  try {
    const snapshot = await calendarEventsRef().orderBy("start", "asc").limit(250).get();
    return snapshot.docs
      .map((doc) =>
        mapHubCalendarEventToCalendarEvent(doc.id, doc.data() as HubCalendarEventDoc),
      )
      .filter((event): event is CalendarEvent => Boolean(event));
  } catch {
    return [] as CalendarEvent[];
  }
}

export async function createHubCalendarEvent(input: {
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  ownerId?: string;
  location?: string;
  description?: string;
}) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("firebase-admin-not-configured");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("calendar-title-required");
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) {
    throw new Error("calendar-start-invalid");
  }

  const end = input.end ? new Date(input.end) : null;
  if (end && Number.isNaN(end.getTime())) {
    throw new Error("calendar-end-invalid");
  }
  if (end && end.getTime() < start.getTime()) {
    throw new Error("calendar-end-before-start");
  }

  const eventRef = calendarEventsRef().doc();
  await eventRef.set({
    title,
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    allDay: input.allDay,
    ownerId: input.ownerId?.trim() || null,
    location: input.location?.trim() || null,
    description: input.description?.trim() || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    id: eventRef.id,
    title,
    start: start.toISOString(),
    end: end ? end.toISOString() : undefined,
    allDay: input.allDay,
    ownerId: input.ownerId?.trim() || undefined,
    category: "family",
    location: input.location?.trim() || undefined,
    description: input.description?.trim() || undefined,
    source: "hub",
  } satisfies CalendarEvent;
}

export async function getCalendarEvents(): Promise<{
  events: CalendarEvent[];
  configured: boolean;
}> {
  const hubEvents = await listHubCalendarEvents();
  const members = await listActiveHubMembers();
  const calendarMembers = members.filter(
    (member) =>
      member.type === "account" &&
      member.uid &&
      member.calendarConnected &&
      member.showCalendarOnHub,
  );

  if (!calendarMembers.length) {
    return { events: hubEvents, configured: hubEvents.length > 0 };
  }

  try {
    const now = new Date();
    const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const allEvents = await Promise.all(
      calendarMembers.map(async (member) => {
        const [integrationSnapshot, tokenSnapshot] = await Promise.all([
          getGoogleCalendarIntegrationDoc(member.uid!).get(),
          getGoogleCalendarPrivateTokenDoc(member.uid!).get(),
        ]);

        if (!integrationSnapshot.exists || !tokenSnapshot.exists) {
          return [] as CalendarEvent[];
        }

        const integrationData = integrationSnapshot.data() as {
          connected?: boolean;
          calendarIds?: string[];
        };
        const tokenData = tokenSnapshot.data() as {
          encryptedRefreshToken?: string;
        };

        if (!integrationData.connected || !tokenData.encryptedRefreshToken) {
          return [] as CalendarEvent[];
        }

        const oauthClient = getGoogleCalendarOAuthClient();
        oauthClient.setCredentials({
          refresh_token: decryptToken(tokenData.encryptedRefreshToken),
        });

        const calendar = google.calendar({ version: "v3", auth: oauthClient });
        const calendarIds = integrationData.calendarIds?.length
          ? integrationData.calendarIds
          : ["primary"];

        const events = await Promise.all(
          calendarIds.map(async (calendarId) => {
            const response = await calendar.events.list({
              calendarId,
              timeMin: now.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 25,
            });

            return (response.data.items ?? [])
              .map((event) =>
                mapGoogleEventToCalendarEvent(event as GoogleCalendarApiEvent, member),
              )
              .filter((item): item is CalendarEvent => Boolean(item));
          }),
        );

        await getGoogleCalendarIntegrationDoc(member.uid!).set(
          {
            lastSyncAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        return events.flat();
      }),
    );

    return {
      events: [...hubEvents, ...allEvents.flat()].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
      configured: true,
    };
  } catch {
    return { events: hubEvents, configured: true };
  }
}
