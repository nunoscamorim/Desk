import { cookies } from "next/headers";

const cookieName = "desk_admin_session";
const configuredPassword = () => process.env.ADMIN_PASSWORD;

export function isPasswordConfigured() { return Boolean(configuredPassword()); }
export function isValidPassword(password: string) { return Boolean(configuredPassword()) && password === configuredPassword(); }
export async function isAdminAuthenticated() { return (await cookies()).get(cookieName)?.value === "authenticated"; }
export const adminCookie = cookieName;
