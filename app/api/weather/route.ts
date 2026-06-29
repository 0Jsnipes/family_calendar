import { getWeather } from "@/lib/weather";

export async function GET() {
  const result = await getWeather();
  return Response.json(result);
}
