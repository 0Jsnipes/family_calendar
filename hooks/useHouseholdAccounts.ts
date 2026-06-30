"use client";

import { useEffect, useState } from "react";
import type { HouseholdAccount } from "@/types";

export function useHouseholdAccounts() {
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);

    try {
      const response = await fetch("/api/household-members", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        accounts?: HouseholdAccount[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load household accounts.");
      }

      setAccounts(payload.accounts ?? []);
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load household accounts.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addAccount(input: {
    email: string;
    name?: string;
    calendarId?: string;
  }) {
    const response = await fetch("/api/household-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as {
      accounts?: HouseholdAccount[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to add household account.");
    }

    setAccounts(payload.accounts ?? []);
  }

  async function removeAccount(email: string) {
    const response = await fetch("/api/household-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const payload = (await response.json()) as {
      accounts?: HouseholdAccount[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to remove household account.");
    }

    setAccounts(payload.accounts ?? []);
  }

  return {
    accounts,
    loading,
    error,
    refresh,
    addAccount,
    removeAccount,
  };
}
