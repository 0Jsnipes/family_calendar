"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudSun,
  HeartHandshake,
  Home,
  ListTodo,
  Mic,
  Plus,
  School,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
} from "lucide-react";

type FamilyMember = {
  name: string;
  role: string;
  initials: string;
  color: string;
  bg: string;
  text: string;
};

type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  time: string;
  person: FamilyMember["name"];
  category: string;
  icon: "school" | "home" | "sports" | "spark";
};

const familyMembers: FamilyMember[] = [
  {
    name: "Jared",
    role: "Dad",
    initials: "J",
    color: "#2563eb",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    name: "Angela",
    role: "Mom",
    initials: "A",
    color: "#db2777",
    bg: "bg-pink-50",
    text: "text-pink-700",
  },
  {
    name: "Ryleigh",
    role: "Kid",
    initials: "R",
    color: "#7c3aed",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    name: "Mason",
    role: "Kid",
    initials: "M",
    color: "#059669",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  {
    name: "Family",
    role: "Everyone",
    initials: "F",
    color: "#f59e0b",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
];

const events: CalendarEvent[] = [
  {
    id: 1,
    title: "School drop-off",
    date: "2026-06-16",
    time: "7:45 AM",
    person: "Family",
    category: "Routine",
    icon: "school",
  },
  {
    id: 2,
    title: "Sales call review",
    date: "2026-06-16",
    time: "9:30 AM",
    person: "Jared",
    category: "Work",
    icon: "spark",
  },
  {
    id: 3,
    title: "Grocery pickup",
    date: "2026-06-16",
    time: "12:15 PM",
    person: "Family",
    category: "Errand",
    icon: "home",
  },
  {
    id: 4,
    title: "Dance class",
    date: "2026-06-18",
    time: "6:00 PM",
    person: "Ryleigh",
    category: "Kids",
    icon: "spark",
  },
  {
    id: 5,
    title: "Soccer practice",
    date: "2026-06-19",
    time: "5:30 PM",
    person: "Mason",
    category: "Sports",
    icon: "sports",
  },
  {
    id: 6,
    title: "Beach morning",
    date: "2026-06-20",
    time: "10:00 AM",
    person: "Family",
    category: "Fun",
    icon: "spark",
  },
  {
    id: 7,
    title: "Family dinner",
    date: "2026-06-22",
    time: "6:30 PM",
    person: "Angela",
    category: "Home",
    icon: "home",
  },
  {
    id: 8,
    title: "Library story time",
    date: "2026-06-24",
    time: "4:00 PM",
    person: "Mason",
    category: "Kids",
    icon: "school",
  },
];

const chores = [
  { title: "Pack lunches", owner: "Angela", done: true },
  { title: "Water plants", owner: "Ryleigh", done: false },
  { title: "Take trash out", owner: "Mason", done: false },
  { title: "Charge tablets", owner: "Jared", done: true },
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function prettyDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getCalendarDays(currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
}

function parseEventTime(event: CalendarEvent) {
  return new Date(`${event.date} ${event.time}`).getTime();
}

function getMember(name: string) {
  return familyMembers.find((member) => member.name === name) ?? familyMembers[4];
}

function EventIcon({ icon }: { icon: CalendarEvent["icon"] }) {
  const className = "size-4";

  if (icon === "school") {
    return <School className={className} />;
  }

  if (icon === "sports") {
    return <Trophy className={className} />;
  }

  if (icon === "home") {
    return <Home className={className} />;
  }

  return <Sparkles className={className} />;
}

export default function FamilyCalendar() {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);

  const todayKey = toDateKey(today);
  const selectedDateKey = toDateKey(selectedDate);
  const calendarDays = useMemo(() => getCalendarDays(currentDate), [currentDate]);

  const selectedEvents = events
    .filter((event) => event.date === selectedDateKey)
    .sort((a, b) => parseEventTime(a) - parseEventTime(b));

  const upcomingEvents = events
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => parseEventTime(a) - parseEventTime(b))
    .slice(0, 6);

  const monthTitle = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function goPreviousMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  }

  function goNextMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  }

  function goToday() {
    setCurrentDate(today);
    setSelectedDate(today);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <section className="grid min-h-screen gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_340px] xl:gap-5 xl:p-5">
        <aside className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-14 place-items-center rounded-2xl bg-slate-950 text-white">
              <CalendarDays className="size-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
                FamCal
              </p>
              <h1 className="text-2xl font-black tracking-tight">
                Kitchen Hub
              </h1>
            </div>
          </div>

          <section className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/55">Today</p>
                <p className="mt-1 text-5xl font-black leading-none">
                  {today.getDate()}
                </p>
              </div>
              <Sun className="size-10 text-amber-300" />
            </div>
            <p className="mt-4 text-xl font-black">{prettyDate(today)}</p>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                  Myrtle Beach
                </p>
                <p className="text-2xl font-black">84 deg</p>
              </div>
              <CloudSun className="size-8 text-cyan-200" />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Users className="size-5" />
              <p className="text-sm font-black uppercase tracking-[0.22em]">
                Crew
              </p>
            </div>
            {familyMembers.map((member) => (
              <div
                key={member.name}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-9 place-items-center rounded-full text-sm font-black text-white"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.initials}
                  </span>
                  <div>
                    <p className="font-black leading-tight">{member.name}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {member.role}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.bg} ${member.text}`}>
                  Live
                </span>
              </div>
            ))}
          </section>

          <div className="mt-auto grid grid-cols-2 gap-3">
            <button className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]">
              <Plus className="size-5" />
              Add
            </button>
            <button className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]">
              <Mic className="size-5" />
              Voice
            </button>
          </div>
        </aside>

        <section className="flex min-h-[760px] flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-slate-400">
                <HeartHandshake className="size-4" />
                Family Command Center
              </p>
              <h2 className="mt-1 text-5xl font-black tracking-tight xl:text-6xl">
                {monthTitle}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToday}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Today
              </button>
              <button
                onClick={goPreviousMonth}
                className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                onClick={goNextMonth}
                className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
                aria-label="Next month"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 border-y border-slate-200 py-3">
            {weekdays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-black uppercase tracking-[0.18em] text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-2 pt-3">
            {calendarDays.map((day) => {
              const dateKey = toDateKey(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDateKey;
              const dayEvents = events.filter((event) => event.date === dateKey);

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(day)}
                  className={[
                    "group flex min-h-0 flex-col rounded-2xl border p-2 text-left transition",
                    isSelected
                      ? "border-slate-950 bg-slate-950 text-white shadow-md"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                    !isCurrentMonth && !isSelected ? "opacity-40" : "opacity-100",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "grid size-9 place-items-center rounded-full text-lg font-black",
                        isToday && !isSelected
                          ? "bg-amber-300 text-slate-950"
                          : isSelected
                            ? "bg-white text-slate-950"
                            : "text-slate-900",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-xs font-black",
                          isSelected
                            ? "bg-white/15 text-white"
                            : "bg-white text-slate-500",
                        ].join(" ")}
                      >
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 min-h-0 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => {
                      const member = getMember(event.person);

                      return (
                        <div
                          key={event.id}
                          className={[
                            "truncate rounded-full px-2 py-1 text-xs font-black",
                            isSelected
                              ? "bg-white/15 text-white"
                              : `${member.bg} ${member.text}`,
                          ].join(" ")}
                        >
                          {event.time} - {event.title}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">
              Selected Day
            </p>
            <h3 className="mt-1 text-3xl font-black tracking-tight">
              {prettyDate(selectedDate)}
            </h3>

            <div className="mt-5 space-y-3">
              {selectedEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <Star className="mx-auto size-8 text-amber-400" />
                  <p className="mt-3 text-lg font-black">Open day</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Add a plan, chore, meal, or reminder.
                  </p>
                </div>
              ) : (
                selectedEvents.map((event) => {
                  const member = getMember(event.person);

                  return (
                    <article
                      key={event.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <span
                            className="grid size-10 shrink-0 place-items-center rounded-2xl text-white"
                            style={{ backgroundColor: member.color }}
                          >
                            <EventIcon icon={event.icon} />
                          </span>
                          <div>
                            <h4 className="text-lg font-black leading-tight">
                              {event.title}
                            </h4>
                            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-500">
                              <Clock className="size-4" />
                              {event.time}
                            </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.bg} ${member.text}`}>
                          {event.person}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                        {event.category}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">
                Next Up
              </p>
              <Clock className="size-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => {
                const member = getMember(event.person);
                const date = new Date(`${event.date}T12:00:00`);

                return (
                  <article
                    key={event.id}
                    className="grid grid-cols-[4px_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <span style={{ backgroundColor: member.color }} />
                    <div className="p-3">
                      <p className="font-black leading-tight">{event.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at {event.time}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex-1 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">
                Home Board
              </p>
              <ListTodo className="size-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-3">
              {chores.map((chore) => {
                const member = getMember(chore.owner);

                return (
                  <div
                    key={chore.title}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div>
                      <p className="font-black leading-tight">{chore.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {chore.owner}
                      </p>
                    </div>
                    <span
                      className={[
                        "grid size-8 place-items-center rounded-full text-sm font-black",
                        chore.done
                          ? "bg-emerald-600 text-white"
                          : `${member.bg} ${member.text}`,
                      ].join(" ")}
                    >
                      {chore.done ? "OK" : member.initials}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
