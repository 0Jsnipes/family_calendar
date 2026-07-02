import { NextResponse } from "next/server";
import {
  addLocalHubMember,
  listActiveHubMembers,
  listPendingHubInvites,
  removeHubMember,
} from "@/lib/hub";
import { requireHubManager, requireHubUser } from "@/lib/hubAuth";

export async function GET() {
  try {
    await requireHubUser();
    const [members, invites] = await Promise.all([
      listActiveHubMembers(),
      listPendingHubInvites(),
    ]);
    return NextResponse.json({ members, invites });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "hub-membership-required" ? 403 : 401;
    return NextResponse.json({ error: "Unable to load hub directory." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireHubManager();
    const body = (await request.json()) as {
      action?: "add-local" | "remove-member";
      name?: string;
      role?: string;
      color?: string;
      memberId?: string;
    };

    if (body.action === "add-local") {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      await addLocalHubMember({
        name: body.name,
        role:
          body.role === "child" ||
          body.role === "local" ||
          body.role === "member" ||
          body.role === "admin" ||
          body.role === "owner"
            ? body.role
            : "local",
        color: body.color?.trim() || "#7c3aed",
      });
    } else if (body.action === "remove-member") {
      if (!body.memberId?.trim()) {
        return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
      }
      await removeHubMember(body.memberId);
    } else {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const [members, invites] = await Promise.all([
      listActiveHubMembers(),
      listPendingHubInvites(),
    ]);
    return NextResponse.json({ members, invites });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "hub-manager-required" ? 403 : 401;
    return NextResponse.json({ error: "Unable to update the hub." }, { status });
  }
}
