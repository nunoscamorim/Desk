import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AiUsage } from "@/lib/dashboard/types";

const execFileAsync = promisify(execFile);

export interface OpencodeUsageService { getUsage(): Promise<AiUsage>; }

/** Legacy fixed reading kept for preview/mock paths that have no real store. */
export class MockOpencodeUsageService implements OpencodeUsageService {
  async getUsage(): Promise<AiUsage> {
    return { usedPercent: 32, period: "weekly", resetsAt: new Date(Date.now() + 345600000).toISOString() };
  }
}

type GoPeriod = "weekly" | "monthly";

/**
 * The Go subscription caps usage in dollar terms — the docs set $30/week and
 * $60/month — so the meter is the period's cost against that budget.
 */
const GO_BUDGETS: Record<GoPeriod, { days: number; budgetUsd: number }> = {
  weekly: { days: 7, budgetUsd: 30 },
  monthly: { days: 30, budgetUsd: 60 },
};

/** Fallback store used by a bare opencode CLI (no XDG_DATA_HOME). */
const DEFAULT_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

/** Stores inside Ship Studio account data dirs — where this machine's real
 *  opencode (the one driving opencode-go) actually keeps its sessions. */
const shipStudioDbCandidates = (): string[] => {
  const accountsDir = path.join(os.homedir(), ".ship-studio", "accounts");
  try {
    return readdirSync(accountsDir)
      .map((id) => path.join(accountsDir, id, "data", "opencode", "opencode.db"))
      .filter((candidate) => existsSync(candidate));
  } catch { return []; }
};

/**
 * The local opencode session store in active use. opencode keeps its data
 * under $XDG_DATA_HOME (or ~/.local/share), and Ship Studio runs its own
 * account-scoped copy — so several stores can exist side by side. The one
 * written most recently is the one being used, and that is the one we read.
 */
const resolveDbPath = (): string => {
  const candidates = [
    process.env.OPENCODE_DB_PATH,
    process.env.XDG_DATA_HOME ? path.join(process.env.XDG_DATA_HOME, "opencode", "opencode.db") : undefined,
    ...shipStudioDbCandidates(),
    DEFAULT_DB_PATH,
  ].filter((candidate): candidate is string => typeof candidate === "string" && existsSync(candidate));
  return candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? DEFAULT_DB_PATH;
};

export const opencodeStoreAvailable = (): boolean => existsSync(resolveDbPath());

/**
 * Real usage read straight from the machine's opencode store — the priced cost
 * each session records, summed over the current period. No token/pricing table
 * is maintained here: opencode already writes the billed dollar value per
 * session, which is why this stays accurate as models and prices change.
 */
export class OpencodeGoUsageService implements OpencodeUsageService {
  private readonly period: GoPeriod;
  private readonly budgetUsd: number;
  private readonly days: number;

  constructor(options?: { period?: GoPeriod; budgetUsd?: number }) {
    const envPeriod = process.env.OPENCODE_GO_PERIOD;
    this.period = options?.period ?? (envPeriod === "monthly" ? "monthly" : "weekly");
    const spec = GO_BUDGETS[this.period];
    this.days = spec.days;
    const envBudget = this.period === "monthly" ? process.env.OPENCODE_GO_MONTHLY_BUDGET_USD : process.env.OPENCODE_GO_WEEKLY_BUDGET_USD;
    this.budgetUsd = options?.budgetUsd ?? Number(envBudget ?? spec.budgetUsd);
  }

  async getUsage(): Promise<AiUsage> {
    const cost = await this.readCost();
    const usedPercent = Math.round(Math.min(100, Math.max(0, (cost / this.budgetUsd) * 100)));
    return { usedPercent, period: this.period, resetsAt: this.resetsAt() };
  }

  private async readCost(): Promise<number> {
    const dbPath = resolveDbPath();
    if (!existsSync(dbPath)) return 0;
    const cutoff = Date.now() - this.days * 86_400_000;
    try {
      const { stdout } = await execFileAsync("sqlite3", [dbPath, `SELECT COALESCE(SUM(cost),0) FROM session WHERE time_created > ${Math.floor(cutoff)};`], { timeout: 8000 });
      return Number.parseFloat(stdout.trim()) || 0;
    } catch (error) {
      console.error("[opencode-usage] local store unreadable, reporting zero:", error instanceof Error ? error.message : error);
      return 0;
    }
  }

  private resetsAt(): string {
    return new Date(Date.now() + this.days * 86_400_000).toISOString();
  }
}
