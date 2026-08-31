import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  try {
    // 1. Try fetching from Database (works seamlessly on Vercel serverless)
    const file = await prisma.uploadedFile.findUnique({
      where: { filename },
    });

    if (file) {
      return new NextResponse(new Uint8Array(file.data), {
        status: 200,
        headers: {
          "Content-Type": file.mimeType,
          "Content-Length": file.size.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Fallback to local disk (for localhost dev legacy files)
    const localPath = path.join(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(localPath)) {
      const ext = filename.split(".").pop()?.toLowerCase() || "png";
      const mimeType = MIME_MAP[ext] || "application/octet-stream";
      const buffer = await fs.promises.readFile(localPath);

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse("File not found", { status: 404 });
  } catch (error) {
    console.error("[uploads] Serve file error:", error);
    return new NextResponse("Error loading file", { status: 500 });
  }
}

