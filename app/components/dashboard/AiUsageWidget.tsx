import type { AiUsage } from "@/lib/dashboard/types";

function UsageMeter({ label, usage }: { label: string; usage: AiUsage }) {
  const disabled = usage.usedPercent === 0;
  return <div className="usage-row"><span>{label}</span><div className={`meter${disabled ? " disabled" : ""}`} role="progressbar" aria-label={`${label} ${usage.period} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage.usedPercent}><span style={{ width: `${Math.min(100, usage.usedPercent)}%` }} /></div><strong>{usage.usedPercent}%</strong></div>;
}

export function AiUsageWidget({ codex, claudeCode }: { codex: AiUsage; claudeCode: AiUsage }) {
  return <article className="card usage-card"><div className="card-title-row"><h2>AI usage</h2></div><UsageMeter label="Codex" usage={codex} /><UsageMeter label="Claude Code" usage={claudeCode} /></article>;
}
