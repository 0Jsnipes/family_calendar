import { CloudSun, Droplets, MapPin, Wind } from "lucide-react";
import type { WeatherResponse } from "@/lib/weather/types";

type Props = {
  weather: WeatherResponse | null;
  message: string;
};

export default function WeatherCard({ weather, message }: Props) {
  if (!weather) {
    return (
      <section className="weather-hero-card">
        <div className="weather-hero-copy">
          <p className="eyebrow">Weather</p>
          <h3>{message}</h3>
          <p className="page-subtitle">The widget will retry automatically.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="weather-hero-card">
      <div className="weather-hero-copy">
        <p className="eyebrow">Weather</p>
        <h3>{weather.current.temperature}° and {weather.current.summary}</h3>
        <p className="page-subtitle">
          <MapPin size={15} />
          {weather.location.label}
        </p>
      </div>
      <div className="weather-hero-stats">
        <span className="weather-stat-pill">
          <CloudSun size={16} />
          {weather.daily[0]?.high ?? weather.current.temperature}° /{" "}
          {weather.daily[0]?.low ?? weather.current.temperature}°
        </span>
        <span className="weather-stat-pill">
          <Wind size={16} />
          {weather.current.windDirection} {weather.current.windSpeed}
        </span>
        <span className="weather-stat-pill">
          <Droplets size={16} />
          {typeof weather.current.humidity === "number"
            ? `${weather.current.humidity}% humidity`
            : "Humidity unavailable"}
        </span>
      </div>
    </section>
  );
}
