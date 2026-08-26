/**
 * /api/admin/upload — Secure file upload (Issue #5)
 *
 * Changes:
 * - SVG removed (XSS risk)
 * - GIF removed (animated abuse / limited need)
 * - Only PNG, JPG/JPEG, WEBP allowed
 * - Magic-byte validation (not just MIME type)
 * - Auth check added (this route was unprotected!)
 * - Rate limited
 * - Cloudinary upload with safe public_id
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types (SVG and GIF removed)
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Magic bytes for each allowed type
const MAGIC: Record<string, (buf: Uint8Array) => boolean> = {
  "image/png": (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

function generateSafePublicId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `jasmintopup/img_${ts}_${rand}`;
}

export const POST = withAdminAuth(
  async (req: NextRequest, _ctx, admin) => {
    // Rate limit: 20 uploads per admin per hour
    const rl = await applyRateLimit(
      `upload:${admin.id}`,
      20,
      60 * 60 * 1000,
      admin.id
    );
    if (rl) return rl;

    try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      logSecurityEvent({
        event: "upload_rejected",
        adminId: admin.id,
        detail: `Rejected MIME: ${file.type}`,
      });
      return NextResponse.json(
        { error: "Unsupported file type. Only PNG, JPG, and WEBP are allowed." },
        { status: 415 }
      );
    }

    // Read first 12 bytes for magic byte check
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicCheck = MAGIC[file.type];
    if (magicCheck && !magicCheck(new Uint8Array(buffer.slice(0, 12)))) {
      logSecurityEvent({
        event: "upload_rejected",
        adminId: admin.id,
        detail: `Magic byte mismatch for claimed MIME: ${file.type}`,
      });
      return NextResponse.json(
        { error: "File content does not match the declared file type." },
        { status: 415 }
      );
    }

    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const publicId = generateSafePublicId();

    const result = await cloudinary.uploader.upload(base64, {
      public_id: publicId,
      resource_type: "image",
      // Explicitly deny SVG transformation to prevent stored XSS
      allowed_formats: ["png", "jpg", "webp"],
      // Strip EXIF metadata
      exif: false,
    });

    return NextResponse.json({
      url: result.secure_url,
      size: file.size,
      type: file.type,
    });
    } catch (err) {
      console.error("[upload] error:", err);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  },
  { permissions: ["products.write", "games.write", "banners.write", "settings.write"] }
);
