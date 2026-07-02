# Google Calendar Setup

## Google Cloud Console

1. Enable the Google Calendar API in your Google Cloud project.
2. Create an OAuth 2.0 Web application client.
3. Add the redirect URI:

```txt
http://localhost:3000/api/google/calendar/callback
```

4. If the OAuth consent screen is in testing mode, add your Google account as a test user.

## Required env vars

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/calendar/callback"
GOOGLE_TOKEN_ENCRYPTION_KEY=""

FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
```

You also still need the existing Firebase client env vars for sign-in.

## Generate the encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use the output as `GOOGLE_TOKEN_ENCRYPTION_KEY`.

## Local test flow

1. Run `npm install`.
2. Run `npm run dev`.
3. Sign in with an allowed Firebase/Google account.
4. Open the `Coming soon` page from the hub dock.
5. Click `Connect Google Calendar`.
6. Approve read-only Google Calendar access.
7. After redirecting back to `/`, return to `Coming soon`.
8. Confirm the connection badge changes to connected and upcoming events load.
