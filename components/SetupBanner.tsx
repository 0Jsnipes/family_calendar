"use client";

import { Bell } from "lucide-react";

export default function SetupBanner() {
  return (
    <div className="setup-banner">
      <Bell className="icon" />
      Some integrations are still using mock data. Connect Google Calendar and
      weather later without changing the UI.
    </div>
  );
}
