import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
  sessionCookieName,
  sessionDurationMs,
  verifyIdToken,
} from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { error: "Firebase Admin is not configured." },
        { status: 500 },
      );
    }

    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Firebase ID token." },
        { status: 400 },
      );
    }

    await verifyIdToken(idToken);

    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
      expiresIn: sessionDurationMs,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(sessionDurationMs / 1000),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to create a session." }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
