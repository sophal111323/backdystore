import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM_CDN_BASE = "https://cdn.rithtopup.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path || path.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Prevent path traversal attacks
  const safeSegments = path.filter(
    (seg) => seg && !seg.includes("..") && !seg.includes("/") && !seg.includes("\\")
  );

  if (safeSegments.length === 0) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const upstreamUrl = `${UPSTREAM_CDN_BASE}/${safeSegments.join("/")}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "DyTopup-CDN-Proxy/1.0",
      },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!upstreamRes.ok) {
      return new NextResponse("Image Not Found", { status: upstreamRes.status });
    }

    const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await upstreamRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Proxy Error", { status: 502 });
  }
}

