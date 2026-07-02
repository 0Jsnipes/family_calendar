import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin-core";
import { serverConfig } from "@/lib/config";
import type { VerifiedSessionUser } from "@/lib/firebase/admin";
import { queueTransactionalEmail } from "@/lib/mail";
import type {
  FamilyMember,
  HubInviteRecord,
  HubMemberRecord,
  HubMemberRole,
  HubSummary,
} from "@/types";

const DEFAULT_HUB_ID = "default";
const MEMBER_COLORS = ["#2563eb", "#db2777", "#7c3aed", "#059669", "#d97706"];

function db() {
  return getFirebaseAdminDb();
}

function hubRef(hubId = DEFAULT_HUB_ID) {
  return db().collection("hubs").doc(hubId);
}

function membersRef(hubId = DEFAULT_HUB_ID) {
  return hubRef(hubId).collection("members");
}

function invitesRef(hubId = DEFAULT_HUB_ID) {
  return hubRef(hubId).collection("invites");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function pickColor(seed: number) {
  return MEMBER_COLORS[seed % MEMBER_COLORS.length] ?? MEMBER_COLORS[0];
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function mapHubMember(docId: string, data: Partial<HubMemberRecord>): HubMemberRecord {
  return {
    id: docId,
    type: data.type === "local" ? "local" : "account",
    uid: data.uid ?? null,
    email: data.email ?? null,
    displayName: data.displayName ?? "Unnamed member",
    role: data.role ?? "member",
    status: data.status ?? "active",
    calendarConnected: Boolean(data.calendarConnected),
    showCalendarOnHub: Boolean(data.showCalendarOnHub),
    color: data.color ?? pickColor(0),
    createdAt: timestampToIso((data as { createdAt?: unknown }).createdAt),
    updatedAt: timestampToIso((data as { updatedAt?: unknown }).updatedAt),
    joinedAt: timestampToIso((data as { joinedAt?: unknown }).joinedAt),
  };
}

function mapInvite(docId: string, data: Record<string, unknown>): HubInviteRecord {
  return {
    id: docId,
    email: typeof data.email === "string" ? data.email : "",
    role: data.role === "admin" ? "admin" : "member",
    status:
      data.status === "accepted" ||
      data.status === "expired" ||
      data.status === "revoked"
        ? data.status
        : "pending",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: timestampToIso(data.createdAt),
    expiresAt: timestampToIso(data.expiresAt),
    acceptedByUid: typeof data.acceptedByUid === "string" ? data.acceptedByUid : null,
    acceptedAt: timestampToIso(data.acceptedAt),
  };
}

export async function maybeBootstrapDefaultHub(user: VerifiedSessionUser) {
  if (!isFirebaseAdminConfigured()) return;
  if (!user.email || !serverConfig.hubOwnerEmails.includes(user.email.toLowerCase())) {
    return;
  }

  const existingHub = await hubRef().get();
  if (existingHub.exists) return;

  await hubRef().set({
    name: serverConfig.defaultHubName,
    ownerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await membersRef().doc(user.uid).set({
    type: "account",
    uid: user.uid,
    email: user.email.toLowerCase(),
    displayName: user.name ?? user.email,
    role: "owner",
    status: "active",
    calendarConnected: false,
    showCalendarOnHub: true,
    color: pickColor(0),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    joinedAt: FieldValue.serverTimestamp(),
  });
}

export async function getActiveHubMembershipForUser(uid: string) {
  if (!isFirebaseAdminConfigured()) return null;
  const snapshot = await membersRef().doc(uid).get();
  if (!snapshot.exists) return null;
  const member = mapHubMember(snapshot.id, snapshot.data() as Partial<HubMemberRecord>);
  return member.status === "active" ? member : null;
}

export async function getPendingInvitesForEmail(email: string) {
  if (!isFirebaseAdminConfigured()) return [] as HubInviteRecord[];
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await invitesRef()
    .where("email", "==", normalizedEmail)
    .where("status", "==", "pending")
    .get();

  return snapshot.docs
    .map((doc) => mapInvite(doc.id, doc.data()))
    .filter((invite) => !invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now());
}

export async function getHubSummaryForUser(user: VerifiedSessionUser): Promise<{
  hub: HubSummary | null;
  member: HubMemberRecord | null;
  pendingInvites: HubInviteRecord[];
}> {
  if (!isFirebaseAdminConfigured()) {
    return { hub: null, member: null, pendingInvites: [] };
  }

  await maybeBootstrapDefaultHub(user);

  const [hubSnapshot, member, pendingInvites] = await Promise.all([
    hubRef().get(),
    getActiveHubMembershipForUser(user.uid),
    user.email ? getPendingInvitesForEmail(user.email) : Promise.resolve([]),
  ]);

  if (!hubSnapshot.exists || !member) {
    return { hub: null, member: null, pendingInvites };
  }

  const data = hubSnapshot.data() as { name?: string; ownerUid?: string };
  return {
    hub: {
      id: hubSnapshot.id,
      name: data.name ?? serverConfig.defaultHubName,
      ownerUid: data.ownerUid ?? member.uid ?? "",
      currentUserRole: member.role,
    },
    member,
    pendingInvites,
  };
}

export async function listActiveHubMembers() {
  if (!isFirebaseAdminConfigured()) return [] as HubMemberRecord[];
  const snapshot = await membersRef().where("status", "==", "active").get();
  return snapshot.docs
    .map((doc) => mapHubMember(doc.id, doc.data() as Partial<HubMemberRecord>))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function listPendingHubInvites() {
  if (!isFirebaseAdminConfigured()) return [] as HubInviteRecord[];
  const snapshot = await invitesRef().where("status", "==", "pending").get();
  return snapshot.docs
    .map((doc) => mapInvite(doc.id, doc.data()))
    .filter((invite) => !invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now())
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function canManageHub(role?: HubMemberRole | null) {
  return role === "owner" || role === "admin";
}

export function toFamilyMember(member: HubMemberRecord): FamilyMember {
  return {
    id: member.id,
    name: member.displayName,
    role: member.role,
    initials: initialsFor(member.displayName),
    color: member.color,
    memberType: member.type,
    email: member.email,
    status: member.status,
    calendarConnected: member.calendarConnected,
    showCalendarOnHub: member.showCalendarOnHub,
    uid: member.uid,
  };
}

export async function createHubInvite(input: {
  email: string;
  role: "admin" | "member";
  createdBy: string;
}) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("firebase-admin-not-configured");
  }
  const email = normalizeEmail(input.email);
  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const inviteRef = invitesRef().doc();

  await inviteRef.set({
    email,
    role: input.role,
    status: "pending",
    tokenHash,
    createdBy: input.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
    acceptedByUid: null,
    acceptedAt: null,
  });

  const inviteUrl = `${serverConfig.appUrl.replace(/\/$/, "")}/invite/${token}`;
  await queueTransactionalEmail({
    to: [email],
    subject: "You're invited to Family Hub",
    html: `<p>You were invited to join Family Hub.</p><p><a href="${inviteUrl}">Accept your invite</a></p>`,
  });

  return inviteRef.id;
}

export async function addLocalHubMember(input: {
  name: string;
  role: HubMemberRole;
  color: string;
}) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("firebase-admin-not-configured");
  }
  const memberRef = membersRef().doc();
  await memberRef.set({
    type: "local",
    uid: null,
    email: null,
    displayName: input.name.trim(),
    role: input.role,
    status: "active",
    calendarConnected: false,
    showCalendarOnHub: false,
    color: input.color,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function removeHubMember(memberId: string) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("firebase-admin-not-configured");
  }
  await membersRef().doc(memberId).set(
    {
      status: "removed",
      showCalendarOnHub: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setMemberCalendarConnection(uid: string, connected: boolean) {
  if (!isFirebaseAdminConfigured()) return;
  await membersRef().doc(uid).set(
    {
      calendarConnected: connected,
      showCalendarOnHub: connected,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function findInviteByTokenHash(tokenHash: string) {
  if (!isFirebaseAdminConfigured()) return null;
  const snapshot = await invitesRef()
    .where("tokenHash", "==", tokenHash)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  return snapshot.docs[0] ?? null;
}

export async function acceptHubInviteForUser(input: {
  token?: string;
  inviteId?: string;
  user: VerifiedSessionUser;
}) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("firebase-admin-not-configured");
  }
  const normalizedEmail = normalizeEmail(input.user.email);
  const inviteDoc =
    input.inviteId
      ? await invitesRef().doc(input.inviteId).get()
      : input.token
        ? await findInviteByTokenHash(
            createHash("sha256").update(input.token).digest("hex"),
          )
        : null;

  if (!inviteDoc?.exists) {
    throw new Error("invite-not-found");
  }

  const invite = mapInvite(inviteDoc.id, inviteDoc.data() as Record<string, unknown>);
  if (invite.status !== "pending") throw new Error("invite-invalid");
  if (invite.email !== normalizedEmail) throw new Error("invite-email-mismatch");
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
    await inviteDoc.ref.set({ status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw new Error("invite-expired");
  }

  await membersRef().doc(input.user.uid).set(
    {
      type: "account",
      uid: input.user.uid,
      email: normalizedEmail,
      displayName: input.user.name ?? normalizedEmail,
      role: invite.role,
      status: "active",
      calendarConnected: false,
      showCalendarOnHub: false,
      color: pickColor(normalizedEmail.length),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await inviteDoc.ref.set(
    {
      status: "accepted",
      acceptedByUid: input.user.uid,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
