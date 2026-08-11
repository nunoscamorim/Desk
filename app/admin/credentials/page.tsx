"use client";

import { CredentialsPanel } from "@/app/admin/CredentialsPanel";

export default function CredentialsPage() {
  return <>
    <header className="admin-header"><div><p className="admin-eyebrow">Dashboard / Configuration</p><h1>Credentials.</h1><p>Connect the backend integrations that power the display.</p></div></header>
    <div className="admin-workspace"><div className="credentials-page"><CredentialsPanel /></div></div>
  </>;
}
