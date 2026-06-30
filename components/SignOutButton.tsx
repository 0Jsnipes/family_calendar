"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);

    try {
      await fetch("/api/session", { method: "DELETE" });
      await signOut(firebaseAuth).catch(() => undefined);
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={className}
    >
      <LogOut size={17} />
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
