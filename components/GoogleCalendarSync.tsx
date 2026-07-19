"use client";

import { useEffect, useState } from "react";
import { CalendarSync, ExternalLink, RefreshCcw } from "lucide-react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { HubCalendarEvent } from "@/types";

type Props = {
  currentUserName: string;
};

type CalendarStatus = {
  success?: boolean;
  connected: boolean;
  reconnectRequired?: boolean;
  calendarIds?: string[];
  lastSyncAt?: string | null;
};

type CalendarApiErrorCode =
  | "GOOGLE_RECONNECT_REQUIRED"
  | "GOOGLE_CALENDAR_RATE_LIMITED"
  | "GOOGLE_CALENDAR_TEMPORARILY_UNAVAILABLE"
  | "GOOGLE_CALENDAR_PERMISSION_DENIED"
  | "GOOGLE_CALENDAR_FORBIDDEN"
  | "UNAUTHENTICATED"
  | "UNKNOWN";

type CalendarApiError = {
  success?: false;
  code?: CalendarApiErrorCode;
  message?: string;
  error?: string;
};

class CalendarRequestError extends Error {
  code: CalendarApiErrorCode;
  status: number;

  constructor(input: { code?: string; message: string; status: number }) {
    super(input.message);
    this.name = "CalendarRequestError";
    this.code = isCalendarApiErrorCode(input.code) ? input.code : "UNKNOWN";
    this.status = input.status;
  }
}

function isCalendarApiErrorCode(code: string | undefined): code is CalendarApiErrorCode {
  return (
    code === "GOOGLE_RECONNECT_REQUIRED" ||
    code === "GOOGLE_CALENDAR_RATE_LIMITED" ||
    code === "GOOGLE_CALENDAR_TEMPORARILY_UNAVAILABLE" ||
    code === "GOOGLE_CALENDAR_PERMISSION_DENIED" ||
    code === "GOOGLE_CALENDAR_FORBIDDEN" ||
    code === "UNAUTHENTICATED"
  );
}

async function readJsonResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as T & CalendarApiError;

  if (!response.ok) {
    throw new CalendarRequestError({
      code: payload.code,
      message: payload.message ?? payload.error ?? "Unable to load Google Calendar.",
      status: response.status,
    });
  }

  return payload;
}

function getCalendarErrorMessage(error: unknown) {
  if (error instanceof CalendarRequestError) {
    if (error.code === "GOOGLE_RECONNECT_REQUIRED") {
      return "Your Google Calendar connection has expired or was revoked.";
    }

    return error.message;
  }

  return error instanceof Error ? error.message : "Unable to load Google Calendar.";
}

