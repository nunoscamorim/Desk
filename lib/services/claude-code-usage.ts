import type { AiUsage } from "@/lib/dashboard/types";
export interface ClaudeCodeUsageService { getUsage(): Promise<AiUsage>; }
export class MockClaudeCodeUsageService implements ClaudeCodeUsageService { async getUsage(): Promise<AiUsage> { return { usedPercent: 51, period: "weekly", resetsAt: new Date(Date.now() + 259200000).toISOString() }; } }
