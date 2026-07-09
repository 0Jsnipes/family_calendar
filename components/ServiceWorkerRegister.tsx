"use client";

import { useEffect } from "react";

// Registering a service worker (public/sw.js) is required for Chrome to
// treat this site as a real installable PWA instead of falling back to a
// plain bookmark shortcut when a family member taps "Add to Home Screen".
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
