"use client";

import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { HubInviteRecord, HubMemberRecord } from "@/types";

async function getAuthHeaders(user: User) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
}

export function useHubDirectory() {
  const firebaseConfigured = isFirebaseClientConfigured();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [members, setMembers] = useState<HubMemberRecord[]>([]);
  const [invites, setInvites] = useState<HubInviteRecord[]>([]);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(
    firebaseConfigured ? null : "Firebase client env vars are missing.",
  );

  useEffect(() => {
    if (!firebaseConfigured) return;

    return onIdTokenChanged(getFirebaseAuth(), (user) => {
      setFirebaseUser(user);
    });
  }, [firebaseConfigured]);

  useEffect(() => {
    if (!firebaseUser) {
      const timeoutId = window.setTimeout(() => {
        setLoading(false);
        setMembers([]);
        setInvites([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const activeUser = firebaseUser;
    let ignore = false;

    async function loadDirectory() {
      setLoading(true);

      try {
        const response = await fetch("/api/hub/directory", {
          headers: {
            Authorization: `Bearer ${await activeUser.getIdToken()}`,
          },
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          members?: HubMemberRecord[];
          invites?: HubInviteRecord[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load hub members.");
        }

        if (ignore) return;
        setMembers(payload.members ?? []);
        setInvites(payload.invites ?? []);
        setError(null);
      } catch (caughtError) {
        if (!ignore) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load hub members.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadDirectory();

    return () => {
      ignore = true;
    };
  }, [firebaseUser]);

  async function addLocalMember(input: { name: string; role: string; color: string }) {
    if (!firebaseUser) throw new Error("You must be signed in.");
    const response = await fetch("/api/hub/directory", {
      method: "POST",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify({ action: "add-local", ...input }),
    });
    const payload = (await response.json()) as {
      members?: HubMemberRecord[];
      invites?: HubInviteRecord[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to add local member.");
    }
    setMembers(payload.members ?? []);
    setInvites(payload.invites ?? []);
  }

  async function removeMember(memberId: string) {
    if (!firebaseUser) throw new Error("You must be signed in.");
    const response = await fetch("/api/hub/directory", {
      method: "POST",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify({ action: "remove-member", memberId }),
    });
    const payload = (await response.json()) as {
      members?: HubMemberRecord[];
      invites?: HubInviteRecord[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to remove member.");
    }
    setMembers(payload.members ?? []);
    setInvites(payload.invites ?? []);
  }

  async function inviteMember(input: { email: string; role: "admin" | "member" }) {
    if (!firebaseUser) throw new Error("You must be signed in.");
    const response = await fetch("/api/hub/invites", {
      method: "POST",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {
      invites?: HubInviteRecord[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to invite member.");
    }
    setInvites(payload.invites ?? []);
  }

  return {
    firebaseUser,
    members,
    invites,
    loading,
    error,
    addLocalMember,
    removeMember,
    inviteMember,
  };
}
