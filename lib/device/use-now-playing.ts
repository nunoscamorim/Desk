"use client";

import { useEffect, useState } from "react";
import type { SpotifyNowPlaying } from "@/lib/dashboard/types";

/**
 * Polls the now-playing endpoint on its own fast interval, independent of the
 * display's dashboard refresh.
 *
 * A track change has to appear within a few seconds to feel live, so this runs
 * far faster than the rest of the dashboard. It stays cheap because the server
 * caches the upstream reading, so a short interval here costs requests to our
 * own server rather than to Spotify.
 */

const POLL_MS = 3000;

export function useNowPlaying(enabled = true): SpotifyNowPlaying | null | undefined {
  // undefined means "not asked yet", so the caller can keep showing whatever the
  // dashboard payload had until the first reading lands.
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();

    const load = () => void fetch("/api/spotify", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json() as Promise<SpotifyNowPlaying | null>)
      .then((value) => { if (active) setNowPlaying(value); })
      .catch(() => undefined);

    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [enabled]);

  return nowPlaying;
}
