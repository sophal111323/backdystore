"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, ShieldCheck, Sparkles } from "lucide-react";

type MaintenanceState = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt?: string | null;
};

const DEFAULT_MAINTENANCE_MESSAGE =
  "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។";

function isAdminPage(pathname: string | null): boolean {
  if (!pathname) return false;

  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function MaintenanceGate() {
  const pathname = usePathname();
  const isAdminRoute = isAdminPage(pathname);

  const [state, setState] = useState<MaintenanceState>({
    maintenanceMode: false,
    maintenanceMessage: "",
  });

  useEffect(() => {
    if (isAdminRoute) {
      setState({
        maintenanceMode: false,
        maintenanceMessage: "",
        updatedAt: null,
      });
      return;
    }

    async function checkMaintenance() {
      try {
        const res = await fetch("/api/settings/public", {
          cache: "no-store",
        });

        const data = await res.json();

        setState({
          maintenanceMode: Boolean(data.maintenanceMode),
          maintenanceMessage: data.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
          updatedAt: data.updatedAt || null,
        });
      } catch {
        setState({
          maintenanceMode: false,
          maintenanceMessage: "",
          updatedAt: null,
        });
      }
    }

    checkMaintenance();
    const timer = window.setInterval(checkMaintenance, 10000);

    const onFocus = () => checkMaintenance();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkMaintenance();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAdminRoute]);

  if (isAdminRoute || !state.maintenanceMode) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex min-h-screen items-center justify-center overflow-hidden bg-[#180313]/75 px-4 py-8 font-khmer backdrop-blur-xl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
    >
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-pink-400/25 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.20),transparent_34%),radial-gradient(circle_at_bottom,rgba(233,30,140,0.22),transparent_45%)]" />

      <section className="fade-up relative w-full max-w-[430px] overflow-hidden rounded-[34px] border border-white/70 bg-white/95 text-center shadow-[0_30px_90px_rgba(80,0,48,0.32)] ring-1 ring-pink-200/70">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-pink-300" />
        <div className="absolute -top-24 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-pink-200/55 blur-2xl" />

        <div className="relative px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9">
          <div className="mx-auto mb-4 flex w-full justify-center">
            <div className="relative flex h-[118px] w-[220px] items-center justify-center rounded-[30px] border border-pink-100/90 bg-gradient-to-br from-white via-pink-50 to-white px-4 py-3 shadow-xl shadow-pink-200/55 ring-1 ring-white/80">
              <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.22),transparent_58%)]" />
              <img
                src="/jasmintopup-logo.png"
                alt="JASMINTOPUP logo"
                className="relative h-full w-full object-contain drop-shadow-[0_14px_22px_rgba(219,39,119,0.28)]"
              />
              <div className="absolute -bottom-3 right-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white shadow-lg shadow-pink-400/45">
                <AlertTriangle className="h-6 w-6" strokeWidth={2.8} />
              </div>
            </div>
          </div>

          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-pink-600 shadow-sm shadow-pink-100">
            <Sparkles className="h-3.5 w-3.5" />
            Maintenance Mode
          </div>

          <h1
            id="maintenance-title"
            className="text-[26px] font-black leading-tight text-pink-700 sm:text-3xl"
          >
            Server កំពុងថែទាំ
          </h1>

          <p className="mx-auto mt-3 max-w-[320px] text-[15px] font-semibold leading-7 text-slate-600 sm:text-base">
            {state.maintenanceMessage}
          </p>

          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-pink-200 to-transparent" />

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-pink-100 bg-pink-50/80 p-4 shadow-sm shadow-pink-100/70">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-pink-500 shadow-sm">
                <Clock className="h-[18px] w-[18px]" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                Wait time
              </p>
              <p className="mt-0.5 text-sm font-black text-pink-700">~30 នាទី</p>
            </div>

            <div className="rounded-2xl border border-pink-100 bg-pink-50/80 p-4 shadow-sm shadow-pink-100/70">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-pink-500 shadow-sm">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                Status
              </p>
              <p className="mt-0.5 text-sm font-black text-pink-700">កំពុងជួសជុល</p>
            </div>
          </div>

          <p className="mt-6 rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-500 shadow-sm">
            សូមអរគុណសម្រាប់ការរង់ចាំ។ Website នឹងត្រឡប់មកវិញឆាប់ៗនេះ ✨
          </p>
        </div>
      </section>
    </div>
  );
}
