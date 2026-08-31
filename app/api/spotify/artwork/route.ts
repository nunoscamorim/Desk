const ALLOWED_HOSTS = ["scdn.co", "spotifycdn.com"];

function isAllowedArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source || !isAllowedArtworkUrl(source)) return new Response("Invalid artwork URL", { status: 400 });

  try {
    const response = await fetch(source, { cache: "force-cache" });
    if (!response.ok) return new Response("Artwork unavailable", { status: 502 });
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
      },
    });
  } catch {
    return new Response("Artwork unavailable", { status: 502 });
  }
}
