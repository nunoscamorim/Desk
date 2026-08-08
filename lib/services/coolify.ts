export type CoolifyStatus = { status: "online" | "offline" | "unknown"; version: string | null; checkedAt: string };
export interface CoolifyService { getStatus(): Promise<CoolifyStatus>; }
export class MockCoolifyService implements CoolifyService { async getStatus(): Promise<CoolifyStatus> { return { status: "online", version: null, checkedAt: new Date().toISOString() }; } }
