/**
 * /api/admin/upload — Secure file upload
 *
 * Supports:
 * - Cloudinary upload (if CLOUDINARY_* environment variables are set)
 * - Local filesystem fallback (/public/uploads) when Cloudinary is not configured
 * - Allowed types: PNG, JPG/JPEG, WEBP
 * - Magic-byte validation
 * - Admin authorization
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

// Magic bytes for each allowed type
const MAGIC: Record<string, (buf: Uint8Array) => boolean> = {
  "image/png": (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46,
};

function generateSafeFilename(ext: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `img_${ts}_${rand}.${ext}`;
}

export const POST = withAdminAuth(
  async (req: NextRequest, _ctx, admin) => {
    // Rate limit: 100 uploads per admin per hour
    const rl = await applyRateLimit(
      `upload:${admin.id}`,
      100,
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

      const mimeType = file.type.toLowerCase();
      const ext = ALLOWED_MIME[mimeType] || (mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "");

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
      const magicCheck = MAGIC[mimeType] || MAGIC[`image/${ext}`];
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

      // ── Option A: Cloudinary Upload ───────────────────────────────────────
      if (hasCloudinary) {
        try {
          const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;
          const publicId = `dytopup/img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

          const result = await cloudinary.uploader.upload(base64, {
            public_id: publicId,
            resource_type: "image",
            allowed_formats: ["png", "jpg", "webp"],
            exif: false,
          });

          return NextResponse.json({
            url: result.secure_url,
            size: file.size,
            type: mimeType,
          });
        } catch (cloudErr) {
          console.warn("[upload] Cloudinary failed, falling back to local storage:", cloudErr);
        }
      }

      // ── Option B: Local Disk Storage (/public/uploads) ────────────────────
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const filename = generateSafeFilename(ext);
      const filePath = path.join(uploadDir, filename);

      await fs.promises.writeFile(filePath, buffer);

      const publicUrl = `/uploads/${filename}`;

      return NextResponse.json({
        url: publicUrl,
        size: file.size,
        type: mimeType,
      });
    } catch (err) {
      console.error("[upload] error:", err);
      return NextResponse.json({ error: "Upload failed: " + (err instanceof Error ? err.message : "unknown error") }, { status: 500 });
    }
  },
  { permissions: ["products.write", "games.write", "banners.write", "settings.write"] }
);
