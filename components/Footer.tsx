import Link from "next/link";
import { getPublicSettings } from "@/lib/publicData";

function socialInfo(value: string | null | undefined, fallbackUsername: string, baseUrl: string) {
  const raw = (value || "").trim();

  if (raw.startsWith("https://")) {
    const username = raw.split("/").pop()?.replace(/^@/, "") || fallbackUsername;
    return { href: raw, label: `@${username}` };
  }

  const username = raw.replace(/^@/, "");
  const joiner = baseUrl.endsWith("/") || baseUrl.endsWith("@") ? "" : "/";

  if (/^[a-zA-Z0-9_.-]{2,40}$/.test(username)) {
    return { href: `${baseUrl}${joiner}${username}`, label: `@${username}` };
  }

  return { href: `${baseUrl}${joiner}${fallbackUsername}`, label: `@${fallbackUsername}` };
}

function telegramInfo(value: string | null | undefined) {
  return socialInfo(value, "jasmintopup", "https://t.me");
}

function tiktokInfo(value: string | null | undefined) {
  return socialInfo(value, "jasmintopup", "https://www.tiktok.com/@");
}

export default async function Footer() {
  const settings = await getPublicSettings();
  const telegram = telegramInfo(settings.supportTelegram);
  const tiktok = tiktokInfo(settings.supportTikTok);

  return (
    <footer className="relative border-t-2 border-pink-200 bg-white">
      <div className="h-2 w-full" style={{ background: "linear-gradient(90deg,#E91E8C,#FF6EB4,#E91E8C)" }} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logoUrl || "/jasmintopup-logo.png"}
                alt="Logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl object-contain"
              />
              <span className="font-display text-lg font-extrabold text-pink-800">
                JASMIN<span className="text-pink-500">TOPUP</span>
              </span>
            </div>
            <p className="text-xs text-pink-600 leading-relaxed font-medium">
              ការបញ្ចូលទឹកប្រាក់ហ្គេមលឿនបំផុតនៅកម្ពុជា។ ការដឹកជញ្ជូនភ្លាមៗ ការទូទាត់មានសុវត្ថិភាព។
            </p>
            <div className="flex gap-2 mt-4">
              <a
                href={telegram.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-pink-200 bg-pink-50 text-pink-500 transition-all hover:border-pink-400 hover:bg-pink-100 hover:text-pink-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.349.88 2.252 2.252 0 0 0 .28 4.402l1.504.308c.256.053.515.068.78.044l.85-.082 1.65 4.78c.114.332.415.554.764.554h.43c.35 0 .65-.222.764-.556l.908-2.636 4.354 3.226a2.24 2.24 0 0 0 3.345-1.09l3.12-9.545a2.253 2.253 0 0 0-.8-2.44z" />
                </svg>
              </a>
              <a
                href={tiktok.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-pink-200 bg-pink-50 text-pink-500 transition-all hover:border-pink-400 hover:bg-pink-100 hover:text-pink-700"
              >
                ♪
              </a>
            </div>
          </div>
          {[
            {
              heading: "Quick Links",
              items: [
                { label: "ទំព័រដើម", href: "/" },
                { label: "ហ្គេមទាំងអស់", href: "/#games" },
                { label: "តាមដានការបញ្ជាទិញ", href: "/order" },
                { label: "FAQ", href: "/faq" },
                { label: "Blog", href: "/blog" },
              ],
            },
            {
              heading: "ការទូទាត់",
              items: [{ label: "KHQR", href: "#" }],
            },
            {
              heading: "ជំនួយ",
              items: [
                { label: `Telegram: ${telegram.label}`, href: telegram.href },
                { label: `TikTok: ${tiktok.label}`, href: tiktok.href },
                ...(settings.supportEmail
                  ? [{ label: settings.supportEmail, href: `mailto:${settings.supportEmail}` }]
                  : []),
                { label: "24/7 Service", href: telegram.href },
              ],
            },
          ].map((col) => (
            <div key={col.heading}>
              <h4 className="font-extrabold mb-3 text-xs uppercase tracking-wider text-pink-500">{col.heading}</h4>
              <ul className="space-y-1.5 text-sm">
                {col.items.map((it) => (
                  <li key={it.label}>
                    <Link href={it.href} className="text-pink-700/70 transition-colors hover:text-pink-500 text-xs font-semibold">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-pink-100 flex flex-col items-center gap-3">
          <p className="text-[11px] font-bold text-pink-500 uppercase tracking-wider">ទូទាត់តាមរយៈ</p>
          <span className="flex h-9 w-16 items-center justify-center rounded-lg bg-red-600 text-[11px] font-black tracking-wide text-white shadow-sm shadow-red-200">
            KHQR
          </span>
          <a
            href="https://sop-khal.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-pink-500 transition-all hover:-translate-y-0.5 hover:text-pink-700 hover:underline"
          >
            Developed by Sokphal
          </a>
          <Link href="/privacy-policy" className="text-[11px] text-pink-500 font-semibold hover:text-pink-700 hover:underline transition-colors">
            Terms &amp; Policy
          </Link>
          <p className="text-[11px] text-pink-400 font-semibold">&copy; {new Date().getFullYear()} JASMINTOPUP. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
