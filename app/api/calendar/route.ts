import { cookies } from "next/headers";
import { getCalendarEvents } from "@/lib/calendar";
import { sessionCookieName, verifySessionCookie } from "@/lib/firebase/admin";
import { requireHubUser } from "@/lib/hubAuth";
import { createHubCalendarEvent } from "@/lib/calendar";

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

export async function POST(request: Request) {
  try {
    const context = await requireHubUser();
    const body = (await request.json()) as {
      title?: string;
      start?: string;
      end?: string;
      allDay?: boolean;
      location?: string;
      description?: string;
    };

    const event = await createHubCalendarEvent({
      title: body.title ?? "",
      start: body.start ?? "",
      end: body.end,
      allDay: Boolean(body.allDay),
      location: body.location,
      description: body.description,
      ownerId: context.member.id,
    });

    return Response.json({ event }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "hub-membership-required"
        ? "Only active hub members can add calendar events."
        : error instanceof Error && error.message === "calendar-title-required"
          ? "Event title is required."
          : error instanceof Error && error.message === "calendar-start-invalid"
            ? "Event start time is invalid."
            : error instanceof Error && error.message === "calendar-end-invalid"
              ? "Event end time is invalid."
              : error instanceof Error && error.message === "calendar-end-before-start"
                ? "Event end time must be after the start time."
                : "Unable to create calendar event.";
    const status =
      error instanceof Error &&
      (error.message === "calendar-title-required" ||
        error.message === "calendar-start-invalid" ||
        error.message === "calendar-end-invalid" ||
        error.message === "calendar-end-before-start")
        ? 400
        : error instanceof Error && error.message === "hub-membership-required"
          ? 403
          : 401;

    return Response.json({ error: message }, { status });
  }
}
