import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isGoogleAccessTokenExpired } from "@/lib/googleCalendarEventUtils";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";
import {
  getGoogleCalendarIntegrationDoc,
  getGoogleCalendarPrivateTokenDoc,
} from "@/lib/googleCalendarIntegration";
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "@/lib/googleCalendarOAuth";

type GoogleCalendarTokenData = {
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  accessTokenExpiresAt?: Timestamp | { toMillis?: () => number } | null;
  scope?: string;
};

type GoogleTokenEndpointSuccess = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleTokenEndpointFailure = {
  error?: string;
  error_description?: string;
};

export class GoogleCalendarReconnectRequiredError extends Error {
  readonly code = "GOOGLE_RECONNECT_REQUIRED";

  constructor(message = "Reconnect Google Calendar to continue.") {
    super(message);
    this.name = "GoogleCalendarReconnectRequiredError";
  }
}

function getRequiredEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing-env:${name}`);
  }
  return value;
}

function timestampToMillis(value: GoogleCalendarTokenData["accessTokenExpiresAt"]) {
  return value?.toMillis?.() ?? null;
}

function hasCalendarReadonlyScope(scope: string | undefined) {
  return !scope || scope.split(/\s+/).includes(GOOGLE_CALENDAR_READONLY_SCOPE);
}

async function refreshGoogleAccessToken(uid: string, encryptedRefreshToken: string) {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const params = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as
    | GoogleTokenEndpointSuccess
    | GoogleTokenEndpointFailure;

  if (!response.ok) {
    const errorPayload = payload as GoogleTokenEndpointFailure;
    console.info("[google-calendar] token refresh failed", {
      uid,
      googleStatus: response.status,
      reason: errorPayload.error ?? "unknown",
      message: errorPayload.error_description ?? "Google token refresh failed.",
    });
    throw new GoogleCalendarReconnectRequiredError();
  }

  const successPayload = payload as GoogleTokenEndpointSuccess;
  if (!successPayload.access_token) {
    console.info("[google-calendar] token refresh missing access token", {
      uid,
      googleStatus: response.status,
    });
    throw new GoogleCalendarReconnectRequiredError();
  }

  if (!hasCalendarReadonlyScope(successPayload.scope)) {
    console.info("[google-calendar] token refresh missing required scope", {
      uid,
      googleStatus: response.status,
      requiredScope: GOOGLE_CALENDAR_READONLY_SCOPE,
    });
    throw new GoogleCalendarReconnectRequiredError();
  }

  const expiresAtMillis =
    Date.now() + (successPayload.expires_in ?? 3600) * 1000;
  const nextEncryptedRefreshToken = successPayload.refresh_token
    ? encryptToken(successPayload.refresh_token)
    : encryptedRefreshToken;

  await getGoogleCalendarPrivateTokenDoc(uid).set(
    {
      encryptedAccessToken: encryptToken(successPayload.access_token),
      encryptedRefreshToken: nextEncryptedRefreshToken,
      accessTokenExpiresAt: Timestamp.fromMillis(expiresAtMillis),
      scope: successPayload.scope ?? GOOGLE_CALENDAR_READONLY_SCOPE,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await getGoogleCalendarIntegrationDoc(uid).set(
    {
      connected: true,
      reconnectRequired: false,
      scope: successPayload.scope ?? GOOGLE_CALENDAR_READONLY_SCOPE,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return successPayload.access_token;
}

export async function getValidGoogleAccessToken(uid: string) {
  const tokenSnapshot = await getGoogleCalendarPrivateTokenDoc(uid).get();
  if (!tokenSnapshot.exists) {
    console.info("[google-calendar] token lookup", {
      uid,
      hasAccessToken: false,
      hasRefreshToken: false,
      accessTokenExpired: true,
    });
    throw new GoogleCalendarReconnectRequiredError();
  }

  const tokenData = tokenSnapshot.data() as GoogleCalendarTokenData;
  const expiresAtMillis = timestampToMillis(tokenData.accessTokenExpiresAt);
  const hasAccessToken = Boolean(tokenData.encryptedAccessToken);
  const hasRefreshToken = Boolean(tokenData.encryptedRefreshToken);
  const accessTokenExpired = isGoogleAccessTokenExpired(expiresAtMillis);

  console.info("[google-calendar] token lookup", {
    uid,
    hasAccessToken,
    hasRefreshToken,
    accessTokenExpired,
  });

  if (
    hasAccessToken &&
    !accessTokenExpired &&
    hasCalendarReadonlyScope(tokenData.scope)
  ) {
    return decryptToken(tokenData.encryptedAccessToken!);
  }

  if (!hasRefreshToken) {
    await getGoogleCalendarIntegrationDoc(uid).set(
      {
        connected: false,
        reconnectRequired: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw new GoogleCalendarReconnectRequiredError();
  }

  return refreshGoogleAccessToken(uid, tokenData.encryptedRefreshToken!);
}

export async function getGoogleCalendarCredentialStatus(uid: string) {
  const [integrationSnapshot, tokenSnapshot] = await Promise.all([
    getGoogleCalendarIntegrationDoc(uid).get(),
    getGoogleCalendarPrivateTokenDoc(uid).get(),
  ]);

  const integrationData = integrationSnapshot.exists
    ? (integrationSnapshot.data() as {
        connected?: boolean;
        calendarIds?: string[];
        lastSyncAt?: { toDate?: () => Date } | null;
        reconnectRequired?: boolean;
      })
    : null;
  const tokenData = tokenSnapshot.exists
    ? (tokenSnapshot.data() as GoogleCalendarTokenData)
    : null;

  const expiresAtMillis = timestampToMillis(tokenData?.accessTokenExpiresAt);
  const hasAccessToken = Boolean(tokenData?.encryptedAccessToken);
  const hasRefreshToken = Boolean(tokenData?.encryptedRefreshToken);
  const accessTokenExpired = isGoogleAccessTokenExpired(expiresAtMillis);
  const hasRequiredScope = hasCalendarReadonlyScope(tokenData?.scope);
  const connected = Boolean(
    integrationData?.connected &&
      hasRequiredScope &&
      (hasRefreshToken || (hasAccessToken && !accessTokenExpired)),
  );
  const reconnectRequired = Boolean(
    integrationData?.reconnectRequired ||
      (integrationData?.connected && (!hasRequiredScope || (!hasRefreshToken && accessTokenExpired))),
  );

  console.info("[google-calendar] credential status", {
    uid,
    connected,
    reconnectRequired,
    hasAccessToken,
    hasRefreshToken,
    accessTokenExpired,
  });

  return {
    connected,
    reconnectRequired,
    calendarIds: integrationData?.calendarIds?.length
      ? integrationData.calendarIds
      : ["primary"],
    lastSyncAt: integrationData?.lastSyncAt?.toDate?.().toISOString() ?? null,
  };
}
