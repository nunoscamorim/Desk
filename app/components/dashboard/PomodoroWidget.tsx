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
  const switchMode = () => { const nextMode = mode === "focus" ? "break" : "focus"; setMode(nextMode); setRemaining(durations[nextMode]); setRunning(false); };
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = ((durations[mode] - remaining) / durations[mode]) * 100;

  return <section className="pomodoro-screen" aria-label="Pomodoro timer"><div className="pomodoro-copy"><span className="pomodoro-mode"><i />{mode === "focus" ? "Focus session" : "Short break"}</span><h2>{mode === "focus" ? "Make this block count." : "Step away for a moment."}</h2><p>{mode === "focus" ? "One task. No context switching." : "Breathe, stretch, and reset."}</p></div><div className="pomodoro-clock"><div className="pomodoro-dial" style={{ "--timer-progress": `${progress}%` } as React.CSSProperties}><time dateTime={`PT${minutes}M${seconds}S`}>{String(minutes).padStart(2, "0")}<span>:</span>{String(seconds).padStart(2, "0")}</time><small>{running ? "Timer running" : "Ready"}</small></div><div className="pomodoro-actions"><button type="button" className="primary" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start"}</button><button type="button" onClick={reset}>Reset</button><button type="button" onClick={switchMode}>{mode === "focus" ? "Take a break" : "Start focus"}</button></div></div></section>;
}
