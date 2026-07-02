"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, Mail, MailCheck, Users } from "lucide-react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { useEffect } from "react";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";

type Props = {
  hasPendingInvite: boolean;
  pendingInviteId?: string;
};

export default function HubAccessScreen({
  hasPendingInvite,
  pendingInviteId,
}: Props) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;
    return onIdTokenChanged(getFirebaseAuth(), setFirebaseUser);
  }, []);

  async function handleAcceptInvite() {
    if (!firebaseUser || !pendingInviteId) {
      setError("Unable to find a pending invite for this account.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/hub/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify({ inviteId: pendingInviteId }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to accept invite.");
      }

      window.location.reload();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to accept invite.",
      );
      setPending(false);
    }
  }

  return (
    <main className="sign-in-shell">
      <section className="sign-in-card">
        <div className="sign-in-badge">
          <Home size={22} />
          Hub access required
        </div>
        <div className="sign-in-copy">
          <p className="eyebrow">Family Hub</p>
          <h1>
            {hasPendingInvite
              ? "You have a pending hub invite"
              : "You are not connected to a hub yet"}
          </h1>
          <p>
            {hasPendingInvite
              ? "Use the invite link from your email to join the hub, or ask the owner to resend it."
              : "Ask the hub owner for an invite before you can view private hub data."}
          </p>
        </div>
        <div className="access-action-stack">
          {hasPendingInvite ? (
            <>
              <div className="access-inline-note">
                <Mail size={18} />
                An invite is already waiting for this signed-in account.
              </div>
              <button
                type="button"
                className="sign-in-button"
                onClick={() => void handleAcceptInvite()}
                disabled={pending || !firebaseUser || !pendingInviteId}
              >
                <MailCheck size={18} />
                {pending ? "Joining..." : "Accept Invite"}
              </button>
            </>
          ) : (
            <div className="access-inline-note">
              <Users size={18} />
              Only active hub members can open this display.
            </div>
          )}
          {error ? <p className="sign-in-error">{error}</p> : null}
          <Link href="/" className="sign-in-button">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
