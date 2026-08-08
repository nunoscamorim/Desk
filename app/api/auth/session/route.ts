import { isAdminAuthenticated, isPasswordConfigured } from "@/lib/auth";
export async function GET() { return Response.json({ configured: isPasswordConfigured(), authenticated: await isAdminAuthenticated() }); }
