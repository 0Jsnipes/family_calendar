import { NextResponse } from "next/server";
import { acceptHubInviteForUser } from "@/lib/hub";
import { headers } from "next/headers";
import { verifyFirebaseTokenFromAuthorizationHeader } from "@/lib/verifyFirebaseToken";

export async function POST(request: Request) {
  try {
    const requestHeaders = await headers();
    const decoded = await verifyFirebaseTokenFromAuthorizationHeader(
      requestHeaders.get("authorization"),
    );
    const body = (await request.json()) as { token?: string; inviteId?: string };
    await acceptHubInviteForUser({
      token: body.token,
      inviteId: body.inviteId,
      user: {
        uid: decoded.uid,
        email: decoded.email ?? "",
        name: decoded.name,
        picture: decoded.picture,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "invite-email-mismatch"
        ? "This invite was sent to a different email address."
        : error instanceof Error && error.message === "invite-expired"
          ? "This invite has expired."
          : error instanceof Error && error.message === "invite-not-found"
            ? "This invite is invalid."
            : "Unable to accept invite.";
    const status =
      error instanceof Error &&
      (error.message === "invite-email-mismatch" ||
        error.message === "invite-expired" ||
        error.message === "invite-not-found")
        ? 400
        : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
