"use client";

import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type AuthProvider,
  type UserCredential,
} from "firebase/auth";

/**
 * signInWithPopup is the default for every environment: it never leaves
 * this page, so there is no round trip through Firebase's hosted
 * /__/auth/handler page and no dependence on sessionStorage surviving a
 * full-page navigation (the redirect flow's well-known failure mode on
 * Android Chrome/PWA — "missing initial state"). We only fall back to
 * signInWithRedirect when the popup itself couldn't run: it was blocked,
 * closed before completing, or the environment doesn't support popups at
 * all. Kiosk shells (Fully Kiosk Browser, in-app webviews) should not use
 * Google sign-in through this path either way — see /kiosk, which uses
 * email/password instead.
 */

export const KIOSK_BLOCKED_MESSAGE =
  "Google sign-in may be blocked in kiosk mode. Open this site in Chrome, sign in once, then install/open the app from the home screen.";

const POPUP_FALLBACK_ERROR_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

// Environment restrictions that mean the *redirect* flow itself couldn't run
// (as opposed to a normal cancel/network error) — this is what "truly
// blocked" kiosk/webview sign-in looks like from Firebase's side.
const KIOSK_BLOCKED_ERROR_CODES = new Set([
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported-in-this-environment",
]);

function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

function toDisplayError(error: unknown): Error {
  if (KIOSK_BLOCKED_ERROR_CODES.has(getErrorCode(error))) {
    return new Error(KIOSK_BLOCKED_MESSAGE);
  }
  return error instanceof Error ? error : new Error("Unable to sign in with Google.");
}

/**
 * Heuristic for Android system WebViews and in-app browsers (kiosk shells,
 * Facebook/Instagram/Line, etc.) that Google's own OAuth consent screen
 * actively rejects with a "disallowed_useragent" error — independent of
 * whatever Firebase reports, since that rejection happens on Google's page,
 * not ours.
 */
export function isLikelyRestrictedWebView(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent || "";
  return /; ?wv\)|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Kiosk/i.test(userAgent);
}

/** Result of a sign-in attempt: either a completed credential, or the
 * browser is about to navigate away for the redirect flow. */
export type GoogleSignInResult = UserCredential | "redirect-pending";

/**
 * Always tries the popup first, in every environment. Only falls back to
 * signInWithRedirect when the popup itself failed for an environment
 * reason (blocked, closed early, or unsupported) — never as a default
 * choice based on device/browser sniffing.
 */
export async function signInWithGoogleSmart(
  auth: Auth,
  provider: AuthProvider,
): Promise<GoogleSignInResult> {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (!POPUP_FALLBACK_ERROR_CODES.has(getErrorCode(error))) {
      throw toDisplayError(error);
    }

    try {
      await signInWithRedirect(auth, provider);
      return "redirect-pending";
    } catch (redirectError) {
      throw toDisplayError(redirectError);
    }
  }
}

/** Call once on app load to finish a signInWithRedirect flow that navigated
 * back to this page. Resolves to null when there was no pending redirect.
 * Races against a short timeout so a hung/broken redirect check (e.g. the
 * "missing initial state" sessionStorage failure) can never leave the app
 * stuck showing "Checking sign-in...". */
export async function resolveGoogleRedirectResult(
  auth: Auth,
): Promise<UserCredential | null> {
  try {
    const result = await Promise.race([
      getRedirectResult(auth),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return result;
  } catch (error) {
    throw toDisplayError(error);
  }
}