async function getAuthorizationHeader(user: User) {
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
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
  const [errorCode, setErrorCode] = useState<CalendarApiErrorCode | null>(null);

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
        setEvents([]);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const activeUser = firebaseUser;
    let ignore = false;
    const controller = new AbortController();

    async function loadStatus() {
      setLoadingStatus(true);
      setError(null);
      setErrorCode(null);

      try {
        const response = await fetch("/api/google/calendar/status", {
          headers: await getAuthorizationHeader(activeUser),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await readJsonResponse<CalendarStatus>(response);

        if (ignore) return;
        setStatus(payload);
        if (payload.reconnectRequired) {
          setError("Your Google Calendar connection has expired or was revoked.");
          setErrorCode("GOOGLE_RECONNECT_REQUIRED");
        } else {
          setError(null);
          setErrorCode(null);
        }
      } catch (caughtError) {
        if (ignore) return;
        setError(getCalendarErrorMessage(caughtError));
        setErrorCode(
          caughtError instanceof CalendarRequestError ? caughtError.code : "UNKNOWN",
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
      controller.abort();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !status?.connected || status.reconnectRequired) {
      const timeoutId = window.setTimeout(() => {
        setEvents([]);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const activeUser = firebaseUser;
    let ignore = false;
    const controller = new AbortController();

    async function loadEvents() {
      setLoadingEvents(true);
      setError(null);
      setErrorCode(null);

      try {
        const response = await fetch("/api/google/calendar/events", {
          headers: await getAuthorizationHeader(activeUser),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await readJsonResponse<{ events?: HubCalendarEvent[] }>(response);

        if (ignore) return;
        setEvents(payload.events ?? []);
        setError(null);
        setErrorCode(null);
      } catch (caughtError) {
        if (ignore) return;
        setError(getCalendarErrorMessage(caughtError));
        setErrorCode(
          caughtError instanceof CalendarRequestError ? caughtError.code : "UNKNOWN",
        );
        if (
          caughtError instanceof CalendarRequestError &&
          caughtError.code === "GOOGLE_RECONNECT_REQUIRED"
        ) {
          setStatus((current) =>
            current ? { ...current, connected: false, reconnectRequired: true } : current,
          );
        }
      } finally {
        if (!ignore) {
          setLoadingEvents(false);
        }
      }
    }

    void loadEvents();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [firebaseUser, status?.connected, status?.reconnectRequired]);

  async function handleConnect() {
    if (!firebaseUser) {
      setError("You must be signed in to connect Google Calendar.");
      return;
    }
    if (pendingConnect) return;

    setPendingConnect(true);
    setError(null);
    setErrorCode(null);

    try {
      const response = await fetch("/api/google/calendar/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeader(firebaseUser)),
        },
        cache: "no-store",
      });
      const payload = await readJsonResponse<{ url?: string }>(response);

      if (!payload.url) {
        throw new Error("Unable to start Google Calendar connection.");
      }

      window.location.assign(payload.url);
    } catch (caughtError) {
      setError(getCalendarErrorMessage(caughtError));
      setErrorCode(
        caughtError instanceof CalendarRequestError ? caughtError.code : "UNKNOWN",
      );
      setPendingConnect(false);
    }
  }

  async function handleRefreshEvents() {
    if (!firebaseUser) {
      setError("You must be signed in to refresh Google Calendar.");
      return;
    }
    if (loadingEvents || loadingStatus || pendingConnect) return;

    setLoadingEvents(true);
    setError(null);
    setErrorCode(null);

    try {
      const headers = await getAuthorizationHeader(firebaseUser);
      const statusResponse = await fetch("/api/google/calendar/status", {
        headers,
        cache: "no-store",
      });
      const statusPayload = await readJsonResponse<CalendarStatus>(statusResponse);
      setStatus(statusPayload);

      if (statusPayload.reconnectRequired || !statusPayload.connected) {
        setEvents([]);
        setError(
          statusPayload.reconnectRequired
            ? "Your Google Calendar connection has expired or was revoked."
            : null,
        );
        setErrorCode(
          statusPayload.reconnectRequired ? "GOOGLE_RECONNECT_REQUIRED" : null,
        );
        return;
      }

      const eventsResponse = await fetch("/api/google/calendar/events", {
        headers,
        cache: "no-store",
      });
      const eventsPayload = await readJsonResponse<{
        events?: HubCalendarEvent[];
      }>(eventsResponse);

      setEvents(eventsPayload.events ?? []);
    } catch (caughtError) {
      setError(getCalendarErrorMessage(caughtError));
      setErrorCode(
        caughtError instanceof CalendarRequestError ? caughtError.code : "UNKNOWN",
      );
      if (
        caughtError instanceof CalendarRequestError &&
        caughtError.code === "GOOGLE_RECONNECT_REQUIRED"
      ) {
        setStatus((current) =>
          current ? { ...current, connected: false, reconnectRequired: true } : current,
        );
        setEvents([]);
      }
    } finally {
      setLoadingEvents(false);
    }
  }

  const statusLabel = loadingStatus
    ? "Checking Google Calendar..."
    : status?.reconnectRequired
      ? "Google Calendar needs reconnecting"
      : status?.connected
        ? loadingEvents
          ? "Loading Google Calendar..."
          : events.length
            ? `Google Calendar connected - ${events.length} upcoming`
            : "Google Calendar connected - No upcoming family events in the next 7 days"
        : "Google Calendar not connected";
  const shouldConnect = !status?.connected || status?.reconnectRequired;
  const connectLabel = pendingConnect
    ? "Redirecting..."
    : status?.reconnectRequired || errorCode === "GOOGLE_RECONNECT_REQUIRED"
      ? "Reconnect Google Calendar"
      : "Connect Google Calendar";

  return (
    <div className="google-calendar-bar">
      <span
        className={`provider-status ${status?.connected && !status.reconnectRequired ? "good" : "warn"}`}
        title={`Personal sync for ${currentUserName}`}
      >
        <CalendarSync size={15} />
        {statusLabel}
      </span>

      {shouldConnect ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleConnect()}
          disabled={pendingConnect || loadingStatus || !firebaseUser}
        >
          <ExternalLink size={16} />
          {connectLabel}
        </button>
      ) : (
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleRefreshEvents()}
          disabled={loadingEvents || loadingStatus || !firebaseUser}
        >
          <RefreshCcw size={16} />
          {loadingEvents ? "Refreshing..." : "Refresh events"}
        </button>
      )}

      {error ? <span className="google-calendar-bar-error">{error}</span> : null}
    </div>
  );
}
