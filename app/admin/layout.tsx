"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminConfigProvider } from "./AdminConfigContext";
import { ToastProvider } from "./ToastContext";
import { ConfirmProvider } from "./ConfirmContext";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); if (!response.ok) { setError("That password didn’t work."); return; } onLogin(); };
  return <main className="admin-shell auth-shell"><form className="admin-login" onSubmit={submit}><span className="brand-mark">D</span><p className="admin-eyebrow">Desk dashboard</p><h1>Admin access</h1><p>Enter the admin password to configure the display.</p><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Admin password" /><button type="submit" className="btn btn-block">Continue</button>{error && <span className="login-error">{error}</span>}</form></main>;
}

const SCREENS: Array<{ href: string; label: string; glyph: string }> = [
  { href: "/admin", label: "Dashboard", glyph: "⌂" },
  { href: "/admin/display", label: "Display", glyph: "▣" },
  { href: "/admin/tv", label: "TV", glyph: "▶" },
  { href: "/admin/credentials", label: "Credentials", glyph: "⚿" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [serviceStatus, setServiceStatus] = useState<Record<string, { configured: boolean }> | null>(null);

  useEffect(() => { void fetch("/api/auth/session").then((response) => response.json()).then((session: { authenticated: boolean; configured: boolean }) => queueMicrotask(() => setAuthenticated(session.configured ? session.authenticated : true))).catch(() => queueMicrotask(() => setAuthenticated(true))); }, []);
  useEffect(() => { void fetch("/api/config/services").then((response) => response.json()).then((payload: { services?: Record<string, { configured: boolean }> }) => setServiceStatus(payload.services ?? null)).catch(() => setServiceStatus(null)); }, []);

  const integration = (id: string, label: string) => <div className="integration-row"><span className={`integration-dot ${serviceStatus?.[id]?.configured ? "connected" : ""}`} />{label}<span className="integration-status">{serviceStatus ? (serviceStatus[id]?.configured ? "Configured" : "Mock data") : "Checking…"}</span></div>;

  if (authenticated === null) return <main className="admin-shell auth-shell"><div className="preview-loading"><span className="skeleton admin-skeleton-bar" aria-hidden="true" /><span className="sr-only">Checking admin access…</span></div></main>;
  if (!authenticated) return <AdminLogin onLogin={() => setAuthenticated(true)} />;

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><span className="brand-mark">D</span><div><strong>Desk dashboard</strong><span>Configuration</span></div></div>
      <nav className="admin-screens" aria-label="Admin screens">
        <p className="admin-eyebrow">Screens</p>
        {SCREENS.map((screen) => <Link key={screen.href} className={`admin-screen ${pathname === screen.href ? "active" : ""}`} href={screen.href}><span>{screen.glyph}</span>{screen.label}</Link>)}
      </nav>
      <div className="admin-integrations"><p className="admin-eyebrow">Integrations</p>{integration("googleCalendar", "Google Calendar")}{integration("spotify", "Spotify")}{integration("weather", "Weather")}{integration("coolify", "Coolify")}</div>
      <Link className="admin-back" href="/">← Back to dashboard</Link>
    </aside>
    <section className="admin-content"><ToastProvider><ConfirmProvider><AdminConfigProvider>{children}</AdminConfigProvider></ConfirmProvider></ToastProvider></section>
  </main>;
}
