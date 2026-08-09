"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CredentialsPanel } from "@/app/admin/CredentialsPanel";
import styles from "./credentials.module.css";

export default function CredentialsPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { void fetch("/api/auth/session").then((response) => response.json()).then((session: { authenticated: boolean; configured: boolean }) => queueMicrotask(() => setAuthenticated(session.configured ? session.authenticated : true))).catch(() => queueMicrotask(() => setAuthenticated(false))); }, []);
  if (authenticated === null) return <main className="admin-shell auth-shell"><div className="preview-loading">Checking admin access…</div></main>;
  if (!authenticated) return <main className="admin-shell auth-shell"><section className="admin-login"><h1>Admin access required</h1><p>Sign in from the main admin screen before managing credentials.</p><Link className="admin-back" href="/admin">Go to admin login</Link></section></main>;
  return <main className={`admin-shell auth-shell ${styles.shell}`}><section className={`credentials-page ${styles.page}`}><Link className="admin-back" href="/admin">← Back to admin</Link><CredentialsPanel /></section></main>;
}
