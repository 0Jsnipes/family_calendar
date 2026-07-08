export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Family Hub",
  timezone: process.env.NEXT_PUBLIC_HOME_TIMEZONE ?? "America/New_York",
  locationLabel:
    process.env.NEXT_PUBLIC_HOME_LOCATION_LABEL ?? "Myrtle Beach, SC",
  homeLatitude: Number(process.env.NEXT_PUBLIC_HOME_LAT ?? "33.6891"),
  homeLongitude: Number(process.env.NEXT_PUBLIC_HOME_LON ?? "-78.8867"),
  kioskMode: process.env.NEXT_PUBLIC_KIOSK_MODE !== "false",
  enableVoice: process.env.NEXT_PUBLIC_ENABLE_VOICE === "true",
  enableChores: process.env.NEXT_PUBLIC_ENABLE_CHORES !== "false",
  enableMeals: process.env.NEXT_PUBLIC_ENABLE_MEALS !== "false",
  enablePhotos: process.env.NEXT_PUBLIC_ENABLE_PHOTOS === "true",
  weatherProvider: process.env.NEXT_PUBLIC_WEATHER_PROVIDER ?? "",
  nightModeStartHour: 21,
  nightModeEndHour: 6,
};

export const serverConfig = {
  hubOwnerEmails: (process.env.HUB_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  defaultHubName: process.env.DEFAULT_HUB_NAME ?? "Family Hub",
  firebaseMailCollection: process.env.FIREBASE_MAIL_COLLECTION ?? "mail",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
  googleCalendarIds: (process.env.GOOGLE_CALENDAR_IDS ?? "primary")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ?? "",
  weatherApiKey: process.env.WEATHER_API_KEY ?? "",
  familyMembersJson: process.env.FAMILY_MEMBERS_JSON ?? "",
  choresJson: process.env.CHORES_JSON ?? "",
  mealPlanJson: process.env.MEAL_PLAN_JSON ?? "",
  weatherJson: process.env.WEATHER_JSON ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
