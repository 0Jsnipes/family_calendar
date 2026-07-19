# Family Hub

Family Hub is a standalone family calendar dashboard built for a wall-mounted tablet, Raspberry Pi touchscreen, or always-on browser display.

## What it does

- Shows today, week, and month calendar views
- Surfaces chores, meal planning, weather, and family status
- Loads dashboard content from environment variables
- Uses Google Calendar plus National Weather Service data
- Supports kiosk-style full-screen display and standby screensaver behavior

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and update the JSON-backed values for your household.

- `NEXT_PUBLIC_*` values are safe for the client
- Secret Google credentials stay server-side only
- `FAMILY_MEMBERS_JSON`, `CHORES_JSON`, and `MEAL_PLAN_JSON` are read on the server at request time
- Calendar events stay empty until Google Calendar credentials are connected

## Voice commands

Open "Add event" on the calendar page or the routine checklist drawer and tap
**Describe it** / **Add by voice** to speak the event or task instead of
typing it — e.g. "soccer practice tomorrow at 4 at the community field" or
"add milk, eggs, and take out the trash."

1. Set `NEXT_PUBLIC_ENABLE_VOICE="true"`.
2. Set `ANTHROPIC_API_KEY` — used to turn the transcript into structured
   event/task fields (title, date, time, location). Uses `claude-haiku-4-5`,
   which is inexpensive for this kind of short extraction.
3. On a normal browser (desktop/mobile Chrome, Edge, Safari), speech-to-text
   happens for free in the browser itself (the Web Speech API) — no other
   setup needed.
4. On the `/kiosk` tablet, Fully Kiosk Browser and other embedded webviews
   don't implement the Web Speech API, so the mic button instead records
   audio and uploads it for transcription. That requires `OPENAI_API_KEY`
   (Whisper) — without it, voice still works in real browsers, but tapping
   the mic on the kiosk shows a "transcription is not configured" error.

For events, the parsed event fills in the composer (title, date, time,
location) — you still review and tap **Save event**. For tasks, each parsed
item is added directly to the checklist.

## Connecting Google Calendar later

The current server helpers in `lib/calendar.ts` are structured for future Google Calendar integration.

Planned connection points:

- Read `GOOGLE_CALENDAR_IDS`
- Add OAuth refresh-token or server credential flow
- Fetch Google events on the server
- Map Google events into the shared `CalendarEvent` type
- Support incremental sync with `nextSyncToken`

## Kiosk mode (display behavior)

Useful query params on the normal `/` route:

- `?view=today`
- `?view=week`
- `?view=month`
- `?kiosk=true`

The dashboard includes an idle screensaver mode and a dimmed night mode for display use.

This is separate from the **`/kiosk` route** described below, which is a dedicated
sign-in path for tablets/wall displays that can't use Google sign-in.

## Firebase Authentication setup

1. In the [Firebase Console](https://console.firebase.google.com/), open the
   project (`family-calendar-8cf78`) → **Authentication → Settings →
   Authorized domains**, and confirm the Vercel domain
   (`family-calendar-gamma-three.vercel.app`) is listed, along with any
   custom domain and `localhost` for local dev.
2. Under **Authentication → Sign-in method**, make sure **Google** is
   enabled (used by normal users on `/`).
3. Under the same page, enable the **Email/Password** provider — this is
   what the `/kiosk` route uses. It's off by default.

Normal sign-in (`/`) uses `signInWithPopup` first and only falls back to
`signInWithRedirect` if the popup itself is blocked or unsupported in that
browser. This avoids the popular Android Chrome/PWA failure mode where a
redirect round-trip lands on `.../__/auth/handler` with "missing initial
state" — that page belongs to Firebase, not this app, and depends on
`sessionStorage` surviving a full-page navigation, which mobile browsers
don't always guarantee. Kiosk/embedded-webview browsers (Fully Kiosk
Browser, in-app webviews) generally can't complete Google OAuth at all
(`403: disallowed_useragent`) — those devices should use `/kiosk` instead of
`/`.

## Kiosk device setup (`/kiosk`)

`/kiosk` is a dedicated sign-in path for tablets and wall displays. It never
shows Google sign-in, never opens a popup, and never redirects through
Google's OAuth screens — so it works in kiosk browsers that reject Google's
user-agent check. The kiosk account itself has the same permissions as any
other signed-in family member (see below) — the only thing that's different
about `/kiosk` is *how* it signs in.

1. **Enable Email/Password auth** (see above) if you haven't already.
2. **Create a Firebase Auth user for the kiosk device** — Firebase Console
   → Authentication → Users → Add user. Use a dedicated email you control,
   e.g. `kitchen-hub@yourdomain.com`, and set a password.
3. **Add that user as a hub member with the `kiosk` role.** In Firestore,
   under `hubs/default/members/{uid}` (use the UID from the user you just
   created), create a document:
   ```
   type: "account"
   uid: "<the kiosk user's UID>"
   email: "kitchen-hub@yourdomain.com"
   displayName: "Kitchen Hub"
   role: "kiosk"
   status: "active"
   calendarConnected: false
   showCalendarOnHub: false
   color: "#2563eb"
   createdAt: <server timestamp>
   updatedAt: <server timestamp>
   ```
   The `kiosk` role is intentionally not exposed in the app's own "add
   member" UI — it's only granted by editing Firestore directly, so it
   can't be self-assigned.
4. On the tablet, open **`https://family-calendar-gamma-three.vercel.app/kiosk`**
   in Fully Kiosk Browser (or any browser) and sign in once with the kiosk
   email/password. The session persists locally, so it survives refreshes,
   app relaunches, and browser restarts.
5. **Do not use Google sign-in in Fully Kiosk Browser** — it will fail with
   `403: disallowed_useragent`. Always use `/kiosk`.

### What kiosk accounts can do

The `kiosk` role has full access, same as any other signed-in family
member — it can add/edit/delete calendar events, routine tasks, and notes,
manage hub members and invites, and connect Google Calendar. The `kiosk`
role is intentionally not exposed in the app's own "add member" UI — it's
only granted by editing Firestore directly, so it can't be self-assigned by
an invited member. If you want a device to have *less* access than a normal
member, don't use the `kiosk` role for it — invite it as a normal
member/child account instead.

The kiosk display also auto-recovers on its own: it shows a
"Reconnecting..." banner while offline and refreshes automatically when the
network returns, refetches data every few minutes, and does a full reload
every few hours to avoid long-uptime drift.

## Testing checklist

1. Normal desktop Chrome Google login works (`/`).
2. Normal Android Chrome Google login works, or shows a clean in-app error
   instead of getting stuck on a Firebase-hosted page.
3. Fully Kiosk Browser never shows a Google sign-in button or popup.
4. `/kiosk` email/password login works.
5. `/kiosk` stays signed in after a refresh, app relaunch, or browser
   restart.
6. A kiosk account can view and fully use the hub dashboard (calendar,
   weather, routine, notes, family members, member management).
7. The app never gets stuck on a blank white screen, in any of the above
   flows.

## Recommended display settings

- 1280x800 for compact tablets
- 1920x1080 for wall displays
- Landscape orientation
- Auto-hide browser UI if possible
- Keep brightness moderate to reduce burn-in

## Production notes

- National Weather Service data requires no API key
- Keep secrets server-side only
- Add app icons before publishing as a PWA
- Use the included manifest for standalone install behavior
