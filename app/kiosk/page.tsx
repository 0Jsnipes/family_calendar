import { connection } from "next/server";
import { cookies } from "next/headers";
import ClientDashboard from "@/components/ClientDashboard";
import KioskAccessScreen from "@/components/KioskAccessScreen";
import KioskSignInScreen from "@/components/KioskSignInScreen";
import { getCalendarEvents } from "@/lib/calendar";
import { getEnvChores, getEnvFamilyMembers, getEnvMealPlan } from "@/lib/env-data";
import { appConfig } from "@/lib/config";
import { sessionCookieName, verifySessionCookie } from "@/lib/firebase/admin";
import { getHubSummaryForUser, listActiveHubMembers, toFamilyMember } from "@/lib/hub";
import { getWeather } from "@/lib/weather/weatherService";

export default async function KioskPage() {
  await connection();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionCookieName)?.value;
  const currentUser = await verifySessionCookie(sessionCookie);

  if (!currentUser) {
    return <KioskSignInScreen />;
  }

  const hubAccess = await getHubSummaryForUser(currentUser).catch(() => null);
  if (!hubAccess?.member || !hubAccess.hub) {
    return <KioskAccessScreen />;
  }

  const [activeHubMembers, calendar, weather] = await Promise.all([
    listActiveHubMembers().catch(() => []),
    getCalendarEvents().catch(() => ({ events: [], configured: false })),
    getWeather().catch(() => ({
      weather: {
        location: appConfig.locationLabel,
        temperature: 0,
        condition: "Unavailable",
        high: 0,
        low: 0,
        icon: "cloud-off",
        source: "api" as const,
      },
      configured: false,
    })),
  ]);

  const data = {
    familyMembers: activeHubMembers.length
      ? activeHubMembers.map(toFamilyMember)
      : getEnvFamilyMembers(),
    events: calendar.events,
    chores: getEnvChores(),
    mealPlan: getEnvMealPlan(),
    weather: weather.weather,
    lastUpdated: new Date().toISOString(),
    providers: {
      calendarConfigured: calendar.configured,
      weatherConfigured: weather.configured,
    },
  };

  return (
    <ClientDashboard
      data={data}
      initialView="home"
      kioskMode
      currentUser={currentUser}
      currentUserRole={hubAccess.member.role}
    />
  );
}
