This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Desk Dashboard

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

### Spotify (permanent access)

1. In `/admin/credentials`, save the Spotify client ID and client secret.
2. Register `<your-domain>/api/auth/spotify/callback` as an exact redirect URI in the Spotify Developer Dashboard.
3. Click **Connect Spotify** and approve access once.

The encrypted refresh token is stored alongside the other service credentials. The server uses it to mint short-lived access tokens automatically. `SPOTIFY_ACCESS_TOKEN` remains available as a temporary fallback for local testing.

## Production path

1. ~~Put token acquisition and refresh in a server-side auth layer.~~ Done for Google Calendar and Spotify (OAuth + refresh tokens, see above).
2. Move widget configuration from localStorage to a small database or device configuration API.
3. Add request timeouts, provider-specific retry/backoff, and integration health details before enabling live services broadly.
4. Deploy the Next.js app to a reachable host and point the Waveshare display client at `/preview`.
5. Validate touch targets and the exact 1024×600 viewport on the physical display.
