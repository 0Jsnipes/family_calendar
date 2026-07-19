import { NextResponse } from "next/server";
import { getGoogleCalendarCredentialStatus } from "@/lib/googleCalendarTokens";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export const dynamic = "force-dynamic";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return jsonError(403, "HUB_MEMBERSHIP_REQUIRED", "You are not a hub member.");
    }

    const status = await getGoogleCalendarCredentialStatus(decoded.uid);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "missing-bearer-token") {
      return jsonError(
        401,
        "UNAUTHENTICATED",
        "Missing Firebase authorization token.",
      );
    }

    return jsonError(
      500,
      "GOOGLE_CALENDAR_STATUS_FAILED",
      "Unable to load Google Calendar status.",
    );
  }
}
