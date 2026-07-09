"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const DATA_REFRESH_MS = 3 * 60 * 1000;
const FULL_RELOAD_MS = 4 * 60 * 60 * 1000;

/** Keeps a kiosk display fresh over long unattended uptimes: periodically
 * re-fetches server data, does a full reload every few hours to clear any
 * accumulated client-side memory/state drift, and re-syncs immediately when
 * connectivity comes back after an outage. */
export function useKioskAutoRefresh(enabled: boolean, isOnline: boolean) {
  const router = useRouter();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const dataInterval = window.setInterval(() => {
      router.refresh();
    }, DATA_REFRESH_MS);

    const reloadInterval = window.setInterval(() => {
      window.location.reload();
    }, FULL_RELOAD_MS);

    return () => {
      window.clearInterval(dataInterval);
      window.clearInterval(reloadInterval);
    };
  }, [enabled, router]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!enabled || !isOnline) return;
    router.refresh();
    // Only fire when connectivity is regained, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);
}
