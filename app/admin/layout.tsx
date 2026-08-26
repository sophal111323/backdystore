import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getCurrentAdmin } from "@/lib/auth";
import AdminSidebar from "@/components/AdminSidebar";
import AdminPageTransition from "@/components/AdminPageTransition";
import AdminClickSound from "@/components/AdminClickSound";
import AdminMouseEffect from "@/components/AdminMouseEffect";

const ADMIN_COOKIE_NAME = "admin_token";
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH || "/admin/sophallogin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    const cookieStore = await cookies();
    const hasToken = Boolean(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

    if (hasToken) {
      redirect(ADMIN_LOGIN_PATH);
    }

    return <>{children}</>;
  }

  return (
    <div className="admin-root flex min-h-screen bg-fox-bg text-fox-text">
      <AdminClickSound />
      <AdminMouseEffect />
      <AdminSidebar adminEmail={admin.email} />
      <AdminPageTransition>{children}</AdminPageTransition>
    </div>
  );
}
