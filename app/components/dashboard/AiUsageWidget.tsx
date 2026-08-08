import type { AiUsage } from "@/lib/dashboard/types";

function UsageMeter({ label, usage }: { label: string; usage: AiUsage }) {
  return <div className="usage-row"><div className="usage-heading"><span>{label}</span><strong>{usage.usedPercent}%</strong></div><div className="meter" role="progressbar" aria-label={`${label} ${usage.period} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage.usedPercent}><span style={{ width: `${Math.min(100, usage.usedPercent)}%` }} /></div><span className="usage-caption">{usage.period} usage</span></div>;
}

export function AiUsageWidget({ codex, claudeCode }: { codex: AiUsage; claudeCode: AiUsage }) {
  return <article className="card usage-card"><div className="card-title-row"><h2>AI usage</h2></div><UsageMeter label="Codex" usage={codex} /><UsageMeter label="Claude Code" usage={claudeCode} /></article>;
}
