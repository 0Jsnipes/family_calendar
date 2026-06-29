export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Family Hub",
  timezone: process.env.NEXT_PUBLIC_HOME_TIMEZONE ?? "America/New_York",
  locationLabel:
    process.env.NEXT_PUBLIC_HOME_LOCATION_LABEL ?? "Myrtle Beach, SC",
  kioskMode: process.env.NEXT_PUBLIC_KIOSK_MODE !== "false",
  enableVoice: process.env.NEXT_PUBLIC_ENABLE_VOICE === "true",
  enableChores: process.env.NEXT_PUBLIC_ENABLE_CHORES !== "false",
  enableMeals: process.env.NEXT_PUBLIC_ENABLE_MEALS !== "false",
  enablePhotos: process.env.NEXT_PUBLIC_ENABLE_PHOTOS === "true",
  weatherProvider:
    process.env.NEXT_PUBLIC_WEATHER_PROVIDER ?? "mock",
  nightModeStartHour: 21,
  nightModeEndHour: 6,
};

export const serverConfig = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
  googleCalendarIds: (process.env.GOOGLE_CALENDAR_IDS ?? "primary")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  googleCalendarApiKey: process.env.GOOGLE_CALENDAR_API_KEY ?? "",
  weatherApiKey: process.env.WEATHER_API_KEY ?? "",
};

export function isNightMode(date: Date, timezone = appConfig.timezone) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  }).format(date);
  const currentHour = Number(hour);
  return (
    currentHour >= appConfig.nightModeStartHour ||
    currentHour < appConfig.nightModeEndHour
  );
}
