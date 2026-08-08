import type { TodayCalendar } from "@/lib/dashboard/types";
export interface AppleCalendarService { getTodayCalendar(): Promise<TodayCalendar>; }
export class MockAppleCalendarService implements AppleCalendarService { async getTodayCalendar(): Promise<TodayCalendar> { return { date: new Date().toISOString().slice(0, 10), events: [] }; } }
