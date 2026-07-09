"use client";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from "firebase/auth";

function toDisplayError(error: unknown): Error {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return new Error("Incorrect email or password.");
    }
    if (code === "auth/too-many-requests") {
      return new Error("Too many attempts. Wait a moment and try again.");
    }
    if (code === "auth/network-request-failed") {
      return new Error("Network error. Check the connection and try again.");
    }
  }
  return error instanceof Error ? error : new Error("Unable to sign in.");
}

/** Kiosk devices sign in with a dedicated email/password account — never
 * Google OAuth, which Fully Kiosk Browser and other embedded webviews
 * reject outright (403: disallowed_useragent). */
export async function signInKiosk(
  auth: Auth,
  email: string,
  password: string,
): Promise<UserCredential> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw toDisplayError(error);
  }
}
