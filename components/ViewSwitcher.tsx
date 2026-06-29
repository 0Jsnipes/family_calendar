"use client";

import { CalendarPlus, Settings, Volume2 } from "lucide-react";
import type { DisplayView } from "@/types";

type Props = {
  view: DisplayView;
  onChange: (view: DisplayView) => void;
  voiceEnabled: boolean;
};

const views: DisplayView[] = ["home", "today", "week", "month"];

export default function ViewSwitcher({
  view,
  onChange,
  voiceEnabled,
}: Props) {
  return (
    <section className="view-switcher">
      {views.map((item) => (
        <button
          key={item}
          className={view === item ? "active" : ""}
          onClick={() => onChange(item)}
        >
          {item === "home" ? "Home Board" : item.charAt(0).toUpperCase() + item.slice(1)}
        </button>
      ))}
      <button className="ghost">
        <Settings className="icon" /> Settings
      </button>
      <button className="ghost" disabled={!voiceEnabled}>
        <Volume2 className="icon" /> Voice
      </button>
      <button className="primary">
        <CalendarPlus className="icon" /> Add Event
      </button>
    </section>
  );
}
