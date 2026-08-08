import type { AiUsage } from "@/lib/dashboard/types";
export interface CodexUsageService { getUsage(): Promise<AiUsage>; }
export class MockCodexUsageService implements CodexUsageService { async getUsage(): Promise<AiUsage> { return { usedPercent: 74, period: "weekly", resetsAt: new Date(Date.now() + 172800000).toISOString() }; } }
