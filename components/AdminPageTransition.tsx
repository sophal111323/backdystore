"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AdminPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main
      key={pathname}
      className="admin-page-shell min-w-0 flex-1 overflow-auto p-6"
    >
      {children}
    </main>
  );
}
