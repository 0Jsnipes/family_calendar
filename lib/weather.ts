import { appConfig, serverConfig } from "@/lib/config";
import { getEnvWeather } from "@/lib/env-data";
import type { Weather } from "@/types";

export async function getWeather(): Promise<{
  weather: Weather;
  configured: boolean;
}> {
  const hasInlineWeather = Boolean(serverConfig.weatherJson.trim());
  const configured =
    hasInlineWeather ||
    (Boolean(appConfig.weatherProvider) && Boolean(serverConfig.weatherApiKey));

  if (!configured) {
    return { weather: getEnvWeather(), configured: false };
  }

  return { weather: getEnvWeather(), configured: true };
}
