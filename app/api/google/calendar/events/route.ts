import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
import { decryptToken } from "@/lib/tokenCrypto";
import { getGoogleCalendarOAuthClient } from "@/lib/googleCalendarOAuth";
import {
  getGoogleCalendarIntegrationDoc,
  getGoogleCalendarPrivateTokenDoc,
  mapGoogleCalendarEvent,
} from "@/lib/googleCalendarIntegration";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return NextResponse.json({ error: "You are not a hub member." }, { status: 403 });
    }

    const [integrationSnapshot, tokenSnapshot] = await Promise.all([
      getGoogleCalendarIntegrationDoc(decoded.uid).get(),
      getGoogleCalendarPrivateTokenDoc(decoded.uid).get(),
    ]);

    if (!integrationSnapshot.exists || !tokenSnapshot.exists) {
      return NextResponse.json(
        { error: "Google Calendar is not connected." },
        { status: 404 },
      );
    }

    const tokenData = tokenSnapshot.data() as {
      encryptedRefreshToken?: string;
    };

    if (!tokenData.encryptedRefreshToken) {
      return NextResponse.json(
        { error: "Google Calendar is not connected." },
        { status: 404 },
      );
    }

    const oauthClient = getGoogleCalendarOAuthClient();
    oauthClient.setCredentials({
      refresh_token: decryptToken(tokenData.encryptedRefreshToken),
    });

    const calendar = google.calendar({ version: "v3", auth: oauthClient });
    const now = new Date();
    const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 25,
    });

    const events = (response.data.items ?? [])
      .map((event) =>
        mapGoogleCalendarEvent(
          event,
          decoded.uid,
          decoded.name ?? decoded.email ?? undefined,
          membership.id,
          membership.color,
        ),
      )
      .filter((event) => Boolean(event));

    await getGoogleCalendarIntegrationDoc(decoded.uid).set(
      {
        lastSyncAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ events });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "missing-bearer-token"
        ? "Missing Firebase authorization token."
        : error instanceof Error && error.message.startsWith("missing-env:")
          ? "Google Calendar server configuration is incomplete."
          : "Unable to load Google Calendar events.";

    const status =
      error instanceof Error && error.message === "missing-bearer-token"
        ? 401
        : error instanceof Error && error.message.startsWith("missing-env:")
          ? 500
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
