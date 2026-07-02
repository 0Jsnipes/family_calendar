# Family Hub

Family Hub is a standalone family calendar dashboard built for a wall-mounted tablet, Raspberry Pi touchscreen, or always-on browser display.

## What it does

- Shows today, week, and month calendar views
- Surfaces chores, meal planning, weather, and family status
- Loads dashboard content from environment variables
- Is ready for later Google Calendar and weather integration
- Supports kiosk-style full-screen display and standby screensaver behavior

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and update the JSON-backed values for your household.

- `NEXT_PUBLIC_*` values are safe for the client
- Secret Google and weather keys stay server-side only
- `FAMILY_MEMBERS_JSON`, `CHORES_JSON`, `MEAL_PLAN_JSON`, and `WEATHER_JSON` are read on the server at request time
- Calendar events stay empty until Google Calendar credentials are connected

## Connecting Google Calendar later

The current server helpers in `lib/calendar.ts` are structured for future Google Calendar integration.

Planned connection points:

- Read `GOOGLE_CALENDAR_IDS`
- Add OAuth refresh-token or server credential flow
- Fetch Google events on the server
- Map Google events into the shared `CalendarEvent` type
- Support incremental sync with `nextSyncToken`

## Kiosk mode

Useful query params:

- `?view=today`
- `?view=week`
- `?view=month`
- `?kiosk=true`

The dashboard includes an idle screensaver mode and a dimmed night mode for display use.

## Recommended display settings

- 1280x800 for compact tablets
- 1920x1080 for wall displays
- Landscape orientation
- Auto-hide browser UI if possible
- Keep brightness moderate to reduce burn-in

## Production notes

- Add real calendar and weather providers before launch
- Keep secrets server-side only
- Add app icons before publishing as a PWA
- Use the included manifest for standalone install behavior
