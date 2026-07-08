export type WeatherSource = "browser" | "home" | "default";

export type WeatherSummary = {
  location: string;
  temperature: number;
  condition: string;
  high?: number;
  low?: number;
  icon?: string;
  source: "api";
};

export interface ForecastPeriod {
  date: string;
  label: string;
  summary: string;
  icon: string;
  high: number;
  low: number;
}

export interface HourlyForecast {
  time: string;
  label: string;
  temperature: number;
  precipitationChance: number | null;
  windSpeed: string;
  windDirection: string;
  icon: string;
  summary: string;
}

export interface WeatherAlert {
  id: string;
  headline: string;
  severity: string;
  description: string;
  instruction: string;
  area: string;
  event: string;
}

export interface WeatherCurrent {
  temperature: number;
  summary: string;
  windSpeed: string;
  windDirection: string;
  humidity: number | null;
  icon: string;
}

export interface WeatherResponse {
  provider: "weather.gov";
  location: {
    label: string;
    timezone: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  current: WeatherCurrent;
  hourly: HourlyForecast[];
  daily: ForecastPeriod[];
  alerts: WeatherAlert[];
  fallbackUsed: boolean;
  source: WeatherSource;
}

export interface WeatherServiceOptions {
  latitude?: number;
  longitude?: number;
  timezone?: string | null;
  locationLabel?: string | null;
  source?: WeatherSource;
}

export interface NwsPointsResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    relativeLocation?: {
      properties?: {
        city?: string;
        state?: string;
      };
    };
    timeZone?: string;
  };
}

export interface NwsForecastResponse {
  properties: {
    periods: NwsForecastPeriod[];
  };
}

export interface NwsForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation?: {
    value: number | null;
  };
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
  relativeHumidity?: {
    value: number | null;
  };
}

export interface NwsAlertsResponse {
  features: Array<{
    id: string;
    properties: {
      headline?: string;
      severity?: string;
      description?: string;
      instruction?: string;
      areaDesc?: string;
      event?: string;
    };
  }>;
}
