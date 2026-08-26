"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    // ✅ ចាកចេញ → redirect ទៅ /admin/sophallogin
    router.push("/admin/sophallogin");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-extrabold text-pink-600 transition-all duration-300 hover:bg-pink-50 hover:text-pink-700 hover:shadow-sm"
    >
      <span>ចាកចេញ</span><span>→</span>
    </button>
  );
}