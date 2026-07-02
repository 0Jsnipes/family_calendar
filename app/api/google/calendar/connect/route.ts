import { NextResponse } from "next/server";
import {
  createGoogleOAuthState,
  getGoogleCalendarAuthorizationUrl,
} from "@/lib/googleCalendarOAuth";
import { createPendingGoogleCalendarState } from "@/lib/googleCalendarIntegration";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return NextResponse.json({ error: "You must join a hub first." }, { status: 403 });
    }
    const state = createGoogleOAuthState();

    await createPendingGoogleCalendarState(decoded.uid, state);

    return NextResponse.json({
      url: getGoogleCalendarAuthorizationUrl(state),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("missing-env:")
        ? "Google Calendar OAuth is not configured."
        : error instanceof Error && error.message === "missing-bearer-token"
          ? "Missing Firebase authorization token."
          : "Unable to start Google Calendar connection.";

    const status =
      error instanceof Error &&
      (error.message === "missing-bearer-token" ||
        error.message === "auth/argument-error" ||
        error.message === "auth/id-token-expired")
        ? 401
        : error instanceof Error && error.message.startsWith("missing-env:")
          ? 500
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
