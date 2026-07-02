"use client";

import { Bell } from "lucide-react";

export default function SetupBanner() {
  return (
    <div className="setup-banner">
      <Bell className="icon" />
      Calendar and weather can stay disconnected for now. Family members, chores,
      and meals now load from environment data without changing the UI.
    </div>
  );
}
