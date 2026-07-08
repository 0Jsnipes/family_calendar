"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  CloudSun,
  Home,
  LogIn,
  Palette,
  Plus,
  Settings2,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { appConfig } from "@/lib/config";
import DailyForecast from "@/components/weather/DailyForecast";
import HourlyForecast from "@/components/weather/HourlyForecast";
import WeatherAlerts from "@/components/weather/WeatherAlerts";
import WeatherCard from "@/components/weather/WeatherCard";
import { useHubDirectory } from "@/hooks/useHubDirectory";
import {
  useRoutineTasks,
  type RoutineTask,
} from "@/hooks/useRoutineTasks";
import { useWeather } from "@/hooks/useWeather";
import type { ForecastPeriod } from "@/lib/weather/types";
import {
  addDays,
  formatDateLabel,
  formatMonthLabel,
  formatShortDate,
  toDateKey,
} from "@/lib/date";
import type {
  AppData,
  AuthenticatedUser,
  CalendarEvent,
  Chore,
  DisplayView,
  FamilyMember,
  HubMemberRecord,
  Weather,
} from "@/types";
import Screensaver from "./Screensaver";
import GoogleCalendarSync from "./GoogleCalendarSync";
import SignOutButton from "./SignOutButton";

const MAX_ROUTINE_TASKS = 4;
const MAX_DRAWER_TASKS = 12;
const MAX_VISIBLE_EVENTS = 8;
const SETTINGS_STORAGE_KEY = "family-hub-settings";
const NOTES_STORAGE_KEY = "family-hub-notes";

const ACCENT_OPTIONS = [
  { name: "Ocean", value: "#2563eb", soft: "#dbeafe" },
  { name: "Violet", value: "#7c3aed", soft: "#ede9fe" },
  { name: "Berry", value: "#db2777", soft: "#fce7f3" },
  { name: "Citrus", value: "#d97706", soft: "#fef3c7" },
  { name: "Forest", value: "#059669", soft: "#d1fae5" },
] as const;

const NOTE_COLORS = ["#fff2b8", "#dff4ff", "#fce1ec", "#e4f7df"];

type Props = {
  data: AppData;
  initialView: DisplayView;
  kioskMode: boolean;
  currentUser: AuthenticatedUser;
  currentUserRole: "owner" | "admin" | "member" | "child" | "local";
};

type CalendarMode = "week" | "month";

type DailyWeather = {
  label: string;
  temp: number;
  unitLabel?: string;
};

type FamilyNote = {
  id: string;
  text: string;
  color: string;
  createdAt: string;
};

type EventComposerState = {
  title: string;
  location: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
};

type HubSettings = {
  accent: string;
  idleMinutes: number;
  clock24: boolean;
  showWeather: boolean;
  reducedMotion: boolean;
  accountConnected: boolean;
};

function useClock(initialTime: string) {
  const [now, setNow] = useState(() => new Date(initialTime));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function ownerFor(familyMembers: FamilyMember[], ownerId?: string) {
  return (
    familyMembers.find((member) => member.id === ownerId) ??
    familyMembers.find((member) => member.id === "family") ??
    familyMembers[0]
  );
}

function eventTimeLabel(
  event: CalendarEvent,
  timeZone: string,
  clock24: boolean,
) {
  if (event.allDay) return "All day";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: !clock24,
  }).format(new Date(event.start));
}

function formatHubClock(date: Date, timeZone: string, clock24: boolean) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: !clock24,
  }).format(date);
}

function toRoutineTasks(chores: Chore[]): RoutineTask[] {
  const createdAt = new Date(0).toISOString();

  return chores.map((chore) => ({
    ...chore,
    createdAt,
  }));
}

function getStartOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function getStartOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatTimeForInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function getDefaultEventComposerState(date: Date): EventComposerState {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(date);
  end.setHours(10, 0, 0, 0);

  return {
    title: "",
    location: "",
    allDay: false,
    startTime: formatTimeForInput(start),
    endTime: formatTimeForInput(end),
  };
}

function buildEventIso(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  ).toISOString();
}

function buildAllDayEventIso(date: Date, dayOffset = 0) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    12,
    0,
    0,
    0,
  ).toISOString();
}

