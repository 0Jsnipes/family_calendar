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
 * signInWithPopup opens a second browser window/tab, which Android/iOS
 * kiosk shells, installed PWAs (standalone display mode), and in-app
 * webviews frequently cannot spawn — the popup gets silently blocked, is
 * closed by the host shell before the OAuth flow finishes, or Firebase
 * itself refuses with "operation-not-supported-in-this-environment"
 * because there is no separate chrome to host it in. signInWithRedirect
 * instead navigates the same window through Google's consent screen and
 * back, which works in all of those shells, so we use it there and reserve
 * the popup (no full-page reload/back-button hop) for normal desktop tabs.
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

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosStandalone === true
  );
}

export function isMobileOrTabletDevice(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent || "";
  const touchPoints = window.navigator.maxTouchPoints ?? 0;
  const uaLooksMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk/i.test(userAgent);
  // iPadOS 13+ identifies as "Macintosh" but exposes multi-touch, unlike a
  // real Mac trackpad/mouse.
  const isTouchMac = /Macintosh/i.test(userAgent) && touchPoints > 1;

  return uaLooksMobile || isTouchMac || touchPoints > 1;
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

export function shouldUseRedirectForGoogleSignIn(): boolean {
  return isStandalonePwa() || isMobileOrTabletDevice() || isLikelyRestrictedWebView();
}

/** Result of a sign-in attempt: either a completed credential, or the
 * browser is about to navigate away for the redirect flow. */
export type GoogleSignInResult = UserCredential | "redirect-pending";

export async function signInWithGoogleSmart(
  auth: Auth,
  provider: AuthProvider,
): Promise<GoogleSignInResult> {
  if (shouldUseRedirectForGoogleSignIn()) {
    try {
      await signInWithRedirect(auth, provider);
      return "redirect-pending";
    } catch (error) {
      throw toDisplayError(error);
    }
  }

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
 * back to this page. Resolves to null when there was no pending redirect. */
export async function resolveGoogleRedirectResult(
  auth: Auth,
): Promise<UserCredential | null> {
  try {
    return await getRedirectResult(auth);
  } catch (error) {
    throw toDisplayError(error);
  }
}
