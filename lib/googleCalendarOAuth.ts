import "server-only";

import { randomBytes } from "node:crypto";
import { google } from "googleapis";

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

function getRequiredEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_REDIRECT_URI") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing-env:${name}`);
  }
  return value;
}

export function getGoogleCalendarOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv("GOOGLE_CLIENT_ID"),
    getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    getRequiredEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function createGoogleOAuthState() {
  return randomBytes(32).toString("hex");
}

export function getGoogleCalendarAuthorizationUrl(state: string) {
  return getGoogleCalendarOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_CALENDAR_READONLY_SCOPE],
    state,
  });
}
