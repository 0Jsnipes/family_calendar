import { appConfig, serverConfig } from "@/lib/config";
import { getEnvWeather } from "@/lib/env-data";
import type { Weather, WeatherApiResponse } from "@/types";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MYRTLE_BEACH_DEFAULTS = {
  latitude: 33.6891,
  longitude: -78.8867,
  timezone: "America/New_York",
  label: "Myrtle Beach, SC",
} as const;

type WeatherSource = "browser" | "home" | "default";

type WeatherLocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  label?: string | null;
  source?: WeatherSource;
};

type OpenMeteoForecastResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function normalizeCoordinate(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeTimezone(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || MYRTLE_BEACH_DEFAULTS.timezone;
}

function normalizeLabel(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || MYRTLE_BEACH_DEFAULTS.label;
}

export function weatherSummaryFromCode(code?: number) {
  switch (code) {
    case 0:
      return "Clear";
    case 1:
      return "Mostly clear";
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
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
      return "Light rain";
    case 63:
      return "Rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
      return "Light snow";
    case 73:
      return "Snow";
    case 75:
      return "Heavy snow";
    case 77:
      return "Snow grains";
    case 80:
      return "Light showers";
    case 81:
      return "Showers";
    case 82:
      return "Heavy showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorms";
    default:
      return "Weather unavailable";
  }
}

export function resolveHomeWeatherLocation() {
  const hasEnvCoordinates =
    Number.isFinite(appConfig.homeLatitude) && Number.isFinite(appConfig.homeLongitude);

  return {
    latitude: hasEnvCoordinates ? appConfig.homeLatitude : MYRTLE_BEACH_DEFAULTS.latitude,
    longitude: hasEnvCoordinates ? appConfig.homeLongitude : MYRTLE_BEACH_DEFAULTS.longitude,
    timezone: normalizeTimezone(appConfig.timezone),
    label: normalizeLabel(appConfig.locationLabel),
    source: hasEnvCoordinates ? ("home" as const) : ("default" as const),
  };
}

function resolveRequestedLocation(input?: WeatherLocationInput) {
  const fallback = resolveHomeWeatherLocation();
  const hasInputCoordinates =
    typeof input?.latitude === "number" &&
    Number.isFinite(input.latitude) &&
    typeof input?.longitude === "number" &&
    Number.isFinite(input.longitude);

  if (hasInputCoordinates) {
    return {
      latitude: input!.latitude!,
      longitude: input!.longitude!,
      timezone: normalizeTimezone(input?.timezone ?? fallback.timezone),
      label: normalizeLabel(input?.label ?? fallback.label),
      source: input?.source ?? "browser",
      fallbackUsed: false,
    };
  }

  return {
    latitude: normalizeCoordinate(input?.latitude, fallback.latitude),
    longitude: normalizeCoordinate(input?.longitude, fallback.longitude),
    timezone: normalizeTimezone(input?.timezone ?? fallback.timezone),
    label: normalizeLabel(input?.label ?? fallback.label),
    source: input?.source ?? fallback.source,
    fallbackUsed: true,
  };
}

export async function fetchOpenMeteoWeather(
  input?: WeatherLocationInput,
): Promise<WeatherApiResponse> {
  const resolved = resolveRequestedLocation(input);
  const forecastUrl = new URL(OPEN_METEO_FORECAST_URL);
  forecastUrl.searchParams.set("latitude", String(resolved.latitude));
  forecastUrl.searchParams.set("longitude", String(resolved.longitude));
  forecastUrl.searchParams.set("timezone", resolved.timezone);
  forecastUrl.searchParams.set("temperature_unit", "fahrenheit");
  forecastUrl.searchParams.set("wind_speed_unit", "mph");
  forecastUrl.searchParams.set("precipitation_unit", "inch");
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m",
  );
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );

  const forecastResponse = await fetch(forecastUrl, {
    next: { revalidate: 900 },
  });
  if (!forecastResponse.ok) {
    throw new Error(`open-meteo-forecast-failed:${forecastResponse.status}`);
  }

  const forecastData =
    (await forecastResponse.json()) as OpenMeteoForecastResponse;

  return {
    provider: "open-meteo",
    location: {
      label: resolved.label,
      timezone: resolved.timezone,
    },
    coordinates: {
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    },
    current: {
      temperature: Math.round(forecastData.current?.temperature_2m ?? 0),
      humidity: Math.round(forecastData.current?.relative_humidity_2m ?? 0),
      apparentTemperature: Math.round(
        forecastData.current?.apparent_temperature ??
          forecastData.current?.temperature_2m ??
          0,
      ),
      isDay: Boolean(forecastData.current?.is_day ?? 1),
      precipitation: Number(forecastData.current?.precipitation ?? 0),
      rain: Number(forecastData.current?.rain ?? 0),
      showers: Number(forecastData.current?.showers ?? 0),
      weatherCode: Number(forecastData.current?.weather_code ?? -1),
      summary: weatherSummaryFromCode(forecastData.current?.weather_code),
      cloudCover: Math.round(forecastData.current?.cloud_cover ?? 0),
      windSpeed: Math.round(forecastData.current?.wind_speed_10m ?? 0),
    },
    daily: (forecastData.daily?.time ?? []).map((date, index) => {
      const weatherCode = Number(forecastData.daily?.weather_code?.[index] ?? -1);
      return {
        date,
        weatherCode,
        summary: weatherSummaryFromCode(weatherCode),
        high: Math.round(forecastData.daily?.temperature_2m_max?.[index] ?? 0),
        low: Math.round(forecastData.daily?.temperature_2m_min?.[index] ?? 0),
        precipitationProbabilityMax: Math.round(
          forecastData.daily?.precipitation_probability_max?.[index] ?? 0,
        ),
      };
    }),
    fallbackUsed: resolved.fallbackUsed,
    source: resolved.source,
  };
}

export function toWeatherSummary(data: WeatherApiResponse): Weather {
  return {
    location: data.location.label,
    temperature: data.current.temperature,
    high: data.daily[0]?.high ?? data.current.temperature,
    low: data.daily[0]?.low ?? data.current.temperature,
    condition: data.current.summary,
    icon: "cloud-sun",
    source: "api",
  };
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
      const weatherData = await fetchOpenMeteoWeather();
      return {
        weather: toWeatherSummary(weatherData),
        configured: true,
      };
    } catch {
      return { weather: getEnvWeather(), configured: false };
    }
  }

  return { weather: getEnvWeather(), configured: false };
}
