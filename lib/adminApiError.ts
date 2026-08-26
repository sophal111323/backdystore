import { NextResponse } from "next/server";

type ErrorBody = {
  error: string;
  code?: string;
  detail?: string;
  prismaCode?: string;
};

const noStoreHeaders = { "Cache-Control": "no-store" };

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown server error";
}

function getPrismaCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function shouldIncludeDetail() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ADMIN_AUTH_DEBUG_ERRORS === "true"
  );
}

function withDebugDetail(body: ErrorBody, error: unknown) {
  if (!shouldIncludeDetail()) return body;

  const prismaCode = getPrismaCode(error);
  return {
    ...body,
    detail: getMessage(error),
    ...(prismaCode ? { prismaCode } : {}),
  };
}

function mapAdminApiError(error: unknown): { status: number; body: ErrorBody } {
  const message = getMessage(error);
  const lowerMessage = message.toLowerCase();
  const prismaCode = getPrismaCode(error);

  if (prismaCode === "P2021" || prismaCode === "P2022") {
    return {
      status: 503,
      body: withDebugDetail(
        {
          error:
            "Database schema is out of date. Run Prisma migrations for this deployment.",
          code: "database_schema_out_of_date",
        },
        error
      ),
    };
  }

  if (
    prismaCode?.startsWith("P10") ||
    lowerMessage.includes("can't reach database") ||
    lowerMessage.includes("database server") ||
    lowerMessage.includes("connection")
  ) {
    return {
      status: 503,
      body: withDebugDetail(
        {
          error:
            "Database is unavailable. Check DATABASE_URL and database access.",
          code: "database_unavailable",
        },
        error
      ),
    };
  }

  if (
    message.includes("ADMIN_JWT_SECRET") ||
    lowerMessage.includes("missing or invalid environment variables")
  ) {
    return {
      status: 500,
      body: withDebugDetail(
        {
          error:
            "Server auth configuration is incomplete. Check ADMIN_JWT_SECRET and required environment variables.",
          code: "admin_auth_misconfigured",
        },
        error
      ),
    };
  }

  return {
    status: 500,
    body: withDebugDetail({ error: "Something went wrong" }, error),
  };
}

export function adminApiErrorResponse(error: unknown) {
  const mapped = mapAdminApiError(error);
  return NextResponse.json(mapped.body, {
    status: mapped.status,
    headers: noStoreHeaders,
  });
}
