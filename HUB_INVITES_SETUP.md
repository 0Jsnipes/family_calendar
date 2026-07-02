# Hub Invites Setup

## Required env vars

```env
HUB_OWNER_EMAILS="snipes1995@gmail.com"
DEFAULT_HUB_NAME="Snipes Family Hub"
FIREBASE_MAIL_COLLECTION="mail"
NEXT_PUBLIC_APP_URL="https://family-calendar-gamma-three.vercel.app"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""
GOOGLE_TOKEN_ENCRYPTION_KEY=""
```

## Firebase Trigger Email extension

1. Install the Firebase Trigger Email extension in your Firebase project.
2. Configure it to watch the collection named by `FIREBASE_MAIL_COLLECTION`.
3. Connect the extension to a working SMTP provider.
4. The app writes invite emails server-side only. Clients do not write mail docs directly.

## Local testing

1. Add your owner email to `HUB_OWNER_EMAILS`.
2. Sign in with that account.
3. If no hub exists yet, the app bootstraps the default hub automatically.
4. Open Settings and use the members card to invite another account or add a local-only member.

## Invite flow

1. Invite a member from Settings.
2. Confirm a mail doc is written to the configured mail collection.
3. Open the invite link from the email: `/invite/{token}`.
4. Sign in as the invited Firebase user.
5. Accept the invite and open the hub.

## Local-only members

Use `Add local` for child or profile-only members. They do not log in and never sync Google Calendar.

## Removing members

- Removing an account member marks their hub member record as `removed`.
- Their Firebase Auth account is not deleted.
- Their personal Google integration doc is not deleted.
- Removed account members no longer see the hub and their calendar is not merged into hub events.

## Google OAuth testing note

If your Google OAuth app is still in Testing mode, every invited user who wants calendar sync must also be added as a Google OAuth test user in Google Cloud before they can connect Google Calendar.
