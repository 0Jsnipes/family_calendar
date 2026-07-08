import { CloudSun, Thermometer, ThermometerSnowflake } from "lucide-react";
import type { ForecastPeriod } from "@/lib/weather/types";

type Props = {
  daily: ForecastPeriod[];
};

export default function DailyForecast({ daily }: Props) {
  return (
    <section className="weather-detail-card">
      <div className="weather-detail-heading">
        <strong>Next 7 days</strong>
        <small>Daily forecast</small>
      </div>
      <div className="weather-daily-list">
        {daily.map((period) => (
          <article key={period.date} className="weather-daily-item">
            <div>
              <strong>{period.label}</strong>
              <small>{period.summary}</small>
            </div>
            <div className="weather-daily-meta">
              <span className="weather-inline-stat">
                <CloudSun size={14} />
                Forecast
              </span>
              <span className="weather-inline-stat">
                <Thermometer size={14} />
                {period.high}°
              </span>
              <span className="weather-inline-stat">
                <ThermometerSnowflake size={14} />
                {period.low}°
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
