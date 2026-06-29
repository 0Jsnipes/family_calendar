import { getCalendarEvents } from "@/lib/calendar";

export async function GET() {
  const result = await getCalendarEvents();
  return Response.json(result);
}
