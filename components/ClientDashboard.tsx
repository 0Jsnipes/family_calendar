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
import {
  addDays,
  formatDateLabel,
  formatMonthLabel,
  formatShortDate,
  toDateKey,
} from "@/lib/date";
import type {
  AppData,
  CalendarEvent,
  Chore,
  DisplayView,
  FamilyMember,
  Weather,
} from "@/types";
import Screensaver from "./Screensaver";

const MAX_ROUTINE_TASKS = 4;
const MAX_DRAWER_TASKS = 12;
const MAX_VISIBLE_EVENTS = 8;
const SETTINGS_STORAGE_KEY = "family-hub-settings";
const NOTES_STORAGE_KEY = "family-hub-notes";
const MEMBERS_STORAGE_KEY = "family-hub-custom-members";

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
};

type CalendarMode = "week" | "month";

type RoutineTask = Chore & {
  createdAt: string;
};

type DailyWeather = {
  label: string;
  temp: number;
};

type FamilyNote = {
  id: string;
  text: string;
  color: string;
  createdAt: string;
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

function getMonthDays(date: Date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = getStartOfWeek(firstOfMonth);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getForecastForDate(date: Date, weather: Weather): DailyWeather {
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

export default function ClientDashboard({ data, initialView, kioskMode }: Props) {
  const now = useClock(data.lastUpdated);
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
  const [tasks, setTasks] = useState<RoutineTask[]>(defaultTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [isAsleep, setIsAsleep] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(() => Date.now());
  const [settings, setSettings] = useState<HubSettings>(defaultSettings);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [notes, setNotes] = useState<FamilyNote[]>([]);
  const [hasLoadedNotes, setHasLoadedNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [customMembers, setCustomMembers] = useState<FamilyMember[]>([]);
  const [hasLoadedMembers, setHasLoadedMembers] = useState(false);
  const [memberName, setMemberName] = useState("");
  const carouselRef = useRef<HTMLDivElement>(null);

  const allMembers = useMemo(
    () => [...data.familyMembers, ...customMembers],
    [customMembers, data.familyMembers],
  );
  const familyOwner = ownerFor(allMembers, "family");
  const taskStorageKey = `family-hub-routine-${todayKey}`;

  useEffect(() => {
    const loadTasks = window.setTimeout(() => {
      const savedTasks = window.localStorage.getItem(taskStorageKey);

      if (!savedTasks) {
        setTasks(defaultTasks);
        setHasLoadedTasks(true);
        return;
      }

      try {
        setTasks(JSON.parse(savedTasks) as RoutineTask[]);
      } catch {
        setTasks(defaultTasks);
      }

      setHasLoadedTasks(true);
    }, 0);

    return () => window.clearTimeout(loadTasks);
  }, [defaultTasks, taskStorageKey]);

  useEffect(() => {
    if (!hasLoadedTasks) return;
    window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
  }, [hasLoadedTasks, taskStorageKey, tasks]);

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
    const loadMembers = window.setTimeout(() => {
      const savedMembers = window.localStorage.getItem(MEMBERS_STORAGE_KEY);

      if (savedMembers) {
        try {
          setCustomMembers(JSON.parse(savedMembers) as FamilyMember[]);
        } catch {
          setCustomMembers([]);
        }
      }

      setHasLoadedMembers(true);
    }, 0);

    return () => window.clearTimeout(loadMembers);
  }, []);

  useEffect(() => {
    if (!hasLoadedMembers) return;
    window.localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(customMembers));
  }, [customMembers, hasLoadedMembers]);

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
    () => [...data.events].sort((a, b) => a.start.localeCompare(b.start)),
    [data.events],
  );
  const selectedDateKey = toDateKey(selectedDate, appConfig.timezone);
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

  function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: createId("task"),
        title,
        ownerId: "family",
        done: false,
        dueDate: todayKey,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewTaskTitle("");
  }

  function toggleTask(taskId: string) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function deleteTask(taskId: string) {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
  }

  function resetToday() {
    setTasks(defaultTasks.map((task) => ({ ...task, done: false })));
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
    const name = memberName.trim();
    if (!name) return;

    const color = ACCENT_OPTIONS[allMembers.length % ACCENT_OPTIONS.length].value;
    setCustomMembers((currentMembers) => [
      ...currentMembers,
      {
        id: createId("member"),
        name,
        role: "Family member",
        initials: name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color,
      },
    ]);
    setMemberName("");
  }

  if (isAsleep) {
    return (
      <Screensaver
        now={now}
        timeZone={appConfig.timezone}
        nextEventTitle={upcomingEvents[0]?.title}
        weather={data.weather}
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
              {data.weather.temperature}° {data.weather.condition}
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
            {data.providers.calendarConfigured ? "Synced" : "Demo data"}
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
                      onClick={() => toggleTask(task.id)}
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
                  const forecast = getForecastForDate(day, data.weather);
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
                      onClick={() => setSelectedDate(day)}
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
                  <span>
                    {selectedEvents.length === 1
                      ? "1 event"
                      : `${selectedEvents.length} events`}
                  </span>
                </div>

                <div className="selected-event-list">
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
                  ) : (
                    <p className="empty-state">
                      Nothing planned. This day is all yours.
                    </p>
                  )}
                </div>
              </section>
            </article>
          </div>
        </section>

        <section className="hub-page" aria-label="Coming soon">
          <article className="hub-panel full-page-panel coming-panel">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Coming soon</p>
                <h2>The next 7 days</h2>
                <p className="page-subtitle">
                  {upcomingEvents.length} upcoming family moments
                </p>
              </div>
              <div className="page-icon">
                <CalendarRange size={25} />
              </div>
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
                      settings.accountConnected ? "connected" : ""
                    }`}
                  />
                  <div>
                    <strong>
                      {settings.accountConnected ? "Home Admin" : "Local display"}
                    </strong>
                    <small>
                      {settings.accountConnected
                        ? "Account connected"
                        : "Not signed in"}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        accountConnected: !current.accountConnected,
                      }))
                    }
                  >
                    {settings.accountConnected ? "Sign out" : "Sign in"}
                  </button>
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
                  <button type="submit">
                    <UserPlus size={17} /> Add
                  </button>
                </form>
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
          <span>Coming soon</span>
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
              />
              <button type="submit">
                <Plus size={18} /> Add
              </button>
            </form>

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
                      onClick={() => toggleTask(task.id)}
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
                      onClick={() => deleteTask(task.id)}
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
              <button type="button" onClick={resetToday}>
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
