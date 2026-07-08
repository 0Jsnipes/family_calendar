"use client";

import { AlertTriangle, X } from "lucide-react";
import type { WeatherAlert } from "@/lib/weather/types";

type Props = {
  alerts: WeatherAlert[];
  onDismiss: (alertId: string) => void;
};

export default function WeatherAlerts({ alerts, onDismiss }: Props) {
  if (!alerts.length) return null;

  return (
    <div className="weather-alerts" aria-live="polite">
      {alerts.map((alert) => (
        <article key={alert.id} className="weather-alert">
          <div className="weather-alert-heading">
            <div>
              <span className="weather-alert-badge">
                <AlertTriangle size={15} />
                {alert.severity}
              </span>
              <h3>{alert.headline}</h3>
              <p>{alert.event}{alert.area ? ` · ${alert.area}` : ""}</p>
            </div>
            <button
              type="button"
              className="weather-alert-dismiss"
              onClick={() => onDismiss(alert.id)}
              aria-label={`Dismiss ${alert.headline}`}
            >
              <X size={16} />
            </button>
          </div>
          <p>{alert.description}</p>
          {alert.instruction ? (
            <p className="weather-alert-instruction">{alert.instruction}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
