"use client";

import { Sparkles } from "lucide-react";
import { formatClock, formatShortDate } from "@/lib/date";
import type { CalendarEvent, FamilyMember } from "@/types";
import { memberById } from "./dashboard-utils";

type Props = {
  events: CalendarEvent[];
  familyMembers: FamilyMember[];
  timeZone: string;
};

export default function NextUpPanel({
  events,
  familyMembers,
  timeZone,
}: Props) {
  return (
    <article className="mini-card">
      <div className="panel-header compact">
        <h2>Next Up</h2>
        <Sparkles className="icon" />
      </div>
      {events.length ? (
        events.map((event) => {
          const owner = memberById(familyMembers, event.ownerId);
          return (
            <div key={event.id} className="next-item">
              <span style={{ backgroundColor: owner.color }} />
              <div>
                <strong>{event.title}</strong>
                <p>
                  {formatShortDate(new Date(event.start), timeZone)} at{" "}
                  {formatClock(new Date(event.start), timeZone)}
                </p>
              </div>
            </div>
          );
        })
      ) : (
        <p className="empty-copy">Nothing on the calendar yet.</p>
      )}
    </article>
  );
}
