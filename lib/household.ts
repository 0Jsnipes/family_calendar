import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import {
  getFirebaseAdminDb,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin-core";
import type { HouseholdAccount } from "@/types";

const HOUSEHOLD_ID = "default";

function getAccountsCollection() {
  return getFirebaseAdminDb()
    .collection("households")
    .doc(HOUSEHOLD_ID)
    .collection("accounts");
}

export function normalizeHouseholdEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getHouseholdAccountByEmail(email: string) {
  if (!isFirebaseAdminConfigured()) return null;

  const normalizedEmail = normalizeHouseholdEmail(email);
  const snapshot = await getAccountsCollection().doc(normalizedEmail).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Partial<HouseholdAccount> | undefined;
  if (!data?.email || data.status !== "active") return null;

  return {
    email: normalizeHouseholdEmail(data.email),
    name: data.name,
    calendarId: data.calendarId,
    status: "active",
    createdBy: data.createdBy,
  } satisfies HouseholdAccount;
}

export async function listHouseholdAccounts() {
  if (!isFirebaseAdminConfigured()) return [] as HouseholdAccount[];

  const snapshot = await getAccountsCollection().get();

  return snapshot.docs
    .map((doc) => doc.data() as Partial<HouseholdAccount>)
    .filter(
      (account): account is HouseholdAccount =>
        Boolean(account.email) && account.status === "active",
    )
    .map((account) => ({
      email: normalizeHouseholdEmail(account.email),
      name: account.name,
      calendarId: account.calendarId,
      status: "active",
      createdBy: account.createdBy,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function upsertHouseholdAccount(input: {
  email: string;
  name?: string;
  calendarId?: string;
  createdBy: string;
}) {
  const normalizedEmail = normalizeHouseholdEmail(input.email);
  const calendarId = input.calendarId?.trim() || normalizedEmail;
  const name = input.name?.trim() || normalizedEmail;

  await getAccountsCollection()
    .doc(normalizedEmail)
    .set(
      {
        email: normalizedEmail,
        name,
        calendarId,
        status: "active",
        createdBy: input.createdBy,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function deleteHouseholdAccount(email: string) {
  const normalizedEmail = normalizeHouseholdEmail(email);
  await getAccountsCollection().doc(normalizedEmail).delete();
}
