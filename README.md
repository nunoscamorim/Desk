# Desk Dashboard

A 1024×600 desk display: calendar, weather, now playing, tasks and AI usage on a Waveshare ESP32-S3 panel, served by Next.js.

## Run locally

```bash
npm install
npm run dev
```

Open `/admin` to configure the 1024×600 layout and `/preview` for the clean display view.

## Coolify deployment

Create a Docker application in Coolify from the GitHub repository and use the included `Dockerfile`. Set the container port to `3000`, enable HTTPS, and mount a persistent volume at `/app/data` so dashboard configuration and encrypted credentials survive redeploys.

Required environment variables:

```env
ADMIN_PASSWORD=
AUTH_SECRET=
```

**`AUTH_SECRET` must be set once and never changed.** It derives the AES key for `data/service-credentials.enc`, so rotating or regenerating it leaves that file intact but undecryptable, and every connected integration silently reverts to disconnected. Changing it means reconnecting each account by hand. The server logs `[credentials] … could not be decrypted` when this has happened.

Add provider variables from `.env.example` only when those integrations are configured. Set the health check path to `/api/config/services`.

## Real service configuration

The dashboard uses mocks when credentials are absent. Add these server-only variables to enable the available adapters:

```env
WEATHER_LOCATION=Lisbon
WEATHER_LATITUDE=38.7223
WEATHER_LONGITUDE=-9.1393
GOOGLE_CALENDAR_ID=primary
SPOTIFY_ACCESS_TOKEN=
COOLIFY_URL=
COOLIFY_TOKEN=
```

Never prefix these values with `NEXT_PUBLIC_`.

Weather data comes from Open-Meteo and does not require an API key. Set the display name and coordinates with `WEATHER_LOCATION`, `WEATHER_LATITUDE`, and `WEATHER_LONGITUDE`.

### Google Calendar (permanent access)

Google access tokens expire in about an hour, so the dashboard doesn't use one directly. Instead:

1. In `/admin/credentials`, save the Google **client ID** and **client secret** from a project in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (enable the Calendar API, add `<your-domain>/api/auth/google-calendar/callback` as a redirect URI).
2. Click **Connect Google Calendar** on that same page and approve access once.
3. The server stores the refresh token it gets back (encrypted, alongside the client id/secret) and mints a new access token from it on every dashboard request — no more manual token pasting, and it survives redeploys as long as `/app/data` is a persistent volume.

One catch: if the Google Cloud project's OAuth consent screen is still in "Testing" status, Google force-expires the connection after **7 days** no matter what. Move it to "In production" (or "Internal" for a personal Workspace account) under OAuth consent screen settings for the connection to actually be permanent. A refresh token also expires after 6 months of the dashboard never calling the API — not a concern here since the widget polls regularly.

`GOOGLE_CALENDAR_ACCESS_TOKEN` is still read as a legacy fallback if set directly, but it is not refreshed and will stop working after about an hour — useful only for a quick manual test, not the real integration.

**Do not leave it set in a real deployment.** It is only consulted when the stored refresh token cannot be read, so it turns a clear "not connected" failure into a calendar that works for a few minutes after each restart and then stays broken — the hardest version of this problem to diagnose. The Google client id and secret are read *only* from the credential store; setting those as environment variables does nothing at all.

### Calendar by .ics feed

The lower-maintenance alternative to OAuth. A published feed URL never expires and needs no refresh, so there is no token to go stale and nothing to persist:

```env
CALENDAR_ICS_URLS=https://…/work.ics,https://…/personal.ics
```

List one URL per calendar, comma or newline separated; they are merged into a single timeline, which is how calendars living in different accounts — work and personal — reach one display. Recurring events are expanded with `RRULE`, `EXDATE` and `RECURRENCE-ID` all honored. A feed that is unreachable or malformed is logged and dropped from the merge rather than taking the whole calendar down.

Get the URLs from iCloud (Calendar.app → Share Calendar → Public Calendar), Google (*secret address in iCal format*), or Outlook's published calendars. Two caveats: Google's own feed is cached on their side and can lag by hours, which makes it a poor fit for the next-meeting widget; and each URL is a bearer secret, so anyone holding one can read that calendar.

When `CALENDAR_ICS_URLS` is set it replaces the Google backend rather than running alongside it — provider ids differ, so the same meeting would otherwise appear twice.

