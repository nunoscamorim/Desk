import { buildSpotifyService } from "@/lib/dashboard/get-dashboard";
import { getServiceConfiguration } from "@/lib/services";
import type { SpotifyPlaybackAction } from "@/lib/services/spotify";

const ACTIONS = new Set<SpotifyPlaybackAction>(["play", "pause", "next", "previous", "seek", "shuffle", "repeat"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; positionMs?: number; value?: boolean | "track" | "context" | "off" };
  if (!body.action || !ACTIONS.has(body.action as SpotifyPlaybackAction)) return Response.json({ error: "Unknown Spotify playback action" }, { status: 400 });
  if (body.action === "seek" && (!Number.isFinite(body.positionMs) || (body.positionMs ?? 0) < 0)) return Response.json({ error: "positionMs must be a non-negative number" }, { status: 400 });
  try {
    const service = await buildSpotifyService(getServiceConfiguration());
    await service.controlPlayback(body.action as SpotifyPlaybackAction, body.action === "seek" ? body.positionMs : body.value);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Spotify playback command failed" }, { status: 502 });
  }
}
