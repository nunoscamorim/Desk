"use client";

import { useEffect, useRef, useState } from "react";

const durations = { focus: 25 * 60, break: 5 * 60 } as const;

export function PomodoroWidget() {
  const [mode, setMode] = useState<keyof typeof durations>("focus");
  const [remaining, setRemaining] = useState(durations.focus);
  const [running, setRunning] = useState(false);

  // The tick reads the live values through a ref so the interval does not have
  // to be town down and rebuilt every second, and so the rollover can happen in
  // the tick itself. Reacting to `remaining === 0` from a separate effect would
  // mean setting state in response to state, which costs an extra render and
  // briefly publishes a 00:00 timer that still reads as running.
  const latest = useRef({ mode, remaining });
  useEffect(() => { latest.current = { mode, remaining }; }, [mode, remaining]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (latest.current.remaining > 1) { setRemaining((value) => value - 1); return; }
      const nextMode = latest.current.mode === "focus" ? "break" : "focus";
      setMode(nextMode);
      setRemaining(durations[nextMode]);
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
    <header className="pomodoro-header"><div className="pomodoro-tabs" role="group" aria-label="Timer mode"><button type="button" aria-pressed={mode === "focus"} onClick={() => selectMode("focus")}>Focus</button><button type="button" aria-pressed={mode === "break"} onClick={() => selectMode("break")}>Break</button></div><span className="pomodoro-rhythm"><strong>25</strong> focus <i /> <strong>5</strong> reset</span></header>
    <div className="pomodoro-layout"><div className="pomodoro-copy"><span className="pomodoro-mode"><i />{running ? "In progress" : "Ready to begin"}</span><h2>{mode === "focus" ? "Make this block count." : "Take a real breather."}</h2><p>{mode === "focus" ? "One task. No tabs. No context switching." : "Stand up, look away, and come back lighter."}</p><div className="pomodoro-actions"><button type="button" className="primary" onClick={() => setRunning((value) => !value)}><span aria-hidden="true">{running ? "Ⅱ" : "▶"}</span>{running ? "Pause" : "Start session"}</button><button type="button" onClick={reset}><span aria-hidden="true">↺</span>Reset</button></div></div>
      <div className="pomodoro-clock"><div className="pomodoro-dial" style={{ "--timer-progress": `${progress}%` } as React.CSSProperties}><div className="pomodoro-dial-inner"><time dateTime={`PT${minutes}M${seconds}S`}>{String(minutes).padStart(2, "0")}<span>:</span>{String(seconds).padStart(2, "0")}</time><small aria-live="polite">{running ? (mode === "focus" ? "Stay with it" : "Breathe") : mode === "focus" ? "Focus timer" : "Break timer"}</small></div></div><span className="pomodoro-progress-label">{Math.round(progress)}% complete</span></div></div>
  </section>;
}
