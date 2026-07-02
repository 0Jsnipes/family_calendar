import "server-only";

import { headers } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { verifyIdToken } from "@/lib/firebase/admin";

function parseBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("missing-bearer-token");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new Error("missing-bearer-token");
  }

  return token;
}

export async function verifyFirebaseTokenFromAuthorizationHeader(
  authorizationHeader: string | null,
): Promise<DecodedIdToken> {
  const idToken = parseBearerToken(authorizationHeader);
  return verifyIdToken(idToken);
}

export async function verifyFirebaseTokenFromCurrentRequest() {
  const requestHeaders = await headers();
  return verifyFirebaseTokenFromAuthorizationHeader(
    requestHeaders.get("authorization"),
  );
}
