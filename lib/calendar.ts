import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
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

export async function getCalendarEvents(): Promise<{
  events: CalendarEvent[];
  configured: boolean;
}> {
  const members = await listActiveHubMembers();
  const calendarMembers = members.filter(
    (member) =>
      member.type === "account" &&
      member.uid &&
      member.calendarConnected &&
      member.showCalendarOnHub,
  );

  if (!calendarMembers.length) {
    return { events: [], configured: false };
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
      events: allEvents.flat().sort((a, b) => a.start.localeCompare(b.start)),
      configured: true,
    };
  } catch {
    return { events: [], configured: true };
  }
}
