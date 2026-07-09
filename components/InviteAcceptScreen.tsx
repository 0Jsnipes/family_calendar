"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, MailCheck } from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";
import { getFirebaseAuth, googleProvider, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  KIOSK_BLOCKED_MESSAGE,
  isLikelyRestrictedWebView,
  resolveGoogleRedirectResult,
  signInWithGoogleSmart,
} from "@/lib/firebase/googleAuth";
import type { User } from "firebase/auth";

type Props = {
  token: string;
};

export default function InviteAcceptScreen({ token }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  // True while we check for a Google sign-in that redirected back to this
  // invite page (mobile/tablet/PWA/kiosk flow) before showing the button.
  const [checkingRedirect, setCheckingRedirect] = useState(
    isFirebaseClientConfigured(),
  );
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;
    return onIdTokenChanged(getFirebaseAuth(), setUser);
  }, []);

  async function ensureSession(currentUser: User) {
    const idToken = await currentUser.getIdToken();
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    return idToken;
  }

  const handleAccept = useCallback(
    async (currentUser: User) => {
      setPending(true);
      setError(null);

      try {
        const idToken = await ensureSession(currentUser);
        const response = await fetch("/api/hub/invites/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to accept invite.");
        }

        setJoined(true);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to accept invite.",
        );
      } finally {
        setPending(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;

    let cancelled = false;

    (async () => {
      try {
        // Mobile/tablet/PWA/kiosk shells complete Google sign-in via a
        // full-page redirect back to this same invite URL (the token stays
        // in the URL across the round trip), so pick the credential up here
        // and accept the invite the same way the popup flow does inline.
        const credential = await resolveGoogleRedirectResult(getFirebaseAuth());
        if (cancelled || !credential) return;
        await handleAccept(credential.user);
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
  }, [handleAccept]);

  async function handleSignIn() {
    if (!isFirebaseClientConfigured()) {
      setError("Firebase client env vars are missing.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await signInWithGoogleSmart(getFirebaseAuth(), googleProvider);

      if (result === "redirect-pending") {
        // Browser is navigating to Google now; the redirect-check effect
        // above accepts the invite once it navigates back here.
        return;
      }

      await handleAccept(result.user);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to sign in.",
      );
      setPending(false);
    }
  }

  const showKioskNotice = !error && isLikelyRestrictedWebView();

  return (
    <main className="sign-in-shell">
      <section className="sign-in-card">
        <div className="sign-in-badge">
          <MailCheck size={22} />
          Invite ready
        </div>
        <div className="sign-in-copy">
          <p className="eyebrow">Family Hub</p>
          <h1>{joined ? "You joined the hub" : "Join this household hub"}</h1>
          <p>
            {joined
              ? "You can sync Google Calendar next, or skip it for now and open the hub."
              : "Sign in with the invited Google account, then accept the invite and sync Google Calendar later if you want."}
          </p>
        </div>
        {checkingRedirect ? (
          <button type="button" className="sign-in-button" disabled>
            <LogIn size={18} />
            Checking sign-in...
          </button>
        ) : joined ? (
          <div className="access-action-stack">
            <button
              type="button"
              className="sign-in-button"
              onClick={() => router.push("/")}
            >
              Sync Google Calendar
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => router.push("/")}
            >
              Skip for now
            </button>
          </div>
        ) : user ? (
          <button
            type="button"
            className="sign-in-button"
            onClick={() => void handleAccept(user)}
            disabled={pending}
          >
            <MailCheck size={18} />
            {pending ? "Joining..." : "Accept Invite"}
          </button>
        ) : (
          <button
            type="button"
            className="sign-in-button"
            onClick={() => void handleSignIn()}
            disabled={pending}
          >
            <LogIn size={18} />
            {pending ? "Signing in..." : "Sign in to accept invite"}
          </button>
        )}
        {error ? <p className="sign-in-error">{error}</p> : null}
        {showKioskNotice ? (
          <p className="sign-in-notice">{KIOSK_BLOCKED_MESSAGE}</p>
        ) : null}
      </section>
    </main>
  );
}
