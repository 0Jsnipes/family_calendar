import "server-only";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-core";

export const adminAuth = getFirebaseAdminAuth();
export const adminDb = getFirebaseAdminDb();
