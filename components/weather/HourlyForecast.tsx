import { CloudSun, Droplets, Wind } from "lucide-react";
import type { HourlyForecast as HourlyForecastItem } from "@/lib/weather/types";

type Props = {
  hourly: HourlyForecastItem[];
  timezone: string;
};

function formatHour(time: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
  }).format(new Date(time));
}

export default function HourlyForecast({ hourly, timezone }: Props) {
  return (
    <section className="weather-detail-card">
      <div className="weather-detail-heading">
        <strong>Next 12 hours</strong>
        <small>Hourly forecast</small>
      </div>
      <div className="weather-hourly-grid">
        {hourly.map((period) => (
          <article key={period.time} className="weather-hourly-item">
            <span>{formatHour(period.time, timezone)}</span>
            <strong>{period.temperature}°</strong>
            <small>{period.summary}</small>
            <div className="weather-inline-stat">
              <CloudSun size={14} />
              <span>{period.label}</span>
            </div>
            <div className="weather-inline-stat">
              <Droplets size={14} />
              <span>
                {typeof period.precipitationChance === "number"
                  ? `${period.precipitationChance}%`
                  : "--"}
              </span>
            </div>
            <div className="weather-inline-stat">
              <Wind size={14} />
              <span>
                {period.windDirection} {period.windSpeed}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
