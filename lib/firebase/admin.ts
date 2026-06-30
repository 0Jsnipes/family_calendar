import { cache } from "react";
import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin-core";
import { getHouseholdAccountByEmail } from "@/lib/household";

const SESSION_COOKIE_NAME = "__session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const allowedEmails = getAllowedEmails();
export const sessionCookieName = SESSION_COOKIE_NAME;
export const sessionDurationMs = SESSION_DURATION_MS;
export { getFirebaseAdminAuth, isFirebaseAdminConfigured };

export type VerifiedSessionUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
};

export async function isAllowedEmail(email?: string | null) {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase();
  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  const account = await getHouseholdAccountByEmail(normalizedEmail);
  return Boolean(account);
}

export async function verifyIdTokenForAllowedUser(idToken: string) {
  const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
  if (!(await isAllowedEmail(decoded.email))) {
    throw new Error("unauthorized-email");
  }

  return decoded;
}

export const verifySessionCookie = cache(async (sessionCookie?: string) => {
  if (!sessionCookie) return null;
  if (!isFirebaseAdminConfigured()) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );

    if (!(await isAllowedEmail(decoded.email))) {
      return null;
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: decoded.name,
      picture: decoded.picture,
    } satisfies VerifiedSessionUser;
  } catch {
    return null;
  }
});
