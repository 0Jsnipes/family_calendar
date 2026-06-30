import { cookies } from "next/headers";
import { getCalendarEvents } from "@/lib/calendar";
import { sessionCookieName, verifySessionCookie } from "@/lib/firebase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const currentUser = await verifySessionCookie(
    cookieStore.get(sessionCookieName)?.value,
  );

  if (!currentUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getCalendarEvents();
  return Response.json(result);
}
