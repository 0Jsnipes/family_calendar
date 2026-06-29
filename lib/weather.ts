import { appConfig, serverConfig } from "@/lib/config";
import { getMockWeather } from "@/lib/mock-data";
import type { Weather } from "@/types";

export async function getWeather(): Promise<{
  weather: Weather;
  configured: boolean;
}> {
  const configured =
    appConfig.weatherProvider !== "mock" && Boolean(serverConfig.weatherApiKey);

  if (!configured) {
    return { weather: getMockWeather(appConfig.locationLabel), configured: false };
  }

  // Future integration hook:
  // Use WEATHER_API_KEY with the chosen provider, normalize the response to Weather,
  // and fall back to mock weather if the provider request fails.
  return { weather: getMockWeather(appConfig.locationLabel), configured: true };
}
