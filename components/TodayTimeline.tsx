"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateLabel, formatShortDate } from "@/lib/date";
import type { CalendarEvent, DisplayView, FamilyMember } from "@/types";
import { categoryLabel, getEventTimeLabel, memberById } from "./dashboard-utils";

type Props = {
  now: Date;
  timeZone: string;
  view: DisplayView;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  familyMembers: FamilyMember[];
  sortedEvents: CalendarEvent[];
  todaysEvents: CalendarEvent[];
  selectedEvents: CalendarEvent[];
  currentEvent?: CalendarEvent;
  weekDays: Date[];
};

export default function TodayTimeline({
  now,
  timeZone,
  view,
  selectedDate,
  setSelectedDate,
  familyMembers,
  sortedEvents,
  todaysEvents,
  selectedEvents,
  currentEvent,
  weekDays,
}: Props) {
  const eventsToShow = view === "month" ? selectedEvents : todaysEvents;
  return (
    <article className="panel panel-main">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>{formatDateLabel(now, timeZone)}</h2>
        </div>
        <div className="nav-buttons">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
            <ChevronLeft className="icon" />
          </button>
          <button onClick={() => setSelectedDate(new Date())}>Today</button>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="icon" />
          </button>
        </div>
      </div>
      <div className="timeline">
        {eventsToShow.slice(0, 8).map((event) => {
          const owner = memberById(familyMembers, event.ownerId);
          const isCurrent = currentEvent?.id === event.id;
          return (
            <article
              key={event.id}
              className={`event-card ${isCurrent ? "current" : ""}`}
            >
              <span
                className="event-accent"
                style={{ backgroundColor: owner.color }}
              />
              <div>
                <div className="event-heading">
                  <h3>{event.title}</h3>
                  <span className="chip">{categoryLabel(event.category)}</span>
                </div>
                <p>
                  {getEventTimeLabel(event, timeZone)}{" "}
                  {event.location ? `· ${event.location}` : ""}
                </p>
                <p className="muted">{owner.name}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="week-strip">
        {weekDays.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const count = sortedEvents.filter(
            (event) => new Date(event.start).toISOString().slice(0, 10) === key,
          ).length;
          return (
            <button
              key={key}
              className={selectedDate.toISOString().slice(0, 10) === key ? "active" : ""}
              onClick={() => setSelectedDate(day)}
            >
              <span>{formatShortDate(day, timeZone).split(" ")[0]}</span>
              <strong>{day.getDate()}</strong>
              <small>{count} items</small>
            </button>
          );
        })}
      </div>
    </article>
  );
}
