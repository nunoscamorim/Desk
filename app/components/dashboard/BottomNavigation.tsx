export type DashboardScreen = "home" | "calendar" | "music" | "tasks" | "focus" | "more";
const items: Array<{ id: DashboardScreen; label: string }> = [{ id: "home", label: "Home" }, { id: "calendar", label: "Calendar" }, { id: "music", label: "Music" }, { id: "tasks", label: "Tasks" }, { id: "focus", label: "Focus" }, { id: "more", label: "More" }];

function NavIcon({ id }: { id: DashboardScreen }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{id === "home" ? <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></> : id === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></> : id === "music" ? <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></> : id === "tasks" ? <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 12 3 3 7-7" /></> : id === "focus" ? <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6M12 2v3" /></> : <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></>}</svg>;
}

export function BottomNavigation({ screen, onChange }: { screen: DashboardScreen; onChange: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-navigation" aria-label="Dashboard sections">{items.map((item) => <button className={screen === item.id ? "active" : ""} type="button" key={item.label} onClick={() => onChange(item.id)} aria-current={screen === item.id ? "page" : undefined}><NavIcon id={item.id} />{item.label}</button>)}</nav>;
}
