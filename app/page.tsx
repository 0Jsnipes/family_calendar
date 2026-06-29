import ClientDashboard from "@/components/ClientDashboard";
import { appConfig } from "@/lib/config";
import { getCalendarEvents } from "@/lib/calendar";
import { getChores, getFamilyMembers, getMealPlan } from "@/lib/mock-data";
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
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [calendar, weather] = await Promise.all([
    getCalendarEvents(),
    getWeather(),
  ]);
  const data = {
    familyMembers: getFamilyMembers(),
    events: calendar.events,
    chores: getChores(),
    mealPlan: getMealPlan(),
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
    />
  );
}
