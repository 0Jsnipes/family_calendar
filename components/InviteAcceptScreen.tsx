"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, MailCheck } from "lucide-react";
import { onIdTokenChanged, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, googleProvider, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { User } from "firebase/auth";

type Props = {
  token: string;
};

export default function InviteAcceptScreen({ token }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
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

  async function handleAccept(currentUser: User) {
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
  }

  async function handleSignIn() {
    if (!isFirebaseClientConfigured()) {
      setError("Firebase client env vars are missing.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const credential = await signInWithPopup(getFirebaseAuth(), googleProvider);
      await handleAccept(credential.user);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to sign in.",
      );
      setPending(false);
    }
  }

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
        {joined ? (
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
      </section>
    </main>
  );
}
