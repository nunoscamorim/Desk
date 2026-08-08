"use client";

import { useEffect, useState } from "react";

const durations = { focus: 25 * 60, break: 5 * 60 } as const;

export function PomodoroWidget() {
  const [mode, setMode] = useState<keyof typeof durations>("focus");
  const [remaining, setRemaining] = useState(durations.focus);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0) return;
    const nextMode = mode === "focus" ? "break" : "focus";
    setMode(nextMode);
    setRemaining(durations[nextMode]);
    setRunning(false);
  }, [remaining, mode]);

  const reset = () => { setRunning(false); setRemaining(durations[mode]); };
  const switchMode = () => { const nextMode = mode === "focus" ? "break" : "focus"; setMode(nextMode); setRemaining(durations[nextMode]); setRunning(false); };
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = ((durations[mode] - remaining) / durations[mode]) * 100;

  return <section className="pomodoro-screen" aria-label="Pomodoro timer"><div className="pomodoro-copy"><span className="pomodoro-mode"><i />{mode === "focus" ? "Focus session" : "Short break"}</span><h2>{mode === "focus" ? "Make this block count." : "Step away for a moment."}</h2><p>{mode === "focus" ? "One task. No context switching." : "Breathe, stretch, and reset."}</p></div><div className="pomodoro-clock"><div className="pomodoro-dial" style={{ "--timer-progress": `${progress}%` } as React.CSSProperties}><time dateTime={`PT${minutes}M${seconds}S`}>{String(minutes).padStart(2, "0")}<span>:</span>{String(seconds).padStart(2, "0")}</time><small>{running ? "Timer running" : "Ready"}</small></div><div className="pomodoro-actions"><button type="button" className="primary" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start"}</button><button type="button" onClick={reset}>Reset</button><button type="button" onClick={switchMode}>{mode === "focus" ? "Take a break" : "Start focus"}</button></div></div></section>;
}
