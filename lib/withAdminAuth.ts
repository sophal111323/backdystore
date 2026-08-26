import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminFromRequest } from "@/lib/auth";
import type { Admin } from "@prisma/client";
import {
  forbiddenResponse,
  hasAnyAdminPermission,
  isAdminRoleAllowed,
  type AdminPermission,
  type NormalizedAdminRole,
} from "@/lib/adminPermissions";

type RouteParams = Record<string, string>;

export type AdminRouteContext<TParams extends RouteParams = RouteParams> = {
  params: Promise<TParams>;
};

type AuthedHandler<TParams extends RouteParams = RouteParams> = (
  req: NextRequest,
  ctx: AdminRouteContext<TParams>,
  admin: Admin
) => Promise<Response> | Response;

type AdminAuthOptions = {
  permission?: AdminPermission;
  permissions?: AdminPermission[];
  roles?: NormalizedAdminRole[];
};

export function withAdminAuth<TParams extends RouteParams = RouteParams>(
  handler: AuthedHandler<TParams>,
  options: AdminAuthOptions = {}
) {
  return async function (
    req: NextRequest,
    ctx: AdminRouteContext<TParams>
  ): Promise<Response> {
    const admin = await getCurrentAdminFromRequest(req);

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (options.roles && !isAdminRoleAllowed(admin, options.roles)) {
      return forbiddenResponse("Your admin role cannot access this resource.");
    }

    const permissions = [
      ...(options.permission ? [options.permission] : []),
      ...(options.permissions || []),
    ];

    if (permissions.length > 0 && !hasAnyAdminPermission(admin, permissions)) {
      return forbiddenResponse("Your admin role cannot perform this action.");
    }

    return handler(req, ctx, admin);
  };
}
