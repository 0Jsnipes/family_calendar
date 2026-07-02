import { connection } from "next/server";
import { cookies } from "next/headers";
import ClientDashboard from "@/components/ClientDashboard";
import HubAccessScreen from "@/components/HubAccessScreen";
import SignInScreen from "@/components/SignInScreen";
import { appConfig } from "@/lib/config";
import { getCalendarEvents } from "@/lib/calendar";
import { getEnvChores, getEnvFamilyMembers, getEnvMealPlan } from "@/lib/env-data";
import { sessionCookieName, verifySessionCookie } from "@/lib/firebase/admin";
import { getHubSummaryForUser, listActiveHubMembers, toFamilyMember } from "@/lib/hub";
import { getWeather } from "@/lib/weather";

function getViewFromSearchParams(searchParams?: {
  view?: string | string[];
  kiosk?: string | string[];
}) {
  const view = Array.isArray(searchParams?.view)
    ? searchParams?.view[0]
    : searchParams?.view;
  return view === "today" || view === "week" || view === "month"
    ? view
    : "home";
}

function getKioskFromSearchParams(searchParams?: {
  view?: string | string[];
  kiosk?: string | string[];
}) {
  const kiosk = Array.isArray(searchParams?.kiosk)
    ? searchParams?.kiosk[0]
    : searchParams?.kiosk;
  if (kiosk === "true") return true;
  if (kiosk === "false") return false;
  return appConfig.kioskMode;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string | string[];
    kiosk?: string | string[];
  }>;
}) {
  await connection();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionCookieName)?.value;
  const currentUser = await verifySessionCookie(sessionCookie);

  if (!currentUser) {
    return <SignInScreen />;
  }

  let hubAccess;
  try {
    hubAccess = await getHubSummaryForUser(currentUser);
  } catch {
    return <HubAccessScreen hasPendingInvite={false} />;
  }
  if (!hubAccess.member || !hubAccess.hub) {
    return (
      <HubAccessScreen
        hasPendingInvite={hubAccess.pendingInvites.length > 0}
        pendingInviteId={hubAccess.pendingInvites[0]?.id}
      />
    );
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
      initialView={getViewFromSearchParams(resolvedSearchParams)}
      kioskMode={getKioskFromSearchParams(resolvedSearchParams)}
      currentUser={currentUser}
      currentUserRole={hubAccess.member.role}
    />
  );
}
