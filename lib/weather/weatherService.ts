import "server-only";

import { appConfig } from "@/lib/config";
import { getOrSetCache } from "./cache";
import type {
  ForecastPeriod,
  HourlyForecast,
  NwsAlertsResponse,
  NwsForecastPeriod,
  NwsForecastResponse,
  NwsPointsResponse,
  WeatherAlert,
  WeatherResponse,
  WeatherServiceOptions,
  WeatherSummary,
} from "./types";

const NWS_HEADERS = {
  "User-Agent": "Family Hub (snipes1995@gmail.com)",
  Accept: "application/geo+json",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

function roundCoordinate(value: number) {
  return Number(value.toFixed(4));
}

function getFallbackLocation() {
  return {
    latitude: Number.isFinite(appConfig.homeLatitude)
      ? appConfig.homeLatitude
      : 33.6891,
    longitude: Number.isFinite(appConfig.homeLongitude)
      ? appConfig.homeLongitude
      : -78.8867,
    timezone: appConfig.timezone || "America/New_York",
    label: appConfig.locationLabel || "Myrtle Beach, SC",
  };
}

function normalizeOptions(options?: WeatherServiceOptions) {
  const fallback = getFallbackLocation();
  const hasCoordinates =
    typeof options?.latitude === "number" &&
    Number.isFinite(options.latitude) &&
    typeof options?.longitude === "number" &&
    Number.isFinite(options.longitude);

  return {
    latitude: hasCoordinates ? options!.latitude! : fallback.latitude,
    longitude: hasCoordinates ? options!.longitude! : fallback.longitude,
    timezone: options?.timezone?.trim() || fallback.timezone,
    label: options?.locationLabel?.trim() || fallback.label,
    fallbackUsed: !hasCoordinates,
    source: hasCoordinates ? options?.source ?? "browser" : "home",
  } as const;
}

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const response = await fetch(url, {
    headers: NWS_HEADERS,
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`weather.gov request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function resolvePoints(latitude: number, longitude: number) {
  const key = `points:${roundCoordinate(latitude)},${roundCoordinate(longitude)}`;
  const url = `https://api.weather.gov/points/${latitude},${longitude}`;

  return getOrSetCache(key, DAY_MS, () =>
    fetchJson<NwsPointsResponse>(url, 60 * 60 * 24),
  );
}

async function loadForecast(url: string) {
  return getOrSetCache(`forecast:${url}`, TEN_MINUTES_MS, () =>
    fetchJson<NwsForecastResponse>(url, 60 * 10),
  );
}

async function loadAlerts(latitude: number, longitude: number) {
  const url = `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`;

  return getOrSetCache(`alerts:${roundCoordinate(latitude)},${roundCoordinate(longitude)}`, FIVE_MINUTES_MS, () =>
    fetchJson<NwsAlertsResponse>(url, 60 * 5),
  );
}

function formatLocationLabel(
  requestedLabel: string,
  points: NwsPointsResponse,
) {
  const city = points.properties.relativeLocation?.properties?.city?.trim();
  const state = points.properties.relativeLocation?.properties?.state?.trim();

  if (city && state) {
    return `${city}, ${state}`;
  }

  return requestedLabel;
}

function periodDateKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function periodDayLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mapHourlyForecast(periods: NwsForecastPeriod[]): HourlyForecast[] {
  return periods.slice(0, 12).map((period) => ({
    time: period.startTime,
    label: period.name,
    temperature: period.temperature,
    precipitationChance:
      typeof period.probabilityOfPrecipitation?.value === "number"
        ? Math.round(period.probabilityOfPrecipitation.value)
        : null,
    windSpeed: period.windSpeed,
    windDirection: period.windDirection,
    icon: period.icon,
    summary: period.shortForecast,
  }));
}

function mapDailyForecast(
  periods: NwsForecastPeriod[],
  timezone: string,
): ForecastPeriod[] {
  const dailyMap = new Map<string, ForecastPeriod>();

  for (const period of periods) {
    const date = periodDateKey(period.startTime, timezone);
    const existing = dailyMap.get(date);

    if (!existing) {
      dailyMap.set(date, {
        date,
        label: periodDayLabel(period.startTime, timezone),
        summary: period.shortForecast,
        icon: period.icon,
        high: period.isDaytime ? period.temperature : period.temperature,
        low: period.isDaytime ? period.temperature : period.temperature,
      });
      continue;
    }

    dailyMap.set(date, {
      ...existing,
      summary:
        existing.summary === "Overnight"
          ? period.shortForecast
          : existing.summary,
      icon: existing.icon || period.icon,
      high: Math.max(existing.high, period.temperature),
      low: Math.min(existing.low, period.temperature),
    });
  }

  return Array.from(dailyMap.values()).slice(0, 7);
}

function mapAlerts(response: NwsAlertsResponse): WeatherAlert[] {
  return response.features.map((feature) => ({
    id: feature.id,
    headline: feature.properties.headline?.trim() || "Weather alert",
    severity: feature.properties.severity?.trim() || "Unknown",
    description: feature.properties.description?.trim() || "No details provided.",
    instruction: feature.properties.instruction?.trim() || "",
    area: feature.properties.areaDesc?.trim() || "",
    event: feature.properties.event?.trim() || "",
  }));
}

export async function getWeatherResponse(
  options?: WeatherServiceOptions,
): Promise<WeatherResponse> {
  const normalized = normalizeOptions(options);

  try {
    const points = await resolvePoints(normalized.latitude, normalized.longitude);
    const timezone = points.properties.timeZone?.trim() || normalized.timezone;
    const locationLabel = formatLocationLabel(normalized.label, points);

    const [hourlyResponse, dailyResponse, alertsResponse] = await Promise.all([
      loadForecast(points.properties.forecastHourly),
      loadForecast(points.properties.forecast),
      loadAlerts(normalized.latitude, normalized.longitude),
    ]);

    const hourly = mapHourlyForecast(hourlyResponse.properties.periods);
    const daily = mapDailyForecast(dailyResponse.properties.periods, timezone);
    const currentPeriod = hourlyResponse.properties.periods[0];

    if (!currentPeriod) {
      throw new Error("weather.gov returned no hourly forecast periods");
    }

    return {
      provider: "weather.gov",
      location: {
        label: locationLabel,
        timezone,
      },
      coordinates: {
        latitude: normalized.latitude,
        longitude: normalized.longitude,
      },
      current: {
        temperature: currentPeriod.temperature,
        summary: currentPeriod.shortForecast,
        windSpeed: currentPeriod.windSpeed,
        windDirection: currentPeriod.windDirection,
        humidity:
          typeof currentPeriod.relativeHumidity?.value === "number"
            ? Math.round(currentPeriod.relativeHumidity.value)
            : null,
        icon: currentPeriod.icon,
      },
      hourly,
      daily,
      alerts: mapAlerts(alertsResponse),
      fallbackUsed: normalized.fallbackUsed,
      source: normalized.source,
    };
  } catch (error) {
    if (normalized.source === "browser") {
      return getWeatherResponse({
        source: "home",
      });
    }

    throw error;
  }
}

export async function getWeather() {
  const weatherResponse = await getWeatherResponse({
    source: "home",
  });

  return {
    configured: true,
    weather: toWeatherSummary(weatherResponse),
  };
}

export function toWeatherSummary(weather: WeatherResponse): WeatherSummary {
  return {
    location: weather.location.label,
    temperature: weather.current.temperature,
    condition: weather.current.summary,
    high: weather.daily[0]?.high ?? weather.current.temperature,
    low: weather.daily[0]?.low ?? weather.current.temperature,
    icon: weather.current.icon,
    source: "api",
  };
}
