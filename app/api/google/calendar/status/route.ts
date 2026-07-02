import { NextResponse } from "next/server";
import { getGoogleCalendarIntegrationDoc } from "@/lib/googleCalendarIntegration";
import { getActiveHubMembershipForUser } from "@/lib/hub";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      request.headers.get("authorization"),
    );
    const membership = await getActiveHubMembershipForUser(decoded.uid);
    if (!membership) {
      return NextResponse.json({ error: "You are not a hub member." }, { status: 403 });
    }
    const snapshot = await getGoogleCalendarIntegrationDoc(decoded.uid).get();

    if (!snapshot.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = snapshot.data() as {
      connected?: boolean;
      calendarIds?: string[];
      lastSyncAt?: { toDate?: () => Date } | null;
    };

    return NextResponse.json({
      connected: Boolean(data.connected),
      calendarIds: data.calendarIds ?? ["primary"],
      lastSyncAt: data.lastSyncAt?.toDate?.().toISOString() ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "missing-bearer-token"
        ? "Missing Firebase authorization token."
        : "Unable to load Google Calendar status.";

    return NextResponse.json({ error: message }, { status: 401 });
  }
}