### Apple Reminders (tasks widget)

Apple Reminders has no public API and cannot be published to a URL the way a calendar can, but iCloud exposes reminder lists over CalDAV as `VTODO` collections. The server reads them directly:

```env
APPLE_REMINDERS_ID=you@icloud.com
APPLE_REMINDERS_APP_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_REMINDERS_LISTS=Reminders,Groceries
```

`APPLE_REMINDERS_APP_PASSWORD` must be an **app-specific password**, generated at [appleid.apple.com](https://appleid.apple.com) under Sign-In and Security — iCloud rejects the account password outright once two-factor auth is on. Leave `APPLE_REMINDERS_LISTS` empty to read every list, or name the ones you want; matching ignores case.

Reminders map onto the widget as you would expect: the list name becomes the project, `PRIORITY` 1–4/5/6–9 becomes high/medium/low, and a reminder with no priority set reads as low so flagged ones still stand out. Completed and cancelled reminders are dropped, and what is left sorts by due date with undated items last, so the few rows the widget shows are the ones that matter. One unreachable list is logged and skipped rather than blanking the widget.

This is an unofficial protocol surface — Apple documents CalDAV for calendars, not Reminders — so it could change without notice. It has been stable for years and is what third-party task clients use.

### Spotify (permanent access)

1. In `/admin/credentials`, save the Spotify client ID and client secret.
2. Register `<your-domain>/api/auth/spotify/callback` as an exact redirect URI in the Spotify Developer Dashboard.
3. Click **Connect Spotify** and approve access once.

Now playing is fetched from its own `/api/spotify` endpoint every 3 seconds, independently of the display's dashboard refresh interval — a track changes far too often to wait on the cadence that suits weather and a calendar. The endpoint caches the upstream reading for a few seconds, so the number of calls to Spotify stays flat regardless of how many viewers are watching, and the progress bar advances locally between polls.

The encrypted refresh token is stored alongside the other service credentials. The server uses it to mint short-lived access tokens automatically. `SPOTIFY_ACCESS_TOKEN` remains available as a temporary fallback for local testing.

## Troubleshooting

Every integration degrades into plausible-looking data, so a broken service is invisible on the display itself — the server log is where the truth is. Each fallback records why it engaged:

| Log line | Meaning | Fix |
| --- | --- | --- |
| `[credentials] … could not be decrypted` | `AUTH_SECRET` no longer matches the one that encrypted the file | Restore the original secret, or reconnect each integration |
| `[google-calendar] using GOOGLE_CALENDAR_ACCESS_TOKEN…` | The stored refresh token was unreadable and it fell back to the legacy token, which dies in ~1hr | Check the `/app/data` volume and `AUTH_SECRET`, then unset the variable |
| `Google Calendar must be reconnected: …` | The refresh token itself was rejected (`invalid_grant`) — revoked, or force-expired by a consent screen still in "Testing" | Reconnect in `/admin/credentials`; move the consent screen to "In production" |
| `[ical] feed failed: …` | One .ics feed is unreachable or malformed; the others still merged | Re-check that feed URL |
| `[dashboard] <service> unavailable, using fallback` | That service timed out or errored | Reason is appended to the line |

**"The calendar worked for a while, then stopped until a restart."** The access token was rejected before its cached expiry and the dead token kept being replayed. This is fixed — a 401 now forces a fresh token and retries once — but the same shape reappears whenever `/app/data` or `AUTH_SECRET` is lost, because the connection quietly downgrades to the unrefreshable legacy token. Check those two first.

## Production path

1. ~~Put token acquisition and refresh in a server-side auth layer.~~ Done for Google Calendar and Spotify (OAuth + refresh tokens, see above).
2. Move widget configuration from localStorage to a small database or device configuration API.
3. ~~Add request timeouts, provider-specific retry/backoff, and integration health details before enabling live services broadly.~~ Timeouts bound every outbound call, Google Calendar retries once on 401 with a forced token re-mint, and failures are logged with their reason (see Troubleshooting). Per-provider backoff is still outstanding.
4. Deploy the Next.js app to a reachable host and point the Waveshare display client at `/preview`.
5. Validate touch targets and the exact 1024×600 viewport on the physical display.
