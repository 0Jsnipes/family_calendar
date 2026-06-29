import { appConfig } from "@/lib/config";

export async function GET() {
  return Response.json({
    ok: true,
    app: appConfig.name,
    timeZone: appConfig.timezone,
    timestamp: new Date().toISOString(),
  });
}
