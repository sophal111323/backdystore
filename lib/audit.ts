import { prisma } from "./prisma";
import { getCurrentAdmin } from "./auth";
import type { Admin } from "@prisma/client";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getIp";

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
  adminId?: string | null;
  adminEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function stringifyAuditDetails(details?: unknown) {
  if (details == null) return null;
  if (typeof details === "string") return details.slice(0, 4000);
  return JSON.stringify(details).slice(0, 4000);
}

/**
 * Write an audit log entry. Resolves the current web admin automatically.
 * Silently ignores failures so audit never blocks a real operation.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = await getCurrentAdmin().catch(() => null);

    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? admin?.id ?? null,
        adminEmail: entry.adminEmail ?? admin?.email ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        details: stringifyAuditDetails(entry.details),
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.warn("[audit] write failed:", err);
  }
}

/**
 * Write an audit log for routes that already know the admin/request.
 * This is used by Flutter Bearer-token endpoints where cookie lookup is not enough.
 */
export async function writeAuditForAdmin(
  admin: Pick<Admin, "id" | "email"> | null,
  req: NextRequest | null,
  entry: AuditEntry
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? admin?.id ?? null,
        adminEmail: entry.adminEmail ?? admin?.email ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        details: stringifyAuditDetails(entry.details),
        ipAddress: entry.ipAddress ?? (req ? getClientIp(req) : null),
        userAgent: entry.userAgent ?? req?.headers.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    console.warn("[audit] write failed:", err);
  }
}