function getMonthDays(date: Date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = getStartOfWeek(firstOfMonth);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getForecastForDate(
  date: Date,
  weather: Weather,
  dailyForecast: ForecastPeriod[],
  todayKey: string,
): DailyWeather {
  const dateKey = toDateKey(date, appConfig.timezone);
  if (dateKey === todayKey) {
    return {
      label: weather.condition,
      temp: weather.temperature,
      unitLabel: "Now",
    };
  }

  const matchingForecast = dailyForecast.find((entry) => entry.date === dateKey);

  if (matchingForecast) {
    return {
      label: matchingForecast.summary,
      temp: matchingForecast.high,
      unitLabel: "Hi",
    };
  }

  const conditions = [
    "Sunny",
    "Partly sunny",
    "Cloudy",
    "Passing showers",
    "Mostly sunny",
  ];
  const baseTemp = weather.high ?? weather.temperature;
  const seed = date.getDate() + date.getMonth() * 3;
  const variation = [0, 2, -1, 3, -2, 1, -3][seed % 7] ?? 0;

  return {
    label: conditions[seed % conditions.length],
    temp: Math.round(baseTemp + variation),
    unitLabel: "Hi",
  };
}

function getCalendarTitle(mode: CalendarMode, selectedDate: Date) {
  if (mode === "month") return formatMonthLabel(selectedDate, appConfig.timezone);

  const start = getStartOfWeek(selectedDate);
  const end = addDays(start, 6);
  const startMonth = new Intl.DateTimeFormat("en-US", {
    timeZone: appConfig.timezone,
    month: "short",
  }).format(start);
  const endMonth = new Intl.DateTimeFormat("en-US", {
    timeZone: appConfig.timezone,
    month: "short",
  }).format(end);

  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}–${end.getDate()}`
    : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: appConfig.timezone,
    weekday: "short",
  }).format(date);
}

export default function ClientDashboard({
  data,
  initialView,
  kioskMode,
  currentUser,
  currentUserRole,
}: Props) {
  const now = useClock(data.lastUpdated);
  const browserWeather = useWeather(data.weather);
  const activeWeather = browserWeather.weather;
  const todayKey = toDateKey(now, appConfig.timezone);
  const defaultTasks = useMemo(() => toRoutineTasks(data.chores), [data.chores]);
  const defaultSettings = useMemo<HubSettings>(
    () => ({
      accent: ACCENT_OPTIONS[0].value,
      idleMinutes: kioskMode ? 2 : 5,
      clock24: false,
      showWeather: true,
      reducedMotion: false,
      accountConnected: data.providers.calendarConfigured,
    }),
    [data.providers.calendarConfigured, kioskMode],
  );

  const [activePage, setActivePage] = useState(0);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(
    initialView === "month" ? "month" : "week",
  );
  const [selectedDate, setSelectedDate] = useState(now);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [isAsleep, setIsAsleep] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(() => Date.now());
  const [settings, setSettings] = useState<HubSettings>(defaultSettings);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [notes, setNotes] = useState<FamilyNote[]>([]);
  const [hasLoadedNotes, setHasLoadedNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(data.events);
  const [isEventComposerOpen, setIsEventComposerOpen] = useState(false);
  const [eventComposer, setEventComposer] = useState<EventComposerState>(() =>
    getDefaultEventComposerState(now),
  );
  const [eventPending, setEventPending] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("local");
  const [memberColor, setMemberColor] = useState<string>(ACCENT_OPTIONS[1].value);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountRole, setAccountRole] = useState<"admin" | "member">("member");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountPending, setAccountPending] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const {
    firebaseUser,
    members: hubMembers,
    invites,
    loading: directoryLoading,
    error: directoryError,
    addLocalMember,
    removeMember,
    inviteMember,
    revokeInvite,
  } = useHubDirectory();
  const allMembers = useMemo(() => {
    if (!hubMembers.length) return data.familyMembers;

    return hubMembers.map((member) => ({
      id: member.id,
      name: member.displayName,
      role: member.role,
      initials: member.displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      color: member.color,
      memberType: member.type,
      email: member.email,
      status: member.status,
      calendarConnected: member.calendarConnected,
      showCalendarOnHub: member.showCalendarOnHub,
      uid: member.uid,
    }));
  }, [data.familyMembers, hubMembers]);
  const familyOwner = ownerFor(allMembers, "family");
  const canManageMembers =
    currentUserRole === "owner" || currentUserRole === "admin";
  const { tasks, loading: tasksLoading, error: tasksError, addTask, toggleTask, deleteTask, resetTasks } =
    useRoutineTasks(todayKey, defaultTasks);

  useEffect(() => {
    const loadSettings = window.setTimeout(() => {
      const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (savedSettings) {
        try {
          setSettings({
            ...defaultSettings,
            ...(JSON.parse(savedSettings) as HubSettings),
          });
        } catch {
          setSettings(defaultSettings);
        }
      }

      setHasLoadedSettings(true);
    }, 0);

    return () => window.clearTimeout(loadSettings);
  }, [defaultSettings]);

  useEffect(() => {
    if (!hasLoadedSettings) return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    const accent =
      ACCENT_OPTIONS.find((option) => option.value === settings.accent) ??
      ACCENT_OPTIONS[0];
    document.documentElement.style.setProperty("--accent", accent.value);
    document.documentElement.style.setProperty("--accent-soft", accent.soft);
    document.documentElement.dataset.reduceMotion = String(settings.reducedMotion);
  }, [hasLoadedSettings, settings]);

  useEffect(() => {
    const loadNotes = window.setTimeout(() => {
      const savedNotes = window.localStorage.getItem(NOTES_STORAGE_KEY);

      if (savedNotes) {
        try {
          setNotes(JSON.parse(savedNotes) as FamilyNote[]);
        } catch {
          setNotes([]);
        }
      }

      setHasLoadedNotes(true);
    }, 0);

    return () => window.clearTimeout(loadNotes);
  }, []);

  useEffect(() => {
    if (!hasLoadedNotes) return;
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [hasLoadedNotes, notes]);

  useEffect(() => {
    if (settings.idleMinutes === 0) {
      return;
    }

    const idleMs = settings.idleMinutes * 60 * 1000;
    const interval = window.setInterval(() => {
      setIsAsleep(Date.now() - lastInteraction >= idleMs);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lastInteraction, settings.idleMinutes]);

  useEffect(() => {
    const wake = () => {
      setLastInteraction(Date.now());
      setIsAsleep(false);
    };

    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);

    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsRoutineOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      const boundedPage = Math.max(0, Math.min(3, page));
      const carousel = carouselRef.current;
      setActivePage(boundedPage);
      carousel?.scrollTo({
        left: carousel.clientWidth * boundedPage,
        behavior: settings.reducedMotion ? "auto" : "smooth",
      });
    },
    [settings.reducedMotion],
  );

  useEffect(() => {
    const changePageWithArrow = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;

      if (event.key === "ArrowLeft" && activePage > 0) {
        goToPage(activePage - 1);
      }

      if (event.key === "ArrowRight" && activePage < 3) {
        goToPage(activePage + 1);
      }
    };

    window.addEventListener("keydown", changePageWithArrow);
    return () => window.removeEventListener("keydown", changePageWithArrow);
  }, [activePage, goToPage]);

  const sortedEvents = useMemo(
    () => [...calendarEvents].sort((a, b) => a.start.localeCompare(b.start)),
    [calendarEvents],
  );
  const selectedDateKey = toDateKey(selectedDate, appConfig.timezone);
  const weatherBadgeText =
    browserWeather.status === "loading"
      ? "Loading weather..."
      : browserWeather.status === "home"
        ? "Using home weather..."
        : browserWeather.status === "unavailable"
          ? "Weather data is temporarily unavailable."
          : `${activeWeather.temperature}° ${activeWeather.condition}`;
  const todaysEvents = sortedEvents.filter(
    (event) => toDateKey(new Date(event.start), appConfig.timezone) === todayKey,
  );
  const selectedEvents = sortedEvents.filter(
    (event) =>
      toDateKey(new Date(event.start), appConfig.timezone) === selectedDateKey,
  );
  const upcomingEvents = sortedEvents.filter(
    (event) => new Date(event.start).getTime() >= now.getTime(),
  );

  const calendarDays = useMemo(() => {
    if (calendarMode === "month") return getMonthDays(selectedDate);

    const weekStart = getStartOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [calendarMode, selectedDate]);

  const nextSevenDays = useMemo(() => {
    const [year, month, day] = todayKey.split("-").map(Number);
    const start = getStartOfDay(new Date(year, month - 1, day));
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [todayKey]);

  const taskStats = useMemo(() => {
    const done = tasks.filter((task) => task.done).length;

    return {
      done,
      total: tasks.length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  const routineTasks = tasks.slice(0, MAX_ROUTINE_TASKS);
  const drawerTasks = tasks.slice(0, MAX_DRAWER_TASKS);
  const hiddenDrawerTaskCount = Math.max(tasks.length - drawerTasks.length, 0);

  function resetEventComposer(date: Date) {
    setEventComposer(getDefaultEventComposerState(date));
    setEventError(null);
  }

  function openEventComposer(date: Date) {
    resetEventComposer(date);
    setIsEventComposerOpen(true);
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    await addTask(title);
    setNewTaskTitle("");
  }

  function moveCalendar(direction: number) {
    if (calendarMode === "week") {
      setSelectedDate((current) => addDays(current, direction * 7));
      return;
    }

    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;

    setNotes((currentNotes) => [
      {
        id: createId("note"),
        text,
        color: noteColor,
        createdAt: new Date().toISOString(),
      },
      ...currentNotes,
    ]);
    setNoteDraft("");
  }

  function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageMembers) return;
    const name = memberName.trim();
    if (!name) return;
    setAccountPending(true);
    setAccountError(null);
    void addLocalMember({
      name,
      role: memberRole,
      color: memberColor,
    })
      .then(() => {
        setMemberName("");
      })
      .catch((caughtError) => {
        setAccountError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to add local member.",
        );
      })
      .finally(() => {
        setAccountPending(false);
      });
  }

  async function handleAddHouseholdAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageMembers) return;
    const email = accountEmail.trim().toLowerCase();
    if (!email) return;

    setAccountPending(true);
    setAccountError(null);

    try {
      await inviteMember({
        email,
        role: accountRole,
      });
      setAccountEmail("");
    } catch (caughtError) {
      setAccountError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to add family account.",
      );
    } finally {
      setAccountPending(false);
    }
  }

  async function handleCreateCalendarEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseUser) {
      setEventError("You must be signed in to add calendar events.");
      return;
    }

    const title = eventComposer.title.trim();
    if (!title) {
      setEventError("Event title is required.");
      return;
    }

    const start = eventComposer.allDay
      ? buildAllDayEventIso(selectedDate)
      : buildEventIso(selectedDate, eventComposer.startTime);
    const end = eventComposer.allDay
      ? buildAllDayEventIso(selectedDate, 1)
      : buildEventIso(selectedDate, eventComposer.endTime);

    if (!eventComposer.allDay && new Date(end).getTime() < new Date(start).getTime()) {
      setEventError("End time must be after the start time.");
      return;
    }

    setEventPending(true);
    setEventError(null);

    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify({
          title,
          start,
          end,
          allDay: eventComposer.allDay,
          location: eventComposer.location.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        event?: CalendarEvent;
        error?: string;
      };

      if (!response.ok || !payload.event) {
        throw new Error(payload.error ?? "Unable to create event.");
      }

      setCalendarEvents((currentEvents) =>
        [...currentEvents, payload.event!].sort((a, b) =>
          a.start.localeCompare(b.start),
        ),
      );
      setIsEventComposerOpen(false);
      resetEventComposer(selectedDate);
    } catch (caughtError) {
      setEventError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create event.",
      );
    } finally {
      setEventPending(false);
    }
  }

  async function handleRemoveHouseholdAccount(account: HubMemberRecord) {
    if (!canManageMembers) return;
    setAccountPending(true);
    setAccountError(null);

    try {
      await removeMember(account.id);
    } catch (caughtError) {
      setAccountError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to remove family account.",
      );
    } finally {
      setAccountPending(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!canManageMembers) return;
    setAccountPending(true);
    setAccountError(null);

    try {
      await revokeInvite(inviteId);
    } catch (caughtError) {
      setAccountError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to revoke invite.",
      );
    } finally {
      setAccountPending(false);
    }
  }

  if (isAsleep) {
    return (
      <Screensaver
        now={now}
        timeZone={appConfig.timezone}
        nextEventTitle={upcomingEvents[0]?.title}
        weather={activeWeather}
      />
    );
  }

  return (
    <main className="hub-shell">
      <header className="hub-topbar">
        <div className="brand-lockup">
          <div className="brand-icon">
            <Home size={24} />
          </div>

          <div>
            <p className="eyebrow">{appConfig.locationLabel}</p>
            <h1>Family Home</h1>
          </div>
        </div>

        <div className="topbar-status" aria-label="Home hub status">
          <span>
            <Clock3 size={17} />
            {formatHubClock(now, appConfig.timezone, settings.clock24)}
          </span>
          <span className="date-status">
            <CalendarDays size={17} />
            {formatDateLabel(now, appConfig.timezone)}
          </span>
          {settings.showWeather ? (
            <span>
              <CloudSun size={18} />
              {weatherBadgeText}
            </span>
          ) : null}
          <span
            className={`provider-status ${
              data.providers.calendarConfigured ? "good" : "warn"
            }`}
          >
            {data.providers.calendarConfigured ? (
              <Wifi size={17} />
            ) : (
              <WifiOff size={17} />
            )}
            {data.providers.calendarConfigured ? "Synced" : "Not connected"}
          </span>
        </div>
      </header>

      <div
        ref={carouselRef}
        className="page-carousel"
        onScroll={(event) => {
          const carousel = event.currentTarget;
          if (!carousel.clientWidth) return;
          const nextPage = Math.round(carousel.scrollLeft / carousel.clientWidth);
          setActivePage(Math.max(0, Math.min(3, nextPage)));
        }}
      >
        <section className="hub-page" aria-label="Calendar and routines">
          <div className="calendar-page-layout">
            <aside className="hub-panel routine-card">
              <div className="routine-summary">
                <div>
                  <p className="eyebrow">Today&apos;s routine</p>
                  <h2>
                    {taskStats.done}
                    <span> / {taskStats.total}</span>
                  </h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsRoutineOpen(true)}
                  aria-label="Open full routine checklist"
                >
                  <ChevronRight size={19} />
                </button>
              </div>

              <div
                className="routine-progress"
                aria-label={`${taskStats.percent}% complete`}
              >
                <div>
                  <strong>{taskStats.percent}%</strong>
                  <span>complete</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${taskStats.percent}%` }} />
                </div>
              </div>

              <div className="routine-list" aria-label="Routine tasks">
                {routineTasks.map((task) => {
                  const owner = ownerFor(allMembers, task.ownerId);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={`routine-task ${task.done ? "complete" : ""}`}
                      onClick={() => void toggleTask(task.id)}
                    >
                      <span className="routine-check">
                        {task.done ? <Check size={15} /> : <Circle size={15} />}
                      </span>
                      <span>{task.title}</span>
                      <small style={{ color: owner.color }}>{owner.initials}</small>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="routine-add-button"
                onClick={() => setIsRoutineOpen(true)}
              >
                <Plus size={16} /> Add a task
              </button>
            </aside>

            <article className="hub-panel calendar-panel">
              <div className="calendar-toolbar">
                <div>
                  <p className="eyebrow">Calendar</p>
                  <div className="calendar-title-line">
                    <h2>{getCalendarTitle(calendarMode, selectedDate)}</h2>
                    <span className="today-count">{todaysEvents.length} today</span>
                  </div>
                </div>

                <div className="calendar-actions">
                  <div className="date-stepper" aria-label="Change calendar period">
                    <button
                      type="button"
                      onClick={() => moveCalendar(-1)}
                      aria-label={`Previous ${calendarMode}`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button type="button" onClick={() => setSelectedDate(now)}>
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCalendar(1)}
                      aria-label={`Next ${calendarMode}`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="segmented-control" aria-label="Calendar view">
                    <button
                      type="button"
                      className={calendarMode === "week" ? "active" : ""}
                      onClick={() => setCalendarMode("week")}
                    >
                      Week
                    </button>
                    <button
                      type="button"
                      className={calendarMode === "month" ? "active" : ""}
                      onClick={() => setCalendarMode("month")}
                    >
                      Month
                    </button>
                  </div>
                </div>
              </div>

              {calendarMode === "month" ? (
                <div className="month-weekdays" aria-hidden="true">
                  {calendarDays.slice(0, 7).map((day) => (
                    <span key={toDateKey(day, appConfig.timezone)}>
                      {weekdayLabel(day)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div
                className={`calendar-grid ${calendarMode}`}
                aria-label={`${calendarMode} calendar`}
              >
                {calendarDays.map((day) => {
                  const key = toDateKey(day, appConfig.timezone);
                  const dayEvents = sortedEvents.filter(
                    (event) =>
                      toDateKey(new Date(event.start), appConfig.timezone) === key,
                  );
                  const forecast = getForecastForDate(
                    day,
                    activeWeather,
                    browserWeather.daily,
                    todayKey,
                  );
                  const isSelected = selectedDateKey === key;
                  const isToday = todayKey === key;
                  const isCurrentMonth =
                    day.getMonth() === selectedDate.getMonth();

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${isSelected ? "selected" : ""} ${
                        isToday ? "today" : ""
                      } ${
                        !isCurrentMonth && calendarMode === "month"
                          ? "outside-month"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedDate(day);
                        if (isEventComposerOpen) {
                          resetEventComposer(day);
                        }
                      }}
                      aria-label={`${formatShortDate(
                        day,
                        appConfig.timezone,
                      )}, ${dayEvents.length} events`}
                    >
                      <span className="calendar-cell-top">
                        <span className="date-orb">
                          {calendarMode === "week" ? (
                            <small>{weekdayLabel(day)}</small>
                          ) : null}
                          <strong>{day.getDate()}</strong>
                        </span>
                        <span
                          className={`event-count ${
                            dayEvents.length ? "has-events" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {dayEvents.length}
                        </span>
                      </span>

                      {calendarMode === "week" ? (
                        <>
                          <span className="day-weather" title={forecast.label}>
                            <CloudSun size={17} />
                            {forecast.unitLabel ? `${forecast.unitLabel} ` : ""}
                            {forecast.temp}°
                          </span>
                          <span className="event-count-copy">
                            {dayEvents.length === 1
                              ? "1 event"
                              : `${dayEvents.length} events`}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <section className="selected-day-panel" aria-live="polite">
                <div className="selected-day-heading">
                  <div>
                    <p className="eyebrow">Selected day</p>
                    <h3>{formatShortDate(selectedDate, appConfig.timezone)}</h3>
                  </div>
                  <div className="selected-day-meta">
                    <span>
                      {selectedEvents.length === 1
                        ? "1 event"
                        : `${selectedEvents.length} events`}
                    </span>
                    <button
                      type="button"
                      className="calendar-create-button"
                      onClick={() => openEventComposer(selectedDate)}
                    >
                      <Plus size={15} /> Add event
                    </button>
                  </div>
                </div>

                <div className="selected-event-list">
                  {isEventComposerOpen ? (
                    <form
                      className="event-composer"
                      onSubmit={handleCreateCalendarEvent}
                    >
                      <input
                        value={eventComposer.title}
                        onChange={(composeEvent) =>
                          setEventComposer((current) => ({
                            ...current,
                            title: composeEvent.target.value,
                          }))
                        }
                        placeholder="Dinner, soccer, dentist..."
                        aria-label="Event title"
                        maxLength={100}
                      />
                      <input
                        value={eventComposer.location}
                        onChange={(composeEvent) =>
                          setEventComposer((current) => ({
                            ...current,
                            location: composeEvent.target.value,
                          }))
                        }
                        placeholder="Location (optional)"
                        aria-label="Event location"
                        maxLength={120}
                      />
                      <label className="event-toggle">
                        <input
                          type="checkbox"
                          checked={eventComposer.allDay}
                          onChange={(composeEvent) =>
                            setEventComposer((current) => ({
                              ...current,
                              allDay: composeEvent.target.checked,
                            }))
                          }
                        />
                        <span>All day</span>
                      </label>
                      {!eventComposer.allDay ? (
                        <div className="event-time-row">
                          <label>
                            <span>Start</span>
                            <input
                              type="time"
                              value={eventComposer.startTime}
                              onChange={(composeEvent) =>
                                setEventComposer((current) => ({
                                  ...current,
                                  startTime: composeEvent.target.value,
                                }))
                              }
                              aria-label="Event start time"
                            />
                          </label>
                          <label>
                            <span>End</span>
                            <input
                              type="time"
                              value={eventComposer.endTime}
                              onChange={(composeEvent) =>
                                setEventComposer((current) => ({
                                  ...current,
                                  endTime: composeEvent.target.value,
                                }))
                              }
                              aria-label="Event end time"
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="event-composer-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setIsEventComposerOpen(false);
                            resetEventComposer(selectedDate);
                          }}
                          disabled={eventPending}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={eventPending}
                        >
                          <Plus size={16} />
                          {eventPending ? "Saving..." : "Save event"}
                        </button>
                      </div>
                      {eventError ? (
                        <p className="event-form-error">{eventError}</p>
                      ) : null}
                    </form>
                  ) : null}
                  {selectedEvents.length ? (
                    selectedEvents
                      .slice(0, MAX_VISIBLE_EVENTS)
                      .map((event) => {
                        const owner = ownerFor(allMembers, event.ownerId);

                        return (
                          <div key={event.id} className="selected-event">
                            <span
                              className="event-dot"
                              style={{ backgroundColor: owner.color }}
                            />
                            <div>
                              <strong>{event.title}</strong>
                              <p>
                                {eventTimeLabel(
                                  event,
                                  appConfig.timezone,
                                  settings.clock24,
                                )}
                                {event.location ? ` · ${event.location}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })
                  ) : !isEventComposerOpen ? (
                    <p className="empty-state">
                      Nothing planned. This day is all yours.
                    </p>
                  ) : null}
                </div>
              </section>
            </article>
          </div>
        </section>

        <section className="hub-page" aria-label="Next 7 Days">
          <article className="hub-panel full-page-panel coming-panel">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Next 7 Days</p>
                <h2>The next 7 days</h2>
                <p className="page-subtitle">
                  {upcomingEvents.length} upcoming family moments
                </p>
              </div>
              <div className="page-icon">
                <CalendarRange size={25} />
              </div>
            </div>

            <GoogleCalendarSync
              currentUserName={currentUser.name ?? currentUser.email}
            />

            <div className="weather-dashboard">
              <WeatherAlerts
                alerts={browserWeather.alerts}
                onDismiss={browserWeather.dismissAlert}
              />
              <WeatherCard
                weather={browserWeather.forecast}
                message={browserWeather.message || "Loading weather..."}
              />
              {browserWeather.forecast ? (
                <div className="weather-detail-grid">
                  <HourlyForecast
                    hourly={browserWeather.hourly}
                    timezone={browserWeather.forecast.location.timezone}
                  />
                  <DailyForecast daily={browserWeather.daily} />
                </div>
              ) : null}
            </div>

            <div className="seven-day-grid">
              {nextSevenDays.map((day, index) => {
                const key = toDateKey(day, appConfig.timezone);
                const dayEvents = sortedEvents.filter(
                  (event) =>
                    toDateKey(new Date(event.start), appConfig.timezone) === key,
                );

                return (
                  <section
                    key={key}
                    className={`schedule-day ${index === 0 ? "today" : ""}`}
                  >
                    <button
                      type="button"
                      className="schedule-day-heading"
                      onClick={() => {
                        setSelectedDate(day);
                        goToPage(0);
                      }}
                      aria-label={`Open ${formatShortDate(
                        day,
                        appConfig.timezone,
                      )} in calendar`}
                    >
                      <span>{index === 0 ? "Today" : weekdayLabel(day)}</span>
                      <strong>{day.getDate()}</strong>
                      <small>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          timeZone: appConfig.timezone,
                        }).format(day)}
                      </small>
                    </button>

                    <div className="schedule-events">
                      {dayEvents.length ? (
                        dayEvents.map((event) => {
                          const owner = ownerFor(allMembers, event.ownerId);

                          return (
                            <div
                              key={event.id}
                              className="schedule-event"
                              style={{ borderColor: owner.color }}
                            >
                              <span>
                                {eventTimeLabel(
                                  event,
                                  appConfig.timezone,
                                  settings.clock24,
                                )}
                              </span>
                              <strong>{event.title}</strong>
                              {event.location ? <small>{event.location}</small> : null}
                            </div>
                          );
                        })
                      ) : (
                        <p className="schedule-empty">Open day</p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        </section>

        <section className="hub-page" aria-label="Family notes">
          <article className="hub-panel full-page-panel notes-panel">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Family notes</p>
                <h2>Leave it where everyone can see it</h2>
                <p className="page-subtitle">
                  Notes stay on this home display until someone removes them.
                </p>
              </div>
              <div className="page-icon">
                <StickyNote size={25} />
              </div>
            </div>

            <div className="notes-layout">
              <form className="note-composer" onSubmit={handleAddNote}>
                <label htmlFor="family-note">New note</label>
                <textarea
                  id="family-note"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Milk is low, practice moved to 6…"
                  maxLength={180}
                  style={{ backgroundColor: noteColor }}
                />
                <div className="note-color-row" aria-label="Note color">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={noteColor === color ? "active" : ""}
                      style={{ backgroundColor: color }}
                      onClick={() => setNoteColor(color)}
                      aria-label={`Use ${color} note`}
                    />
                  ))}
                </div>
                <button type="submit" className="primary-button">
                  <Plus size={18} /> Post note
                </button>
              </form>

              <div className="notes-board" aria-live="polite">
                {notes.length ? (
                  notes.map((note) => (
                    <article
                      key={note.id}
                      className="sticky-note"
                      style={{ backgroundColor: note.color }}
                    >
                      <p>{note.text}</p>
                      <div>
                        <span>
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(note.createdAt))}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setNotes((currentNotes) =>
                              currentNotes.filter(
                                (currentNote) => currentNote.id !== note.id,
                              ),
                            )
                          }
                          aria-label="Delete note"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="notes-empty">
                    <StickyNote size={30} />
                    <strong>No notes on the fridge</strong>
                    <span>Post the first one using the pad on the left.</span>
                  </div>
                )}
              </div>
            </div>
          </article>
        </section>

        <section className="hub-page" aria-label="Settings">
          <article className="hub-panel full-page-panel settings-panel">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Settings</p>
                <h2>Make the hub feel like home</h2>
                <p className="page-subtitle">
                  Personalize the shared display and family access.
                </p>
              </div>
              <div className="page-icon">
                <Settings2 size={25} />
              </div>
            </div>

            <div className="settings-grid">
              <section className="settings-card account-card">
                <div className="settings-card-heading">
                  <span>
                    <LogIn size={19} />
                  </span>
                  <div>
                    <strong>Family account</strong>
                    <small>Calendar and cloud sync</small>
                  </div>
                </div>
                <div className="account-status">
                  <span
                    className={`status-light ${
                      currentUser.email ? "connected" : ""
                    }`}
                  />
                  <div>
                    <strong>{currentUser.name ?? currentUser.email}</strong>
                    <small>
                      {currentUser.email}
                    </small>
                  </div>
                  <SignOutButton />
                </div>
                <div className="household-access-panel">
                  <div className="household-access-copy">
                    <strong>Members and invites</strong>
                    <small>
                      Invite real accounts with email, or add local-only members for
                      children and shared profiles.
                    </small>
                  </div>

                  <div className="household-account-list">
                    {hubMembers.map((account) => (
                      <div key={account.id} className="household-account-row">
                        <div>
                          <strong>{account.displayName}</strong>
                          <small>
                            {account.type === "account"
                              ? account.email ?? "No email"
                              : "Local profile"}
                          </small>
                          <small>
                            {account.role} ·{" "}
                            {account.type === "account"
                              ? account.calendarConnected
                                ? "Calendar connected"
                                : "Calendar not connected"
                              : "No calendar sync"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="account-remove-button"
                          onClick={() => void handleRemoveHouseholdAccount(account)}
                          disabled={
                            !canManageMembers ||
                            accountPending ||
                            account.role === "owner" ||
                            account.uid === currentUser.uid
                          }
                          aria-label={`Remove ${account.displayName}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    {!hubMembers.length && !directoryLoading ? (
                      <p className="quiet-note">
                        No active members yet.
                      </p>
                    ) : null}
                  </div>

                  <form
                    className="household-account-form"
                    onSubmit={handleAddHouseholdAccount}
                  >
                    <input
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="Email"
                      aria-label="Family account email"
                      type="email"
                      maxLength={120}
                    />
                    <select
                      value={accountRole}
                      onChange={(event) =>
                        setAccountRole(event.target.value === "admin" ? "admin" : "member")
                      }
                      aria-label="Invite role"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" disabled={accountPending || !canManageMembers}>
                      <UserPlus size={17} /> Invite member
                    </button>
                  </form>

                  {invites.length ? (
                    <div className="household-account-list">
                      {invites.map((invite) => (
                        <div key={invite.id} className="household-account-row">
                          <div>
                            <strong>{invite.email}</strong>
                            <small>{invite.role}</small>
                            <small>Invite pending</small>
                          </div>
                          <button
                            type="button"
                            className="account-remove-button"
                            onClick={() => void handleRevokeInvite(invite.id)}
                            disabled={!canManageMembers || accountPending}
                            aria-label={`Revoke invite for ${invite.email}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {accountError || directoryError ? (
                    <p className="quiet-note">{accountError ?? directoryError}</p>
                  ) : null}
                </div>
              </section>

              <section className="settings-card family-card">
                <div className="settings-card-heading">
                  <span>
                    <Users size={19} />
                  </span>
                  <div>
                    <strong>Family members</strong>
                    <small>{allMembers.length} people on this hub</small>
                  </div>
                </div>
                <div className="member-list">
                  {allMembers.map((member) => (
                    <span
                      key={member.id}
                      className="member-avatar"
                      style={{ backgroundColor: member.color }}
                      title={member.name}
                    >
                      {member.initials}
                    </span>
                  ))}
                </div>
                <form className="member-form" onSubmit={handleAddMember}>
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Add a person"
                    aria-label="New family member name"
                    maxLength={30}
                  />
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    aria-label="Local member role"
                  >
                    <option value="local">Local</option>
                    <option value="child">Child</option>
                    <option value="member">Member</option>
                  </select>
                  <select
                    value={memberColor}
                    onChange={(event) => setMemberColor(event.target.value)}
                    aria-label="Local member color"
                  >
                    {ACCENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={accountPending || !canManageMembers}>
                    <UserPlus size={17} /> Add local
                  </button>
                </form>
                {!canManageMembers ? (
                  <p className="quiet-note">
                    Only hub owners and admins can change members.
                  </p>
                ) : null}
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>
                    <Palette size={19} />
                  </span>
                  <div>
                    <strong>Hub color</strong>
                    <small>Used for buttons and selected dates</small>
                  </div>
                </div>
                <div className="accent-picker">
                  {ACCENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        settings.accent === option.value ? "active" : ""
                      }
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          accent: option.value,
                        }))
                      }
                    >
                      <span style={{ backgroundColor: option.value }} />
                      {option.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <span>
                    <Clock3 size={19} />
                  </span>
                  <div>
                    <strong>Display behavior</strong>
                    <small>Clock, weather, and sleep timing</small>
                  </div>
                </div>
                <label className="settings-select">
                  <span>Sleep after</span>
                  <select
                    value={settings.idleMinutes}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        idleMinutes: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={0}>Never</option>
                  </select>
                </label>
                <label className="toggle-row">
                  <span>24-hour clock</span>
                  <input
                    type="checkbox"
                    checked={settings.clock24}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        clock24: event.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="toggle-row">
                  <span>Show weather</span>
                  <input
                    type="checkbox"
                    checked={settings.showWeather}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        showWeather: event.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="toggle-row">
                  <span>Reduce motion</span>
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        reducedMotion: event.target.checked,
                      }))
                    }
                  />
                </label>
              </section>
            </div>
          </article>
        </section>
      </div>

      <nav className="page-dock" aria-label="Hub pages">
        <button
          type="button"
          className={activePage === 0 ? "active" : ""}
          onClick={() => goToPage(0)}
          aria-current={activePage === 0 ? "page" : undefined}
        >
          <CalendarDays size={18} />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          className={activePage === 1 ? "active" : ""}
          onClick={() => goToPage(1)}
          aria-current={activePage === 1 ? "page" : undefined}
        >
          <CalendarRange size={18} />
          <span>Next 7 Days</span>
        </button>
        <button
          type="button"
          className={activePage === 2 ? "active" : ""}
          onClick={() => goToPage(2)}
          aria-current={activePage === 2 ? "page" : undefined}
        >
          <StickyNote size={18} />
          <span>Notes</span>
        </button>
        <button
          type="button"
          className={activePage === 3 ? "active" : ""}
          onClick={() => goToPage(3)}
          aria-current={activePage === 3 ? "page" : undefined}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
      </nav>

      {isRoutineOpen ? (
        <div className="routine-drawer-layer" role="presentation">
          <button
            type="button"
            className="drawer-scrim"
            onClick={() => setIsRoutineOpen(false)}
            aria-label="Close routine drawer"
          />

          <section className="routine-drawer" aria-label="Full daily routine checklist">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Daily routine</p>
                <h2>Today&apos;s checklist</h2>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setIsRoutineOpen(false)}
                aria-label="Close routine checklist"
              >
                <X size={21} />
              </button>
            </div>

            <div className="drawer-progress-card">
              <div>
                <strong>{taskStats.percent}% done</strong>
                <span>
                  {taskStats.done} of {taskStats.total} complete
                </span>
              </div>
              <div className="progress-track large">
                <span style={{ width: `${taskStats.percent}%` }} />
              </div>
            </div>

            <form className="task-form" onSubmit={handleAddTask}>
              <input
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="Add a family routine task"
                aria-label="New routine task"
                disabled={tasksLoading}
              />
              <button type="submit" disabled={tasksLoading}>
                <Plus size={18} /> Add
              </button>
            </form>

            {tasksError ? <p className="quiet-note">{tasksError}</p> : null}

            <div className="drawer-task-list" aria-label="Daily routine tasks">
              {drawerTasks.map((task) => {
                const owner = ownerFor(allMembers, task.ownerId);

                return (
                  <div
                    key={task.id}
                    className={`drawer-task ${task.done ? "complete" : ""}`}
                  >
                    <button
                      type="button"
                      className="check-button"
                      onClick={() => void toggleTask(task.id)}
                      aria-label={
                        task.done
                          ? `Mark ${task.title} incomplete`
                          : `Mark ${task.title} complete`
                      }
                    >
                      {task.done ? <Check size={18} /> : <Circle size={18} />}
                    </button>
                    <div>
                      <strong>{task.title}</strong>
                      <span style={{ color: owner.color }}>{owner.name}</span>
                    </div>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => void deleteTask(task.id)}
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="drawer-footer">
              <span style={{ color: familyOwner.color }}>Family routine</span>
              <button type="button" onClick={() => void resetTasks()}>
                Reset today
              </button>
            </div>

            {hiddenDrawerTaskCount > 0 ? (
              <p className="quiet-note">
                {hiddenDrawerTaskCount} more tasks are hidden on this display.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
