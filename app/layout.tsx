import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";
import { CurrencyProvider } from "@/lib/currency";
import RouteProgress from "@/components/RouteProgress";
import AnnouncementBar from "@/components/AnnouncementBar";
import MaintenanceGate from "@/components/MaintenanceGate";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicSettings } from "@/lib/publicData";

export const metadata: Metadata = {
  title: "JASMINTOPUP",
  description:
    "Top up Mobile Legends, Free Fire, PUBG Mobile and more. Instant delivery, secure KHQR payment. 24/7 service in Cambodia.",
  keywords: [
    "top up",
    "mobile legends diamonds",
    "free fire diamonds",
    "pubg uc",
    "ABA Pay",
    "KHQR",
    "Cambodia top up",
    "JASMINTOPUP",
  ],
  openGraph: {
    title: "JASMINTOPUP",
    description: "Instant game top-ups with KHQR",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the per-request nonce injected by middleware.ts via the x-nonce header.
  // Pass `nonce` to any <Script nonce={nonce}> components that need it so the
  // browser will allow them to execute under the nonce-based CSP.
  //
  // Note: middleware.ts only runs on /admin/** routes (see matcher). For
  // non-admin pages the header will be absent; that is intentional — those
  // pages rely on the static security headers from next.config.ts only.
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  const settings = await getPublicSettings();

  const exchangeRate = settings.exchangeRate;

  return (
    <html lang="en">
      {/*
        Pass the nonce to <head> so any inline <style> tags injected by
        Next.js or third-party libraries are permitted under the nonce-based
        CSP set in middleware.ts (Fix #3: replaced 'unsafe-inline' with nonce).
        On non-admin pages nonce is undefined and the attribute is omitted.
      */}
      <head>
        {nonce && (
          // This empty <style> tag seeds the nonce on the <head> element so
          // that browsers accept any framework-injected inline styles that
          // Next.js appends during SSR (e.g. font-face, critical CSS).
          // The tag itself emits no styles.
          <style nonce={nonce} suppressHydrationWarning />
        )}
      </head>
      <body>
        {/*
          RouteProgress renders a client-side progress bar via a <script>-free
          animation. No nonce needed here.

          If you add a next/script <Script> component in future, pass the nonce:
            <Script nonce={nonce} src="..." strategy="afterInteractive" />
        */}
        <RouteProgress />
        <PublicDataRefresh scope="settings" intervalMs={20000} />

        <CurrencyProvider exchangeRate={exchangeRate}>
          <AnnouncementBar />
          <MaintenanceGate />
          {children}
        </CurrencyProvider>
      </body>
    </html>
  );
}
