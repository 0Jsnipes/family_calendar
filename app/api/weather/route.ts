import { type NextRequest } from "next/server";
import { fetchOpenMeteoWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latitude = parseCoordinate(searchParams.get("lat"));
  const longitude = parseCoordinate(searchParams.get("lon"));
  const timezone = searchParams.get("timezone");

  try {
    const result = await fetchOpenMeteoWeather({
      latitude,
      longitude,
      timezone,
      source:
        typeof latitude === "number" && typeof longitude === "number"
          ? "browser"
          : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: "Unable to load weather.",
        details: error instanceof Error ? error.message : "unknown-error",
      },
      { status: 500 },
    );
  }
}
