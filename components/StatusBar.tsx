"use client";

import { CalendarDays, Clock3, CloudSun, Wifi, WifiOff } from "lucide-react";
import { formatClock, formatDateLabel } from "@/lib/date";

type Props = {
  now: Date;
  timeZone: string;
  weatherLabel: string;
  calendarConfigured: boolean;
  locationLabel: string;
};

export default function StatusBar({
  now,
  timeZone,
  weatherLabel,
  calendarConfigured,
  locationLabel,
}: Props) {
  return (
    <section className="dashboard-topbar">
      <div>
        <p className="eyebrow">Family Hub</p>
        <h1>Home Command Center</h1>
        <p className="subtle">{locationLabel}</p>
      </div>
      <div className="status-cluster" aria-label="Status">
        <span>
          <Clock3 className="icon" />
          {formatClock(now, timeZone)}
        </span>
        <span>
          <CalendarDays className="icon" />
          {formatDateLabel(now, timeZone)}
        </span>
        <span>
          <CloudSun className="icon" />
          {weatherLabel}
        </span>
        <span>
          {calendarConfigured ? (
            <Wifi className="icon" />
          ) : (
            <WifiOff className="icon" />
          )}
          {calendarConfigured ? "Connected" : "Mock mode"}
        </span>
      </div>
    </section>
  );
}
