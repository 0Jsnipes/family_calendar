"use client";

import { useEffect, useState } from "react";
import { CalendarSync, ExternalLink, RefreshCcw } from "lucide-react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { appConfig } from "@/lib/config";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { HubCalendarEvent } from "@/types";

type Props = {
  currentUserName: string;
};

type CalendarStatus = {
  connected: boolean;
  calendarIds?: string[];
  lastSyncAt?: string | null;
};

async function getAuthorizationHeader(user: User) {
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
}

function formatEventDate(value: string, allDay: boolean) {
  const date = new Date(value);

  if (allDay) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: appConfig.timezone,
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: appConfig.timezone,
  }).format(date);
}

export default function GoogleCalendarSync({ currentUserName }: Props) {
  const firebaseConfigured = isFirebaseClientConfigured();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<HubCalendarEvent[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(firebaseConfigured);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [pendingConnect, setPendingConnect] = useState(false);
  const [error, setError] = useState<string | null>(
    firebaseConfigured ? null : "Firebase client env vars are missing.",
  );

  useEffect(() => {
    if (!firebaseConfigured) return;

    return onIdTokenChanged(getFirebaseAuth(), (nextUser) => {
      setFirebaseUser(nextUser);
    });
  }, [firebaseConfigured]);

  useEffect(() => {
    if (!firebaseUser) {
      const timeoutId = window.setTimeout(() => {
        setLoadingStatus(false);
        setStatus(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const activeUser = firebaseUser;
    let ignore = false;

    async function loadStatus() {
      setLoadingStatus(true);

      try {
        const response = await fetch("/api/google/calendar/status", {
          headers: await getAuthorizationHeader(activeUser),
          cache: "no-store",
        });
        const payload = (await response.json()) as CalendarStatus & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load Google Calendar status.");
        }

        if (ignore) return;
        setStatus(payload);
        setError(null);
      } catch (caughtError) {
        if (ignore) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Google Calendar status.",
        );
      } finally {
        if (!ignore) {
          setLoadingStatus(false);
        }
      }
    }

    void loadStatus();

    return () => {
      ignore = true;
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !status?.connected) {
      const timeoutId = window.setTimeout(() => {
        setEvents([]);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const activeUser = firebaseUser;
    let ignore = false;

    async function loadEvents() {
      setLoadingEvents(true);

      try {
        const response = await fetch("/api/google/calendar/events", {
          headers: await getAuthorizationHeader(activeUser),
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          events?: HubCalendarEvent[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load Google Calendar events.");
        }

        if (ignore) return;
        setEvents(payload.events ?? []);
        setError(null);
      } catch (caughtError) {
        if (ignore) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Google Calendar events.",
        );
      } finally {
        if (!ignore) {
          setLoadingEvents(false);
        }
      }
    }

    void loadEvents();

    return () => {
      ignore = true;
    };
  }, [firebaseUser, status?.connected]);

  async function handleConnect() {
    if (!firebaseUser) {
      setError("You must be signed in to connect Google Calendar.");
      return;
    }

    setPendingConnect(true);
    setError(null);

    try {
      const response = await fetch("/api/google/calendar/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeader(firebaseUser)),
        },
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to start Google Calendar connection.");
      }

      window.location.assign(payload.url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start Google Calendar connection.",
      );
      setPendingConnect(false);
    }
  }

  async function handleRefreshEvents() {
    if (!firebaseUser) {
      setError("You must be signed in to refresh Google Calendar.");
      return;
    }

    setLoadingEvents(true);
    setError(null);

    try {
      const [statusResponse, eventsResponse] = await Promise.all([
        fetch("/api/google/calendar/status", {
          headers: await getAuthorizationHeader(firebaseUser),
          cache: "no-store",
        }),
        fetch("/api/google/calendar/events", {
          headers: await getAuthorizationHeader(firebaseUser),
          cache: "no-store",
        }),
      ]);

      const statusPayload = (await statusResponse.json()) as CalendarStatus & {
        error?: string;
      };
      const eventsPayload = (await eventsResponse.json()) as {
        events?: HubCalendarEvent[];
        error?: string;
      };

      if (!statusResponse.ok) {
        throw new Error(statusPayload.error ?? "Unable to refresh Google Calendar.");
      }

      if (!eventsResponse.ok) {
        throw new Error(eventsPayload.error ?? "Unable to refresh Google Calendar.");
      }

      setStatus(statusPayload);
      setEvents(eventsPayload.events ?? []);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refresh Google Calendar.",
      );
    } finally {
      setLoadingEvents(false);
    }
  }

  return (
    <section className="google-calendar-card">
      <div className="google-calendar-header">
        <div>
          <p className="eyebrow">Google Calendar</p>
          <h3>Personal sync for {currentUserName}</h3>
          <p className="page-subtitle">
            Connect your Google Calendar after Firebase sign-in and show the next 14
            days here on the hub.
          </p>
        </div>
        <div className="page-icon">
          <CalendarSync size={25} />
        </div>
      </div>

      <div className="google-calendar-actions">
        <span
          className={`provider-status ${
            status?.connected ? "good" : "warn"
          }`}
        >
          {loadingStatus
            ? "Checking status..."
            : status?.connected
              ? "Google Calendar Connected"
              : "Not connected"}
        </span>

        {!status?.connected ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleConnect()}
            disabled={pendingConnect || loadingStatus || !firebaseUser}
          >
            <ExternalLink size={17} />
            {pendingConnect ? "Redirecting..." : "Connect Google Calendar"}
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleRefreshEvents()}
            disabled={loadingEvents || !firebaseUser}
          >
            <RefreshCcw size={17} />
            {loadingEvents ? "Refreshing..." : "Refresh Events"}
          </button>
        )}
      </div>

      {status?.connected ? (
        <p className="google-calendar-meta">
          Calendars: {(status.calendarIds ?? ["primary"]).join(", ")}{" "}
          {status.lastSyncAt
            ? `· Last sync ${new Date(status.lastSyncAt).toLocaleString()}`
            : "· Not synced yet"}
        </p>
      ) : null}

      {error ? <p className="quiet-note">{error}</p> : null}

      <div className="google-calendar-events">
        {status?.connected && loadingEvents ? (
          <p className="schedule-empty">Loading Google Calendar events...</p>
        ) : status?.connected && events.length ? (
          events.map((event) => (
            <article key={event.id} className="google-calendar-event">
              <div>
                <strong>{event.title}</strong>
                <p>{formatEventDate(event.start, event.allDay)}</p>
                {event.location ? <small>{event.location}</small> : null}
              </div>
            </article>
          ))
        ) : status?.connected ? (
          <p className="schedule-empty">No upcoming Google Calendar events.</p>
        ) : (
          <p className="schedule-empty">
            Connect Google Calendar to show personal upcoming events on this hub.
          </p>
        )}
      </div>
    </section>
  );
}
