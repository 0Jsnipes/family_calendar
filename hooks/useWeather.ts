"use client";

import { useEffect, useRef, useState } from "react";
import type { Weather } from "@/types";
import type { WeatherAlert, WeatherResponse } from "@/lib/weather/types";

type WeatherStatus = "loading" | "ready" | "home" | "unavailable";

type WeatherState = {
  status: WeatherStatus;
  weather: Weather;
  forecast: WeatherResponse | null;
  daily: WeatherResponse["daily"];
  hourly: WeatherResponse["hourly"];
  alerts: WeatherAlert[];
  locationLabel: string;
  message: string;
};

const REFRESH_MS = 15 * 60 * 1000;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

const weatherCache = new Map<
  string,
  { expiresAt: number; value: WeatherResponse }
>();
const inFlightWeatherRequests = new Map<string, Promise<WeatherResponse>>();

function toFallbackState(initialWeather: Weather): WeatherState {
  return {
    status: "loading",
    weather: initialWeather,
    forecast: null,
    daily: [],
    hourly: [],
    alerts: [],
    locationLabel: initialWeather.location,
    message: "Loading weather...",
  };
}

function toWeatherSummary(response: WeatherResponse): Weather {
  return {
    location: response.location.label,
    temperature: response.current.temperature,
    condition: response.current.summary,
    high: response.daily[0]?.high ?? response.current.temperature,
    low: response.daily[0]?.low ?? response.current.temperature,
    icon: response.current.icon,
    source: "api",
  };
}

function toWeatherState(response: WeatherResponse): WeatherState {
  const status = response.fallbackUsed ? "home" : "ready";

  return {
    status,
    weather: toWeatherSummary(response),
    forecast: response,
    daily: response.daily,
    hourly: response.hourly,
    alerts: response.alerts,
    locationLabel: response.location.label,
    message: status === "home" ? "Using home weather..." : "",
  };
}

async function requestWeather(url: string) {
  const now = Date.now();
  const cachedResponse = weatherCache.get(url);
  if (cachedResponse && cachedResponse.expiresAt > now) {
    return cachedResponse.value;
  }

  const pendingRequest = inFlightWeatherRequests.get(url);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = fetch(url, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Weather request failed.");
      }

      const payload = (await response.json()) as WeatherResponse;
      weatherCache.set(url, {
        value: payload,
        expiresAt: now + WEATHER_CACHE_MS,
      });
      return payload;
    })
    .finally(() => {
      inFlightWeatherRequests.delete(url);
    });

  inFlightWeatherRequests.set(url, request);
  return request;
}

function buildWeatherUrl(position?: GeolocationPosition) {
  if (!position) {
    return "/api/weather";
  }

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const params = new URLSearchParams({
    lat: String(position.coords.latitude),
    lon: String(position.coords.longitude),
    timezone,
  });

  return `/api/weather?${params.toString()}`;
}

export function useWeather(initialWeather: Weather) {
  const [state, setState] = useState<WeatherState>(() =>
    toFallbackState(initialWeather),
  );
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const dismissedAlertIdsRef = useRef<string[]>([]);

  useEffect(() => {
    dismissedAlertIdsRef.current = dismissedAlertIds;
  }, [dismissedAlertIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather(position?: GeolocationPosition) {
      try {
        const response = await requestWeather(buildWeatherUrl(position));
        if (cancelled) return;

        const nextState = toWeatherState(response);
        setState({
          ...nextState,
          alerts: nextState.alerts.filter(
            (alert) => !dismissedAlertIdsRef.current.includes(alert.id),
          ),
        });
      } catch {
        if (cancelled) return;
        setState((currentState) => ({
          ...currentState,
          status: "unavailable",
          forecast: null,
          message: "Weather data is temporarily unavailable.",
        }));
      }
    }

    function loadFallbackWeather() {
      void loadWeather();
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      loadFallbackWeather();
    } else {
      navigator.geolocation.getCurrentPosition(loadWeather, loadFallbackWeather, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 1000 * 60 * 30,
      });
    }

    const intervalId = window.setInterval(() => {
      weatherCache.clear();

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        loadFallbackWeather();
        return;
      }

      navigator.geolocation.getCurrentPosition(loadWeather, loadFallbackWeather, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 1000 * 60 * 30,
      });
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  function dismissAlert(alertId: string) {
    setDismissedAlertIds((currentIds) => [...currentIds, alertId]);
    setState((currentState) => ({
      ...currentState,
      alerts: currentState.alerts.filter((alert) => alert.id !== alertId),
    }));
  }

  return {
    ...state,
    dismissAlert,
  };
}
