"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Lock, Mail, MonitorSmartphone } from "lucide-react";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { signInKiosk } from "@/lib/firebase/kioskAuth";

export default function KioskSignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isFirebaseClientConfigured()) {
      setError("Firebase client env vars are missing.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const credential = await signInKiosk(getFirebaseAuth(), email.trim(), password);
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
          <MonitorSmartphone size={22} />
          Kiosk display
        </div>
        <div className="sign-in-copy">
          <p className="eyebrow">Family Hub</p>
          <h1>Sign in to this display</h1>
          <p>
            Use the kiosk account for this device. This sign-in never opens
            Google — it works inside kiosk browsers and locked-down tablets.
          </p>
        </div>

        <form className="kiosk-sign-in-form" onSubmit={handleSubmit}>
          <label>
            <span>
              <Mail size={16} /> Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(changeEvent) => setEmail(changeEvent.target.value)}
              placeholder="kitchen-hub@example.com"
              autoComplete="username"
              required
              disabled={pending || !isFirebaseClientConfigured()}
            />
          </label>
          <label>
            <span>
              <Lock size={16} /> Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(changeEvent) => setPassword(changeEvent.target.value)}
              autoComplete="current-password"
              required
              disabled={pending || !isFirebaseClientConfigured()}
            />
          </label>
          <button
            type="submit"
            className="sign-in-button"
            disabled={pending || !isFirebaseClientConfigured()}
          >
            {!isFirebaseClientConfigured()
              ? "Firebase not configured"
              : pending
                ? "Signing in..."
                : "Sign in"}
          </button>
        </form>

        {error ? <p className="sign-in-error">{error}</p> : null}

        <p className="sign-in-notice">
          Not a kiosk device? <Link href="/">Sign in with Google instead</Link>
        </p>
      </section>
    </main>
  );
}
