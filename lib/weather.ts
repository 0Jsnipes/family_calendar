import { appConfig, serverConfig } from "@/lib/config";
import { getEnvWeather } from "@/lib/env-data";
import type { Weather } from "@/types";

const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

type OpenMeteoGeocodeResponse = {
  results?: Array<{
    name?: string;
    admin1?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

type OpenMeteoForecastResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

function weatherLabelFromCode(code?: number) {
  switch (code) {
    case 0:
      return "Clear";
    case 1:
    case 2:
      return "Partly cloudy";
    case 3:
      return "Cloudy";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return "Rain";
    case 71:
    case 73:
    case 75:
    case 77:
      return "Snow";
    case 80:
    case 81:
    case 82:
      return "Showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
    case 96:
    case 99:
      return "Thunderstorms";
    default:
      return "Unavailable";
  }
}

async function fetchOpenMeteoWeather(locationLabel: string) {
  const geocodeUrl = new URL(OPEN_METEO_GEOCODE_URL);
  geocodeUrl.searchParams.set("name", locationLabel);
  geocodeUrl.searchParams.set("count", "1");
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("format", "json");

  const geocodeResponse = await fetch(geocodeUrl, {
    cache: "no-store",
  });
  if (!geocodeResponse.ok) {
    throw new Error("open-meteo-geocode-failed");
  }

  const geocodeData =
    (await geocodeResponse.json()) as OpenMeteoGeocodeResponse;
  const match = geocodeData.results?.[0];
  if (
    !match ||
    typeof match.latitude !== "number" ||
    typeof match.longitude !== "number"
  ) {
    throw new Error("open-meteo-location-not-found");
  }

  const forecastUrl = new URL(OPEN_METEO_FORECAST_URL);
  forecastUrl.searchParams.set("latitude", String(match.latitude));
  forecastUrl.searchParams.set("longitude", String(match.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,weather_code");
  forecastUrl.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min",
  );
  forecastUrl.searchParams.set("temperature_unit", "fahrenheit");
  forecastUrl.searchParams.set("timezone", appConfig.timezone);

  const forecastResponse = await fetch(forecastUrl, {
    cache: "no-store",
  });
  if (!forecastResponse.ok) {
    throw new Error("open-meteo-forecast-failed");
  }

  const forecastData =
    (await forecastResponse.json()) as OpenMeteoForecastResponse;
  const location =
    [match.name, match.admin1].filter(Boolean).join(", ") || locationLabel;

  return {
    location,
    temperature: Math.round(forecastData.current?.temperature_2m ?? 0),
    high: Math.round(forecastData.daily?.temperature_2m_max?.[0] ?? 0),
    low: Math.round(forecastData.daily?.temperature_2m_min?.[0] ?? 0),
    condition: weatherLabelFromCode(forecastData.current?.weather_code),
    icon: "cloud-sun",
    source: "api",
  } satisfies Weather;
}

export async function getWeather(): Promise<{
  weather: Weather;
  configured: boolean;
}> {
  const hasInlineWeather = Boolean(serverConfig.weatherJson.trim());

  if (hasInlineWeather) {
    return { weather: getEnvWeather(), configured: true };
  }

  if (appConfig.weatherProvider === "open-meteo") {
    try {
      return {
        weather: await fetchOpenMeteoWeather(appConfig.locationLabel),
        configured: true,
      };
    } catch {
      return { weather: getEnvWeather(), configured: false };
    }
  }

  const configured =
    Boolean(appConfig.weatherProvider) && Boolean(serverConfig.weatherApiKey);

  if (!configured) {
    return { weather: getEnvWeather(), configured: false };
  }

  return { weather: getEnvWeather(), configured: true };
}
