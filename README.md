# Family Hub

**Family Hub** is a full-stack household dashboard designed for wall-mounted tablets, touchscreens, and always-on displays. This was made as a personal project you will need to connect your google calendar secrets to be able to use and edit the approved emails in your .ENV

It combines shared calendars, routines, weather, meal planning, family status, voice input, authentication, and kiosk-specific behavior into a single responsive interface built for daily household use.

## Highlights

* Shared day, week, and month calendar views
* Google Calendar integration architecture
* Voice-created events and tasks
* AI-assisted natural-language parsing
* Household routines, chores, notes, and meal planning
* National Weather Service integration
* Multi-user Firebase authentication
* Dedicated kiosk authentication flow
* Offline recovery and long-running display support
* Responsive PWA-style interface
* Tablet, desktop, mobile, and wall-display support

## Tech Stack

* **Next.js**
* **React**
* **TypeScript**
* **Firebase Authentication**
* **Firestore**
* **Google Calendar APIs**
* **OpenAI Whisper**
* **Anthropic Claude**
* **Web Speech API**
* **National Weather Service API**
* **Vercel**

## Why I Built It

Family scheduling tools are usually designed around phones or individual calendars.

Family Hub was designed around a different use case: a shared household display that stays available throughout the day and works more like a small operating system for the home.

That required solving several problems beyond a normal calendar interface, including:

* Persistent kiosk sessions
* Authentication inside restricted embedded browsers
* Network recovery for always-on devices
* Voice input across browsers with different API capabilities
* Multiple calendar views
* Household-specific state
* Long-running browser reliability
* Responsive layouts across tablets, desktops, and mobile devices

## Voice Commands

Users can create events and routine tasks using natural-language voice input.

Examples:

```text
Soccer practice tomorrow at 4 at the community field
```

```text
Add milk, eggs, and take out the trash
```

In standard browsers, Family Hub uses the browser's **Web Speech API** for transcription.

The resulting text is sent to **Anthropic Claude** to extract structured information such as:

* Event title
* Date
* Time
* Location
* Task items

For kiosk browsers and embedded webviews that do not support the Web Speech API, the application records audio and uses **OpenAI Whisper** for transcription.

This creates two separate voice-processing paths while maintaining the same user experience.

## Kiosk Architecture

Family Hub includes a dedicated `/kiosk` authentication path for wall-mounted tablets and embedded browsers.

Google OAuth does not reliably work inside many kiosk browsers because embedded webviews can trigger Google's `disallowed_useragent` restriction.

Instead of forcing the normal authentication flow into an unsupported environment, Family Hub uses:

* Google authentication for standard browsers
* Email/password authentication for kiosk devices
* Persistent Firebase sessions
* Dedicated kiosk accounts
* Automatic reconnect handling
* Periodic data refresh
* Periodic full-page recovery for long-running sessions

This allows a tablet to remain logged in and operational through browser restarts, temporary network outages, and extended uptime.

## Authentication

Standard users authenticate using Firebase Google Sign-In.

The application prefers:

```text
signInWithPopup
```

and falls back to:

```text
signInWithRedirect
```

when necessary.

This avoids an Android Chrome/PWA issue where redirect-based authentication can lose the browser's stored OAuth state during a full-page navigation.

Kiosk devices use a separate email/password authentication flow because embedded kiosk browsers generally cannot complete Google OAuth.

## Calendar Architecture

The application is structured to support Google Calendar synchronization through server-side helpers.

Planned and existing integration points include:

* Multiple Google Calendar IDs
* Server-side event fetching
* Shared `CalendarEvent` models
* OAuth refresh-token support
* Incremental synchronization through `nextSyncToken`
* Event normalization before rendering

The UI supports:

* Today view
* Week view
* Month view
* Kiosk display mode

Useful query parameters include:

```text
?view=today
?view=week
?view=month
?kiosk=true
```

## Household Dashboard

Family Hub surfaces more than calendar events.

The dashboard can include:

* Family members
* Daily routines
* Chores
* Meal planning
* Notes
* Weather
* Household status
* Calendar events

Household configuration is loaded server-side so sensitive configuration does not need to be exposed to the browser.

## Reliability

Because the application is intended to run continuously on a household display, reliability behavior is built into the kiosk experience.

The display can:

* Detect offline status
* Show a reconnecting state
* Recover when connectivity returns
* Refresh application data periodically
* Perform scheduled full reloads to prevent long-running browser drift
* Persist kiosk authentication across restarts

These features make the application suitable for an always-on display rather than only short browser sessions.

## Accessibility and Device Support

Family Hub is designed for:

* Desktop browsers
* Mobile browsers
* Android tablets
* Wall-mounted displays
* Raspberry Pi touchscreens
* Kiosk browsers
* Progressive Web App installations

Recommended display resolutions include:

* `1280x800`
* `1920x1080`

Landscape orientation provides the best dashboard experience.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Then configure the required services.

## Environment Variables

Example configuration includes:

```env
NEXT_PUBLIC_ENABLE_VOICE=true

ANTHROPIC_API_KEY=
OPENAI_API_KEY=

GOOGLE_CALENDAR_IDS=
```

Household configuration can also be provided through server-side values such as:

```env
FAMILY_MEMBERS_JSON=
CHORES_JSON=
MEAL_PLAN_JSON=
```

Client-safe values use the `NEXT_PUBLIC_` prefix.

Sensitive API keys and credentials remain server-side.

## Testing

Key application flows include:

* Desktop Google authentication
* Android browser authentication
* Kiosk email/password authentication
* Persistent kiosk sessions
* Offline recovery
* Calendar rendering
* Voice event creation
* Voice task creation
* Household member management
* Responsive tablet layouts

## Production Considerations

* National Weather Service data does not require an API key.
* Sensitive Google, OpenAI, and Anthropic credentials remain server-side.
* Embedded kiosk browsers use a separate authentication strategy from standard browsers.
* The application includes manifest support for standalone installation.
* Production deployments should include finalized PWA icons and platform metadata.

## Project Status

Family Hub is an actively developed personal software project focused on experimenting with:

* Full-stack application architecture
* Household automation
* AI-assisted interfaces
* Cross-device authentication
* PWA behavior
* Voice interaction
* Always-on kiosk applications
* Third-party API integration
