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
OPENWEATHER_API_KEY=
WEATHER_LOCATION=Lisbon
GOOGLE_CALENDAR_ACCESS_TOKEN=
GOOGLE_CALENDAR_ID=primary
SPOTIFY_ACCESS_TOKEN=
COOLIFY_URL=
COOLIFY_TOKEN=
```

OAuth/token acquisition is intentionally not included yet. Never prefix these values with `NEXT_PUBLIC_`.

## Production path

1. Put token acquisition and refresh in a server-side auth layer.
2. Move widget configuration from localStorage to a small database or device configuration API.
3. Add request timeouts, provider-specific retry/backoff, and integration health details before enabling live services broadly.
4. Deploy the Next.js app to a reachable host and point the Waveshare display client at `/preview`.
5. Validate touch targets and the exact 1024×600 viewport on the physical display.
