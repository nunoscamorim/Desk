import type { AiUsage } from "@/lib/dashboard/types";
import { getGoogleAccessToken } from "./google-oauth";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

export interface GoogleAiUsageService { getUsage(): Promise<AiUsage>; }

const BILLING_API_ENDPOINT = "https://cloudbilling.googleapis.com/v1/projects/project-27f5592c-045d-46f1-821/billingInfo";

/** Legacy fixed reading kept for preview/mock paths that have no real store. */
export class MockGoogleAiUsageService implements GoogleAiUsageService {
  async getUsage(): Promise<AiUsage> {
    return { usedPercent: 0, period: "weekly", resetsAt: new Date(Date.now() + 345600000).toISOString() };
  }
}

export class GoogleAiUsageGoService implements GoogleAiUsageService {
  private readonly budgetUsd: number;

  constructor(options?: { budgetUsd?: number }) {
    this.budgetUsd = options?.budgetUsd ?? Number(process.env.GOOGLE_AI_BUDGET_USD ?? 30);
  }

  async getUsage(): Promise<AiUsage> {
    const cost = await this.readCost();
    const usedPercent = Math.round(Math.min(100, Math.max(0, (cost / this.budgetUsd) * 100)));
    return { usedPercent, period: "weekly", resetsAt: this.resetsAt() };
  }

  private async readCost(): Promise<number> {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      console.error("[google-ai-usage] google access token not available, reporting zero");
      return 0;
    }

    try {
      const response = await fetchWithRetry(BILLING_API_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();

      // This is a placeholder for where the actual cost would be extracted from the response.
      // The actual structure of the response is unknown.
      const cost = data.billingInfo?.cost ?? 0;

      return cost;
    } catch (error) {
      console.error("[google-ai-usage] local store unreadable, reporting zero:", error instanceof Error ? error.message : error);
      return 0;
    }
  }

  private resetsAt(): string {
    // Assuming a weekly cycle for now.
    return new Date(Date.now() + 7 * 86_400_000).toISOString();
  }
}
