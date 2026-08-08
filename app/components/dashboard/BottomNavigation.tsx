export type DashboardScreen = "home" | "calendar" | "music" | "tasks" | "more";
const items: Array<{ id: DashboardScreen; label: string; icon: string }> = [{ id: "home", label: "Home", icon: "⌂" }, { id: "calendar", label: "Calendar", icon: "□" }, { id: "music", label: "Music", icon: "♫" }, { id: "tasks", label: "Tasks", icon: "✓" }, { id: "more", label: "More", icon: "⋯" }];

export function BottomNavigation({ screen, onChange }: { screen: DashboardScreen; onChange: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-navigation" aria-label="Dashboard sections">{items.map((item) => <button className={screen === item.id ? "active" : ""} type="button" key={item.label} onClick={() => onChange(item.id)} aria-current={screen === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>;
}
