import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  getGoogleCalendarIntegrationDoc,
  mapGoogleCalendarEvent,
} from "@/lib/googleCalendarIntegration";
import { mapGoogleStatusToCalendarApiError } from "@/lib/googleCalendarEventUtils";
import {
  getValidGoogleAccessToken,
  GoogleCalendarReconnectRequiredError,
} from "@/lib/googleCalendarTokens";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";
import type { HubCalendarEvent } from "@/types";

export const dynamic = "force-dynamic";

type GoogleCalendarApiError = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
    status?: string;
  };
};

type GoogleCalendarApiSuccess = {
  items?: Parameters<typeof mapGoogleCalendarEvent>[0][];
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message }, { status });
}

function readGoogleApiError(payload: GoogleCalendarApiError) {
  const firstError = payload.error?.errors?.[0];
  return {
    reason: firstError?.reason ?? payload.error?.status ?? "unknown",
    message:
      firstError?.message ??
      payload.error?.message ??
      "Google Calendar API request failed.",
  };
}

async function fetchPrimaryCalendarEvents(accessToken: string) {
  const now = new Date();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  let uid: string | null = null;
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    uid = decoded.uid;
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return jsonError(403, "HUB_MEMBERSHIP_REQUIRED", "You are not a hub member.");
    }

    const accessToken = await getValidGoogleAccessToken(decoded.uid);
    const response = await fetchPrimaryCalendarEvents(accessToken);
    const payload = (await response.json().catch(() => ({}))) as
      | GoogleCalendarApiSuccess
      | GoogleCalendarApiError;

    if (!response.ok) {
      const googleError = readGoogleApiError(payload as GoogleCalendarApiError);
      console.info("[google-calendar] events request failed", {
        uid: decoded.uid,
        googleStatus: response.status,
        reason: googleError.reason,
        message: googleError.message,
      });
      const appError = mapGoogleStatusToCalendarApiError(
        response.status,
        googleError.reason,
      );
      return jsonError(appError.status, appError.code, appError.message);
    }

    console.info("[google-calendar] events request succeeded", {
      uid: decoded.uid,
      googleStatus: response.status,
    });

    const events = ((payload as GoogleCalendarApiSuccess).items ?? [])
      .map((event) =>
        mapGoogleCalendarEvent(
          event,
          decoded.uid,
          decoded.name ?? decoded.email ?? undefined,
          membership.id,
          membership.color,
        ),
      )
      .filter((event): event is HubCalendarEvent => Boolean(event));

    await getGoogleCalendarIntegrationDoc(decoded.uid).set(
      {
        lastSyncAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, events });
  } catch (error) {
    if (error instanceof GoogleCalendarReconnectRequiredError) {
      return jsonError(409, error.code, error.message);
    }

    if (error instanceof Error && error.message === "missing-bearer-token") {
      return jsonError(
        401,
        "UNAUTHENTICATED",
        "Missing Firebase authorization token.",
      );
    }

    if (error instanceof Error && error.message.startsWith("missing-env:")) {
      console.error("[google-calendar] missing server configuration", {
        uid,
        setting: error.message.replace("missing-env:", ""),
      });
      return jsonError(
        500,
        "GOOGLE_CALENDAR_SERVER_CONFIG_MISSING",
        "Google Calendar server configuration is incomplete.",
      );
    }

    console.error("[google-calendar] unexpected events failure", {
      uid,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return jsonError(
      500,
      "GOOGLE_CALENDAR_UNEXPECTED_ERROR",
      "Unable to load Google Calendar events.",
    );
  }
}
