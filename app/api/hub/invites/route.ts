import { NextResponse } from "next/server";
import { createHubInvite, listPendingHubInvites } from "@/lib/hub";
import { requireHubManager } from "@/lib/hubAuth";

export async function GET() {
  try {
    await requireHubManager();
    return NextResponse.json({ invites: await listPendingHubInvites() });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "hub-manager-required" ? 403 : 401;
    return NextResponse.json({ error: "Unable to load invites." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireHubManager();
    const body = (await request.json()) as {
      email?: string;
      role?: "admin" | "member";
    };

    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    await createHubInvite({
      email,
      role: body.role === "admin" ? "admin" : "member",
      createdBy: context.user.uid,
    });

    return NextResponse.json({ invites: await listPendingHubInvites() });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "hub-manager-required" ? 403 : 401;
    return NextResponse.json({ error: "Unable to create invite." }, { status });
  }
}
