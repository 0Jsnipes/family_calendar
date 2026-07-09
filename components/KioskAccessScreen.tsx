"use client";

import { AlertTriangle } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function KioskAccessScreen() {
  return (
    <main className="sign-in-shell">
      <section className="sign-in-card">
        <div className="sign-in-badge">
          <AlertTriangle size={22} />
          Hub access required
        </div>
        <div className="sign-in-copy">
          <p className="eyebrow">Family Hub</p>
          <h1>This kiosk account isn&apos;t linked to a hub yet</h1>
          <p>
            Ask the hub owner to add this account as a hub member with role
            &quot;kiosk&quot; in Firestore, then reload this page.
          </p>
        </div>
        <div className="access-action-stack">
          <SignOutButton className="sign-in-button" />
        </div>
      </section>
    </main>
  );
}
