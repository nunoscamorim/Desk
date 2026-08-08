import { adminCookie, isPasswordConfigured, isValidPassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isPasswordConfigured()) return Response.json({ error: "ADMIN_PASSWORD is not configured" }, { status: 503 });
  const body = await request.json() as { password?: string };
  if (!body.password || !isValidPassword(body.password)) return Response.json({ error: "Invalid password" }, { status: 401 });
  const response = Response.json({ authenticated: true });
  response.headers.append("Set-Cookie", `${adminCookie}=authenticated; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
