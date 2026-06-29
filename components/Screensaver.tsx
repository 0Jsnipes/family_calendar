"use client";

import { formatClock, formatDateLabel } from "@/lib/date";
import type { Weather } from "@/types";

type Props = {
  now: Date;
  timeZone: string;
  nextEventTitle?: string;
  weather: Weather;
};

export default function Screensaver({
  now,
  timeZone,
  nextEventTitle,
  weather,
}: Props) {
  return (
    <main className="ambient-screensaver">
      <div className="screensaver-glow" />
      <section className="screensaver-card">
        <p className="eyebrow">Family Hub</p>
        <h1>{formatClock(now, timeZone)}</h1>
        <p>{formatDateLabel(now, timeZone)}</p>
        <p className="mt-6 text-2xl font-semibold">
          {nextEventTitle ?? "No events soon"}
        </p>
        <p className="mt-2 text-lg opacity-80">
          {weather.condition} {weather.temperature}°
        </p>
      </section>
    </main>
  );
}
