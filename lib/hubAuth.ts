import "server-only";

import { headers } from "next/headers";
import { getHubSummaryForUser, canManageHub } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export async function requireHubUser() {
  const requestHeaders = await headers();
  const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
    requestHeaders.get("authorization"),
  );

  const user = {
    uid: decoded.uid,
    email: decoded.email ?? "",
    name: decoded.name,
    picture: decoded.picture,
  };
  const hubAccess = await getHubSummaryForUser(user);

  if (!hubAccess.member || !hubAccess.hub) {
    throw new Error("hub-membership-required");
  }

  return {
    decoded,
    user,
    hub: hubAccess.hub,
    member: hubAccess.member,
  };
}

export async function requireHubManager() {
  const context = await requireHubUser();
  if (!canManageHub(context.member.role)) {
    throw new Error("hub-manager-required");
  }
  return context;
}
