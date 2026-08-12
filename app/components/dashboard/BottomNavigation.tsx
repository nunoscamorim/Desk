export type DashboardScreen = "home" | "calendar" | "music" | "tv" | "tasks" | "habits" | "focus" | "more";

const items: Array<{ id: DashboardScreen; label: string }> = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
  { id: "music", label: "Music" },
  { id: "tv", label: "TV" },
  { id: "tasks", label: "Tasks" },
  { id: "habits", label: "Habits" },
  { id: "focus", label: "Focus" },
  { id: "more", label: "More" },
];

function NavIcon({ id }: { id: DashboardScreen }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {id === "home" ? <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>
      : id === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>
      : id === "music" ? <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>
      : id === "tv" ? <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>
      : id === "tasks" ? <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 12 3 3 7-7" /></>
      : id === "habits" ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>
      : id === "focus" ? <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6M12 2v3" /></>
      : <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v-.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
  </svg>;
}

export function BottomNavigation({ screen, onChange }: { screen: DashboardScreen; onChange: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-navigation" aria-label="Dashboard sections">{items.map((item) => item.id === "more"
    ? <button className={`icon-only${screen === item.id ? " active" : ""}`} type="button" key={item.label} onClick={() => onChange(item.id)} aria-current={screen === item.id ? "page" : undefined} aria-label={item.label} title={item.label}><NavIcon id={item.id} /></button>
    : <button className={screen === item.id ? "active" : ""} type="button" key={item.label} onClick={() => onChange(item.id)} aria-current={screen === item.id ? "page" : undefined}><NavIcon id={item.id} />{item.label}</button>)}</nav>;
}
