import type { SVGProps } from "react";

export const habitIconOptions = [
  { id: "check", label: "Check" },
  { id: "pill", label: "Medication" },
  { id: "stretch", label: "Movement" },
  { id: "focus", label: "Focus" },
  { id: "workout", label: "Workout" },
  { id: "sun", label: "Morning" },
  { id: "moon", label: "Evening" },
  { id: "water", label: "Water" },
] as const;

export function HabitIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props };
  if (name === "pill") return <svg {...common}><g transform="rotate(-45 12 12)"><rect x="4" y="8.5" width="16" height="7" rx="3.5" /><path d="M12 8.5v7" /></g></svg>;
  if (name === "stretch") return <svg {...common}><circle cx="12" cy="4" r="2" /><path d="m7 21 3-7-3-3m10 10-3-7 3-3M7 8l5 3 5-3" /></svg>;
  if (name === "focus") return <svg {...common}><circle cx="12" cy="12" r="7" /><path d="M12 9v3l2 2M5 5l2 2m12-2-2 2" /></svg>;
  if (name === "workout") return <svg {...common}><path d="M3 9v6m3-8v10m12-8v6m-3-8v10M6 12h9" /></svg>;
  if (name === "sun") return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (name === "moon") return <svg {...common}><path d="M20 15.5A8 8 0 0 1 8.5 4 8.2 8.2 0 1 0 20 15.5Z" /></svg>;
  if (name === "water") return <svg {...common}><path d="M12 2S6 9 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12Z" /><path d="M9 15a3 3 0 0 0 3 3" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
}
