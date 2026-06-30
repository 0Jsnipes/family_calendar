import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionCookie } from "@/lib/firebase/admin";
import {
  deleteHouseholdAccount,
  listHouseholdAccounts,
  normalizeHouseholdEmail,
  upsertHouseholdAccount,
} from "@/lib/household";

async function getCurrentUser() {
  const cookieStore = await cookies();
  return verifySessionCookie(cookieStore.get(sessionCookieName)?.value);
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listHouseholdAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    calendarId?: string;
  };

  const email = body.email?.trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  await upsertHouseholdAccount({
    email: normalizeHouseholdEmail(email),
    name: body.name,
    calendarId: body.calendarId,
    createdBy: currentUser.email,
  });

  const accounts = await listHouseholdAccounts();
  return NextResponse.json({ accounts });
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  await deleteHouseholdAccount(email);
  const accounts = await listHouseholdAccounts();
  return NextResponse.json({ accounts });
}
