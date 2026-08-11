"use client";
import { useEffect, useState } from "react";
import { useToast } from "./ToastContext";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  missing_client: "Save a Google client ID and secret before connecting.",
  state_mismatch: "That connect attempt expired or was tampered with — try again.",
  missing_code: "Google did not return an authorization code — try again.",
  no_refresh_token: "Google didn't issue a refresh token (it may still remember a prior approval). Revoke access for this app at myaccount.google.com/permissions, then try connecting again.",
  exchange_failed: "Could not exchange the code for tokens — check the client secret and try again.",
  access_denied: "Access was denied on the Google consent screen.",
};

const SPOTIFY_ERROR_MESSAGES: Record<string, string> = {
  missing_client: "Save a Spotify client ID and secret before connecting.",
  state_mismatch: "That connect attempt expired or was tampered with — try again.",
  missing_code: "Spotify did not return an authorization code — try again.",
  no_refresh_token: "Spotify did not issue a refresh token — revoke this app's access in Spotify and reconnect.",
  exchange_failed: "Could not exchange the Spotify code for tokens — check the client secret and redirect URI.",
  access_denied: "Access was denied on the Spotify consent screen.",
};

export function CredentialsPanel() {
  const showToast = useToast();
  const [googleId, setGoogleId] = useState(""); const [googleSecret, setGoogleSecret] = useState(""); const [spotifyId, setSpotifyId] = useState(""); const [spotifySecret, setSpotifySecret] = useState(""); const [status, setStatus] = useState(""); const [googleConfigured, setGoogleConfigured] = useState(false); const [googleConnected, setGoogleConnected] = useState(false); const [googleMessage, setGoogleMessage] = useState(""); const [spotifyConfigured, setSpotifyConfigured] = useState(false); const [spotifyConnected, setSpotifyConnected] = useState(false); const [spotifyMessage, setSpotifyMessage] = useState("");

  const refreshStatus = () => fetch("/api/config/credentials").then((r) => r.json()).then((v: { google?: boolean; googleConnected?: boolean; spotify?: boolean; spotifyConnected?: boolean }) => { setGoogleConfigured(Boolean(v.google)); setGoogleConnected(Boolean(v.googleConnected)); setSpotifyConfigured(Boolean(v.spotify)); setSpotifyConnected(Boolean(v.spotifyConnected)); setStatus(`${v.google ? "Google configured" : "Google not configured"} · ${v.spotify ? "Spotify configured" : "Spotify not configured"}`); }).catch(() => setStatus("Unable to read status"));

  useEffect(() => {
    void refreshStatus();
    // The OAuth callback redirects back here with ?google=connected or ?google_error=...
    const params = new URLSearchParams(window.location.search);
    const error = params.get("google_error");
    const connected = params.get("google") === "connected";
    const spotifyError = params.get("spotify_error");
    const spotifyIsConnected = params.get("spotify") === "connected";
    if (connected || error || spotifyIsConnected || spotifyError) {
      // Matches the queueMicrotask pattern used elsewhere in this app (see
      // app/admin/credentials/page.tsx) to keep setState out of the effect's
      // synchronous body.
      queueMicrotask(() => {
        if (connected) setGoogleMessage("Google Calendar connected.");
        else if (error) setGoogleMessage(GOOGLE_ERROR_MESSAGES[error] ?? `Google connect failed: ${error}`);
        if (spotifyIsConnected) setSpotifyMessage("Spotify connected. Now-playing access will refresh automatically.");
        else if (spotifyError) setSpotifyMessage(SPOTIFY_ERROR_MESSAGES[spotifyError] ?? `Spotify connect failed: ${spotifyError}`);
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const response = await fetch("/api/config/credentials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleClientId: googleId, googleClientSecret: googleSecret, spotifyClientId: spotifyId, spotifyClientSecret: spotifySecret }) }); showToast(response.ok ? "Encrypted credentials saved" : "Unable to save credentials", response.ok ? "success" : "error"); if (response.ok) { setGoogleSecret(""); setSpotifySecret(""); void refreshStatus(); } };

  return (
    <>
      <form className="credentials-panel" onSubmit={save}>
        <p className="admin-eyebrow">Backend credentials</p>
        <h2>OAuth providers</h2>
        <p className="settings-note">Secrets are encrypted on the server and never shown again.</p>
        <label>Google client ID<input value={googleId} onChange={(e) => setGoogleId(e.target.value)} autoComplete="off" /></label>
        <label>Google client secret<input type="password" value={googleSecret} onChange={(e) => setGoogleSecret(e.target.value)} autoComplete="new-password" /></label>
        <label>Spotify client ID<input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} autoComplete="off" /></label>
        <label>Spotify client secret<input type="password" value={spotifySecret} onChange={(e) => setSpotifySecret(e.target.value)} autoComplete="new-password" /></label>
        <button type="submit" className="btn btn-block">Save encrypted credentials</button>
        <span className="credential-status">{status}</span>
      </form>
      <div className="credentials-panel">
        <p className="admin-eyebrow">Google Calendar</p>
        <h2>Permanent access</h2>
        <p className="settings-note">
          {googleConnected
            ? "Connected. The dashboard refreshes its own access token automatically — no more re-pasting tokens."
            : "Save the client ID/secret above, then connect your account. This is a one-time consent that keeps working indefinitely (as long as the Google Cloud project is published — see below)."}
        </p>
        <a
          className="btn btn-block"
          href={googleConfigured ? "/api/auth/google-calendar/connect" : undefined}
          aria-disabled={!googleConfigured}
        >
          {googleConnected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
        {googleMessage && <p className="settings-note">{googleMessage}</p>}
        <p className="settings-note">
          If the Google Cloud project&apos;s OAuth consent screen is still in &quot;Testing&quot; status, Google force-expires
          this connection after 7 days regardless of activity. Move it to &quot;In production&quot; (or &quot;Internal&quot; for a
          personal Workspace account) under OAuth consent screen settings for it to actually stay connected.
        </p>
      </div>
      <div className="credentials-panel">
        <p className="admin-eyebrow">Spotify</p>
        <h2>Now playing access</h2>
        <p className="settings-note">
          {spotifyConnected
            ? "Connected. The dashboard refreshes Spotify access automatically."
            : "Save the Spotify client ID/secret above, then connect your account once."}
        </p>
        <a
          className="btn btn-block"
          href={spotifyConfigured ? "/api/auth/spotify/connect" : undefined}
          aria-disabled={!spotifyConfigured}
        >
          {spotifyConnected ? "Reconnect Spotify" : "Connect Spotify"}
        </a>
        {spotifyMessage && <p className="settings-note">{spotifyMessage}</p>}
        <p className="settings-note">
          Register <code>&lt;your-domain&gt;/api/auth/spotify/callback</code> as an exact redirect URI in the Spotify Developer Dashboard.
        </p>
      </div>
    </>
  );
}
