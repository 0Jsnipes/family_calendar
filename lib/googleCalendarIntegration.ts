import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { calendar_v3 } from "googleapis";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-core";
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "@/lib/googleCalendarOAuth";
import { setMemberCalendarConnection } from "@/lib/hub";
import type { HubCalendarEvent } from "@/types";

export function getGoogleCalendarIntegrationDoc(uid: string) {
  return getFirebaseAdminDb().doc(`users/${uid}/integrations/googleCalendar`);
}

export function getGoogleCalendarPrivateTokenDoc(uid: string) {
  return getFirebaseAdminDb().doc(`users/${uid}/private/googleCalendarTokens`);
}

export function getGoogleCalendarOAuthStateDoc(stateId: string) {
  return getFirebaseAdminDb().doc(`oauthStates/${stateId}`);
}

export async function createPendingGoogleCalendarState(uid: string, stateId: string) {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 10 * 60 * 1000);

  await getGoogleCalendarOAuthStateDoc(stateId).set({
    uid,
    type: "googleCalendar",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    used: false,
  });
}

export async function markOAuthStateUsed(stateId: string) {
  await getGoogleCalendarOAuthStateDoc(stateId).set(
    {
      used: true,
      usedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveGoogleCalendarConnection(input: {
  uid: string;
  encryptedRefreshToken: string;
}) {
  const integrationRef = getGoogleCalendarIntegrationDoc(input.uid);
  const tokenRef = getGoogleCalendarPrivateTokenDoc(input.uid);

  await Promise.all([
    integrationRef.set(
      {
        connected: true,
        provider: "google",
        scope: GOOGLE_CALENDAR_READONLY_SCOPE,
        calendarIds: ["primary"],
        connectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSyncAt: null,
      },
      { merge: true },
    ),
    tokenRef.set(
      {
        encryptedRefreshToken: input.encryptedRefreshToken,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    setMemberCalendarConnection(input.uid, true),
  ]);
}

export function mapGoogleCalendarEvent(
  event: calendar_v3.Schema$Event,
  uid: string,
  ownerName?: string,
  memberId?: string,
  ownerColor?: string,
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
    calendarId: "primary",
    memberId,
    ownerUid: uid,
    ownerName,
    ownerColor,
    location: event.location ?? undefined,
  };
}

export async function ensureDefaultHubMembershipPlaceholder(uid: string) {
  void uid;
  // Future household model:
  // when hubs are introduced, this is where we can ensure:
  // hubs/{hubId}
  // hubs/{hubId}/members/{uid}
  // while keeping Google Calendar tokens scoped to users/{uid}.
}
