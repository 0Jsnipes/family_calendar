"use client";

import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { signInWithPopup, signOut } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";

export default function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    setError(null);

    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
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
    } catch (error) {
      await signOut(firebaseAuth).catch(() => undefined);
      setError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

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
          disabled={pending}
        >
          <LogIn size={18} />
          {pending ? "Signing in..." : "Continue with Google"}
        </button>
        {error ? <p className="sign-in-error">{error}</p> : null}
      </section>
    </main>
  );
}
