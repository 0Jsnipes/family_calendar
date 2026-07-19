import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { encryptToken } from "@/lib/tokenCrypto";
import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  getGoogleCalendarOAuthClient,
} from "@/lib/googleCalendarOAuth";
import {
  ensureDefaultHubMembershipPlaceholder,
  getGoogleCalendarOAuthStateDoc,
  saveGoogleCalendarConnection,
} from "@/lib/googleCalendarIntegration";

function buildErrorRedirect(message: string, status = 400) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;padding:24px"><h1>Google Calendar connection failed</h1><p>${message}</p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return buildErrorRedirect("Missing Google authorization code.");
  }

  if (!state) {
    return buildErrorRedirect("Missing OAuth state.");
  }

  try {
    const stateRef = getGoogleCalendarOAuthStateDoc(state);
    const stateSnapshot = await stateRef.get();

    if (!stateSnapshot.exists) {
      return buildErrorRedirect("This Google connection request is invalid or expired.");
    }

    const stateData = stateSnapshot.data() as {
      uid?: string;
      type?: string;
      expiresAt?: Timestamp;
      used?: boolean;
    };

    if (
      !stateData.uid ||
      stateData.type !== "googleCalendar" ||
      stateData.used ||
      !stateData.expiresAt ||
      stateData.expiresAt.toMillis() < Date.now()
    ) {
      return buildErrorRedirect("This Google connection request is invalid or expired.");
    }

    const oauthClient = getGoogleCalendarOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    const refreshToken = tokens.refresh_token?.trim();
    const accessToken = tokens.access_token?.trim();
    const scope = tokens.scope?.trim() || GOOGLE_CALENDAR_READONLY_SCOPE;

    if (!refreshToken) {
      return buildErrorRedirect(
        "Google did not return a refresh token. Disconnect the app in your Google account permissions, then retry and approve access again.",
      );
    }

    if (!scope.split(/\s+/).includes(GOOGLE_CALENDAR_READONLY_SCOPE)) {
      return buildErrorRedirect(
        "Google Calendar permission was not granted. Reconnect and approve calendar read access.",
        403,
      );
    }

    await saveGoogleCalendarConnection({
      uid: stateData.uid,
      encryptedRefreshToken: encryptToken(refreshToken),
      encryptedAccessToken: accessToken ? encryptToken(accessToken) : undefined,
      accessTokenExpiresAt: tokens.expiry_date
        ? Timestamp.fromMillis(tokens.expiry_date)
        : undefined,
      scope,
    });
    await ensureDefaultHubMembershipPlaceholder(stateData.uid);

    await stateRef.set(
      {
        used: true,
        usedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("missing-env:")
        ? "Missing Google Calendar server configuration."
        : "Unable to complete Google Calendar connection.";

    return buildErrorRedirect(message, 500);
  }
}
