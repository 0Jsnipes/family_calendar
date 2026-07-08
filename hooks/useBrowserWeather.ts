"use client";

import { useEffect, useState } from "react";
import { appConfig } from "@/lib/config";
import type { Weather, WeatherApiResponse } from "@/types";

type WeatherStatus = "loading" | "ready" | "home" | "unavailable";

type BrowserWeatherState = {
  weather: Weather;
  daily: WeatherApiResponse["daily"];
  status: WeatherStatus;
};

function isWeatherApiResponse(payload: unknown): payload is WeatherApiResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return (
    "provider" in payload &&
    "location" in payload &&
    "coordinates" in payload &&
    "current" in payload &&
    "daily" in payload
  );
}

function toWeatherSummary(data: WeatherApiResponse): Weather {
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

async function fetchWeather(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok || !isWeatherApiResponse(payload)) {
    throw new Error(
      payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : payload &&
            typeof payload === "object" &&
            "details" in payload &&
            typeof payload.details === "string"
          ? payload.details
          : "Unable to load weather.",
    );
  }

  return payload;
}

export function useBrowserWeather(initialWeather: Weather) {
  const [state, setState] = useState<BrowserWeatherState>({
    weather: initialWeather,
    daily: [],
    status: "loading",
  });

  useEffect(() => {
    let ignore = false;

    async function loadHomeWeather() {
      try {
        const payload = await fetchWeather("/api/weather");
        if (ignore) return;
        setState({
          weather: toWeatherSummary(payload),
          daily: payload.daily,
          status: payload.fallbackUsed ? "home" : "ready",
        });
      } catch {
        if (ignore) return;
        setState((current) => ({
          ...current,
          status: "unavailable",
        }));
      }
    }

    async function loadBrowserWeather(position: GeolocationPosition) {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "auto";
      const searchParams = new URLSearchParams({
        lat: String(position.coords.latitude),
        lon: String(position.coords.longitude),
        timezone,
      });

      try {
        const payload = await fetchWeather(`/api/weather?${searchParams.toString()}`);
        if (ignore) return;
        setState({
          weather: {
            ...toWeatherSummary(payload),
            location: payload.location.label || appConfig.locationLabel,
          },
          daily: payload.daily,
          status: payload.fallbackUsed ? "home" : "ready",
        });
      } catch {
        if (!ignore) {
          void loadHomeWeather();
        }
      }
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      void loadHomeWeather();
      return () => {
        ignore = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadBrowserWeather(position);
      },
      () => {
        void loadHomeWeather();
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 1000 * 60 * 30,
      },
    );

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
