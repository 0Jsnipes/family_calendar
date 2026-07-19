import { NextResponse } from "next/server";
import {
  createGoogleOAuthState,
  getGoogleCalendarAuthorizationUrl,
} from "@/lib/googleCalendarOAuth";
import { createPendingGoogleCalendarState } from "@/lib/googleCalendarIntegration";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export const dynamic = "force-dynamic";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return jsonError(403, "HUB_MEMBERSHIP_REQUIRED", "You must join a hub first.");
    }
    const state = createGoogleOAuthState();

    await createPendingGoogleCalendarState(decoded.uid, state);

    return NextResponse.json({
      success: true,
      url: getGoogleCalendarAuthorizationUrl(state),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("missing-env:")) {
      return jsonError(
        500,
        "GOOGLE_CALENDAR_SERVER_CONFIG_MISSING",
        "Google Calendar OAuth is not configured.",
      );
    }

    if (
      error instanceof Error &&
      (error.message === "missing-bearer-token" ||
        error.message === "auth/argument-error" ||
        error.message === "auth/id-token-expired")
    ) {
      return jsonError(
        401,
        "UNAUTHENTICATED",
        "Missing Firebase authorization token.",
      );
    }

    return jsonError(
      500,
      "GOOGLE_CALENDAR_CONNECT_FAILED",
      "Unable to start Google Calendar connection.",
    );
  }
}
