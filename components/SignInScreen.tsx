"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { signOut, type UserCredential } from "firebase/auth";
import {
  getFirebaseAuth,
  googleProvider,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import {
  isLikelyRestrictedWebView,
  resolveGoogleRedirectResult,
  signInWithGoogleSmart,
} from "@/lib/firebase/googleAuth";

const RESTRICTED_WEBVIEW_MESSAGE =
  "Google sign-in isn't available in this browser. If this is a kiosk or wall display, open /kiosk instead and sign in with the kiosk email and password.";

export default function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // True while we check for a Google sign-in that redirected back to this
  // page (mobile/tablet/PWA/kiosk flow) before showing the button.
  const [checkingRedirect, setCheckingRedirect] = useState(
    isFirebaseClientConfigured(),
  );

  async function completeSignIn(credential: UserCredential) {
    const idToken = await credential.user.getIdToken();

    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Unable to sign in.");
    }

    window.location.reload();
  }

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;

    let cancelled = false;

    (async () => {
      try {
        const credential = await resolveGoogleRedirectResult(getFirebaseAuth());
        if (cancelled) return;
        if (credential) {
          await completeSignIn(credential);
          return;
        }
      } catch (redirectError) {
        if (cancelled) return;
        setError(
          redirectError instanceof Error
            ? redirectError.message
            : "Unable to sign in.",
        );
      } finally {
        if (!cancelled) setCheckingRedirect(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn() {
    if (!isFirebaseClientConfigured()) {
      setError("Firebase client env vars are missing.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const firebaseAuth = getFirebaseAuth();
      const result = await signInWithGoogleSmart(firebaseAuth, googleProvider);

      if (result === "redirect-pending") {
        // Browser is navigating to Google now; completeSignIn runs in the
        // redirect-check effect above once it navigates back here.
        return;
      }

      await completeSignIn(result);
    } catch (error) {
      if (isFirebaseClientConfigured()) {
        await signOut(getFirebaseAuth()).catch(() => undefined);
      }
      setError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  const showKioskNotice = !error && isLikelyRestrictedWebView();

  return (
    <main className="sign-in-shell">
      <section className="sign-in-card">
        <div className="sign-in-badge">
          <ShieldCheck size={22} />
          Private family access
        </div>
        <div className="sign-in-copy">
          <p className="eyebrow">Family Hub</p>
          <h1>Sign in with your family Google account</h1>
          <p>
            This display only opens for approved family members and keeps the
            shared calendar and routines synced.
          </p>
        </div>
        <button
          type="button"
          className="sign-in-button"
          onClick={handleSignIn}
          disabled={pending || checkingRedirect || !isFirebaseClientConfigured()}
        >
          <LogIn size={18} />
          {!isFirebaseClientConfigured()
            ? "Firebase not configured"
            : checkingRedirect
              ? "Checking sign-in..."
              : pending
                ? "Signing in..."
                : "Continue with Google"}
        </button>
        {error ? <p className="sign-in-error">{error}</p> : null}
        {showKioskNotice ? (
          <p className="sign-in-notice">
            {RESTRICTED_WEBVIEW_MESSAGE}{" "}
            <Link href="/kiosk">Go to kiosk sign-in</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
