import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_CACHE_DYNAMIC,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-faqs", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const faqs = await prisma.faq.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    // Explicit public allowlist — prevents any future sensitive column from leaking.
    select: {
      id: true,
      question: true,
      answer: true,
      category: true,
      active: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return safeJson(faqs, undefined, API_CACHE_DYNAMIC);
}
