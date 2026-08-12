"use client";

import { useEffect, useRef, useState } from "react";
import type { HabitFocusContext } from "./HabitsScreen";

const defaultBreakSeconds = 5 * 60;

function TimerIcon({ name }: { name: "play" | "pause" | "reset" }) {
  if (name === "play") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>;
  if (name === "pause") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a7 7 0 1 0 1 5" /><path d="M20 4v5h-5" /></svg>;
}

export function PomodoroWidget({ linkedHabit = null, onFocusComplete }: { linkedHabit?: HabitFocusContext | null; onFocusComplete?: () => void }) {
  const focusDuration = (linkedHabit?.targetMinutes ?? 25) * 60;
  const durations = { focus: focusDuration, break: defaultBreakSeconds };
  const [mode, setMode] = useState<keyof typeof durations>("focus");
  const [remaining, setRemaining] = useState(focusDuration);
  const [running, setRunning] = useState(false);

  // The tick reads the live values through a ref so the interval does not have
  // to be town down and rebuilt every second, and so the rollover can happen in
  // the tick itself. Reacting to `remaining === 0` from a separate effect would
  // mean setting state in response to state, which costs an extra render and
  // briefly publishes a 00:00 timer that still reads as running.
  const latest = useRef({ mode, remaining, focusDuration, onFocusComplete });
  useEffect(() => { latest.current = { mode, remaining, focusDuration, onFocusComplete }; }, [mode, remaining, focusDuration, onFocusComplete]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (latest.current.remaining > 1) { setRemaining((value) => value - 1); return; }
      if (latest.current.mode === "focus") latest.current.onFocusComplete?.();
      const nextMode = latest.current.mode === "focus" ? "break" : "focus";
      setMode(nextMode);
      setRemaining(nextMode === "focus" ? latest.current.focusDuration : defaultBreakSeconds);
      setRunning(false);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const reset = () => { setRunning(false); setRemaining(durations[mode]); };
  const selectMode = (nextMode: keyof typeof durations) => { setMode(nextMode); setRemaining(durations[nextMode]); setRunning(false); };
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = ((durations[mode] - remaining) / durations[mode]) * 100;

  return <section className={`pomodoro-screen pomodoro-${mode} ${running ? "is-running" : ""}`} aria-label="Pomodoro timer">
    {linkedHabit && <div className="pomodoro-habit-link"><HabitLinkIcon /><span>Focus habit</span><strong>{linkedHabit.habitName}</strong></div>}
    <header className="pomodoro-header"><div><span className="pomodoro-eyebrow"><i />{running ? "In progress" : "Ready to begin"}</span><h2>{mode === "focus" ? "Make this block count." : "Take a real breather."}</h2></div><div className="pomodoro-header-tools"><span className="pomodoro-rhythm"><strong>{Math.round(focusDuration / 60)}</strong> focus <i /> <strong>5</strong> break</span><div className="pomodoro-tabs" role="group" aria-label="Timer mode"><button type="button" aria-pressed={mode === "focus"} onClick={() => selectMode("focus")}>Focus</button><button type="button" aria-pressed={mode === "break"} onClick={() => selectMode("break")}>Break</button></div></div></header>
    <div className="pomodoro-center"><div className="pomodoro-clock"><div className="pomodoro-dial" style={{ "--timer-progress": `${progress}%` } as React.CSSProperties}><div className="pomodoro-dial-inner"><time dateTime={`PT${minutes}M${seconds}S`}>{String(minutes).padStart(2, "0")}<span>:</span>{String(seconds).padStart(2, "0")}</time></div></div><span className="pomodoro-progress-label">{Math.round(progress)}% complete</span></div></div>
    <footer className="pomodoro-footer"><p>{mode === "focus" ? "One task. No tabs. No context switching." : "Stand up, look away, and come back lighter."}</p><div className="pomodoro-actions"><button type="button" className="primary" onClick={() => setRunning((value) => !value)}><TimerIcon name={running ? "pause" : "play"} /><span>{running ? "Pause" : "Start session"}</span></button><button type="button" className="reset-button" onClick={reset}><TimerIcon name="reset" /><span>Reset</span></button></div></footer>
  </section>;
}

function HabitLinkIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>; }
