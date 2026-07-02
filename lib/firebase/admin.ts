import { cache } from "react";
import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin-core";

const SESSION_COOKIE_NAME = "__session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;
export const sessionCookieName = SESSION_COOKIE_NAME;
export const sessionDurationMs = SESSION_DURATION_MS;
export { getFirebaseAdminAuth, isFirebaseAdminConfigured };

export type VerifiedSessionUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
};

export async function verifyIdToken(idToken: string) {
  return getFirebaseAdminAuth().verifyIdToken(idToken);
}

export const verifySessionCookie = cache(async (sessionCookie?: string) => {
  if (!sessionCookie) return null;
  if (!isFirebaseAdminConfigured()) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );

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
