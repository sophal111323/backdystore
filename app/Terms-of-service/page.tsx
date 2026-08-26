import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service | JASMINTOPUP",
  description:
    "គោលការណ៍សេវាកម្ម ការសងប្រាក់ ការកែប្រែបញ្ជាទិញ និងការមិនទទួលខុសត្រូវក្រោយពេលទិញនៅ JASMINTOPUP។",
  keywords: [
    "jasmin topup",
    "terms of service",
    "privacy policy",
    "refund policy",
    "game top up Cambodia",
  ],
  openGraph: {
    title: "Terms of Service | JASMINTOPUP",
    description:
      "អានលក្ខខណ្ឌសេវាកម្មរបស់ JASMINTOPUP មុនពេលបញ្ជាទិញ ដើម្បីជៀសវាងការបញ្ចូល UID, Server ឬ Package ខុស។",
    type: "website",
  },
};

const updatedDate = "២៤ ឧសភា ២០២៦";

const quickRules = [
  "ពិនិត្យ UID / Player ID ឱ្យបានត្រឹមត្រូវមុនបង់ប្រាក់",
  "ពិនិត្យ Server / Zone / Region ឱ្យបានច្បាស់",
  "ពិនិត្យ Package និងតម្លៃមុនចុច Pay Now",
];

const termsSections = [
  {
    icon: "🚫",
    title: "ករណីដែលមិនទទួលខុសត្រូវ",
    tone: "pink",
    items: [
      "បញ្ចូល UID / Player ID ខុស",
      "ជ្រើសរើស Server, Zone ឬ Region ខុស",
      "ជ្រើសរើស Game ឬ Package ខុស",
      "បញ្ជាទិញទៅកាន់គណនីអ្នកផ្សេងដោយចៃដន្យ",
      "បង់ប្រាក់រួច ប៉ុន្តែចង់ប្តូរ Package ក្រោយមក",
      "Account របស់អតិថិជនមានបញ្ហាដែលមិនពាក់ព័ន្ធនឹង JASMINTOPUP",
      "Game provider ឬ third-party service មានការផ្លាស់ប្តូរ ឬពន្យារពេល",
    ],
  },
  {
    icon: "💳",
    title: "ការសងប្រាក់ / លុបចោល",
    tone: "rose",
    items: [
      "ការបញ្ជាទិញដែលបានដឹកជញ្ជូនរួច មិនអាចសងប្រាក់បានទេ",
      "បើការបញ្ជាទិញមិនទាន់ដំណើរការ សូមទាក់ទង Support ភ្លាមៗ",
      "ការកែប្រែមិនត្រូវបានធានា ប៉ុន្តែយើងនឹងពិនិត្យតាមស្ថានភាពជាក់ស្តែង",
      "សូមរក្សា receipt ឬ order number សម្រាប់ធ្វើភស្តុតាង",
    ],
  },
  {
    icon: "✅",
    title: "ទំនួលខុសត្រូវអតិថិជន",
    tone: "white",
    items: [
      "ត្រូវពិនិត្យ UID / Player ID មុនបញ្ជាទិញ",
      "ត្រូវពិនិត្យឈ្មោះ Player ប្រសិនបើប្រព័ន្ធបង្ហាញឱ្យផ្ទៀងផ្ទាត់",
      "ត្រូវពិនិត្យ Game, Package និងតម្លៃមុនបង់ប្រាក់",
      "ត្រូវទាក់ទង Support ភ្លាមៗ ប្រសិនបើឃើញកំហុស",
    ],
  },
  {
    icon: "🛡️",
    title: "ករណីដែលយើងទទួលខុសត្រូវ",
    tone: "soft",
    items: [
      "បញ្ហាកើតពីប្រព័ន្ធ JASMINTOPUP ផ្ទាល់",
      "ការបញ្ជាទិញមិនទាន់ដឹកជញ្ជូន ហើយមាន payment proof ត្រឹមត្រូវ",
      "ចំនួនទឹកប្រាក់ ឬ Package មិនត្រូវតាម order ដោយសារកំហុសប្រព័ន្ធ",
      "យើងនឹងពិនិត្យ និងដោះស្រាយដោយយុត្តិធម៌",
    ],
  },
];

const orderSteps = [
  { step: "01", title: "បញ្ចូលព័ត៌មាន", text: "បញ្ចូល UID, Server និងព័ត៌មានចាំបាច់ឱ្យត្រឹមត្រូវ។" },
  { step: "02", title: "ផ្ទៀងផ្ទាត់", text: "ពិនិត្យ Player name, Package និងតម្លៃមុនបង់ប្រាក់។" },
  { step: "03", title: "បង់ប្រាក់", text: "បង់ប្រាក់តាម KHQR ឬវិធីដែល website ផ្តល់ជូន។" },
  { step: "04", title: "រង់ចាំដឹកជញ្ជូន", text: "រក្សា order number សម្រាប់តាមដានស្ថានភាព។" },
];

function FloatingDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="terms-orb terms-orb-one" />
      <div className="terms-orb terms-orb-two" />
      <div className="terms-orb terms-orb-three" />
      <div className="absolute left-[8%] top-24 text-2xl text-pink-300/50 terms-float">✦</div>
      <div className="absolute right-[12%] top-44 text-3xl text-pink-300/45 terms-float-delayed">♡</div>
      <div className="absolute bottom-72 left-[14%] text-3xl text-pink-300/35 terms-float">✧</div>
      <div className="absolute bottom-44 right-[10%] text-2xl text-pink-300/45 terms-float-delayed">✿</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-pink-500 shadow-sm shadow-pink-100/80 backdrop-blur-xl">
      {children}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  tone,
  items,
}: {
  icon: string;
  title: string;
  tone: string;
  items: string[];
}) {
  const toneClass =
    tone === "pink"
      ? "from-pink-50 via-white to-rose-50 border-pink-200/80"
      : tone === "rose"
        ? "from-rose-50 via-white to-pink-50 border-rose-200/80"
        : tone === "soft"
          ? "from-fuchsia-50 via-white to-pink-50 border-fuchsia-200/70"
          : "from-white via-white to-pink-50/70 border-pink-100/90";

  return (
    <section className={`terms-card rounded-[1.8rem] border bg-gradient-to-br ${toneClass} p-5 shadow-[0_18px_50px_rgba(236,72,153,0.10)] backdrop-blur-xl sm:p-6`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white text-2xl shadow-md shadow-pink-100/80">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-black leading-snug text-pink-950">{title}</h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-400" />
        </div>
      </div>

      <ul className="space-y-2.5 text-sm font-semibold leading-relaxed text-pink-950/75">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-100 text-[10px] text-pink-600 ring-1 ring-pink-200/70">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="terms-card rounded-[1.5rem] border border-pink-100/90 bg-white/78 p-4 shadow-[0_12px_36px_rgba(236,72,153,0.08)] backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-pink-300/40">
          {step}
        </span>
        <h3 className="font-black text-pink-950">{title}</h3>
      </div>
      <p className="text-sm font-semibold leading-relaxed text-pink-950/65">{text}</p>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <>
      <Header />

      <main className="terms-page relative min-h-screen overflow-hidden bg-[#fff4f9] text-pink-950">
        <FloatingDecor />

        <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
          <div className="mb-6 flex items-center justify-between gap-3 text-sm font-bold text-pink-500">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/70 px-4 py-2 shadow-sm shadow-pink-100/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-300 hover:bg-white">
              ← ត្រឡប់ទៅទំព័រដើម
            </Link>
            <span className="hidden rounded-full border border-pink-200 bg-white/60 px-4 py-2 text-xs uppercase tracking-[0.22em] text-pink-400 shadow-sm shadow-pink-100/70 backdrop-blur-xl sm:inline-flex">
              Terms & Policy
            </span>
          </div>

          <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
            <div className="terms-card rounded-[2.4rem] border border-white/80 bg-white/68 p-6 shadow-[0_28px_80px_rgba(236,72,153,0.14)] backdrop-blur-2xl sm:p-8 lg:p-10">
              <Badge>
                <span className="h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_14px_rgba(236,72,153,0.9)]" />
                JASMINTOPUP Policy
              </Badge>

              <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight text-pink-950 sm:text-4xl lg:text-5xl">
                លក្ខខណ្ឌសេវាកម្ម
                <span className="mt-1 block bg-gradient-to-r from-pink-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                  និងការមិនទទួលខុសត្រូវ
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-pink-950/65 sm:text-lg">
                សូមអានព័ត៌មាននេះមុនពេលបញ្ជាទិញ។ វាជួយឱ្យអ្នកយល់ពីការសងប្រាក់ ការកែប្រែ order និងទំនួលខុសត្រូវរបស់អ្នកពេលប្រើប្រាស់សេវា JASMINTOPUP។
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/#games" className="btn-primary rounded-2xl px-5 py-3">
                  🎮 ទៅកាន់ហ្គេម
                </Link>
                <Link href="/order" className="rounded-2xl border-2 border-pink-300 bg-white px-5 py-3 text-sm font-black text-pink-600 shadow-sm shadow-pink-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-50 hover:shadow-lg hover:shadow-pink-200/70">
                  🔎 តាមដានការបញ្ជាទិញ
                </Link>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {quickRules.map((rule) => (
                  <div key={rule} className="rounded-2xl border border-pink-100 bg-white/76 p-3 shadow-sm shadow-pink-100/60">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-pink-600">✓</div>
                    <p className="text-xs font-bold leading-relaxed text-pink-950/70">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="terms-card rounded-[2.2rem] border border-pink-100/90 bg-gradient-to-br from-white via-pink-50/90 to-white p-5 shadow-[0_28px_80px_rgba(236,72,153,0.12)] backdrop-blur-2xl sm:p-6">
              <div className="rounded-[1.7rem] bg-gradient-to-br from-pink-500 via-fuchsia-500 to-pink-500 p-5 text-white shadow-xl shadow-pink-300/35">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">Important</p>
                    <h2 className="mt-2 text-2xl font-black">មុនចុច Pay Now</h2>
                  </div>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 text-3xl shadow-inner shadow-white/10">⚠️</span>
                </div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-white/88">
                  បន្ទាប់ពី order ដឹកជញ្ជូនរួច ករណីបញ្ចូលព័ត៌មានខុសដោយអតិថិជន អាចមិនអាចសងប្រាក់ ឬកែប្រែបានទេ។
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ["Updated", updatedDate],
                  ["Support", "Telegram 24/7"],
                  ["Service", "Game top up Cambodia"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white/75 px-4 py-3 shadow-sm shadow-pink-100/60">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">{label}</span>
                    <span className="text-sm font-black text-pink-950">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-amber-200 bg-amber-50/85 p-4 shadow-sm shadow-amber-100/70">
                <p className="text-sm font-bold leading-relaxed text-amber-800">
                  💡 បើអ្នកមិនប្រាកដពី UID ឬ Server សូមសួរ Support មុនបញ្ជាទិញ។ កុំបង់ប្រាក់បើព័ត៌មានមិនទាន់ច្បាស់។
                </p>
              </div>
            </aside>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderSteps.map((item) => (
              <StepCard key={item.step} {...item} />
            ))}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {termsSections.map((section) => (
              <SectionCard key={section.title} {...section} />
            ))}
          </div>

          <section className="terms-card mt-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 shadow-[0_24px_70px_rgba(236,72,153,0.12)] backdrop-blur-2xl">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-gradient-to-br from-pink-500 via-fuchsia-500 to-pink-500 p-6 text-white sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Support Center</p>
                <h2 className="mt-3 text-2xl font-black sm:text-3xl">យើងនៅទីនេះដើម្បីជួយអ្នក</h2>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-white/86">
                  ប្រសិនបើបញ្ហាកើតចេញពីប្រព័ន្ធ JASMINTOPUP ឬការដឹកជញ្ជូនមិនបានបញ្ចប់ យើងនឹងពិនិត្យ និងដោះស្រាយដោយយុត្តិធម៌។
                </p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                <a
                  href="https://t.me/JASMINTOPUP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-[1.5rem] border border-pink-100 bg-white p-5 shadow-sm shadow-pink-100/70 transition-all duration-300 hover:-translate-y-1 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-200/70"
                >
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 shadow-inner shadow-white">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M21.9 4.6c.3-1.2-.7-1.7-1.7-1.3L3.3 9.8c-1.1.4-1.1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.7.4 1 .8 1 .4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.3.3 1.5-.8l3.1-14ZM8.1 12l9.9-6.2c.5-.3.9-.1.5.2l-8 7.3-.3 3.1-1.4-4.3-.7-.1Z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-black text-pink-950">Telegram</h3>
                  <p className="mt-1 text-sm font-bold text-pink-500">@JASMINTOPUP</p>
                </a>

                <a
                  href="https://www.tiktok.com/@jasmintopup03"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-[1.5rem] border border-pink-100 bg-white p-5 shadow-sm shadow-pink-100/70 transition-all duration-300 hover:-translate-y-1 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-200/70"
                >
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 shadow-inner shadow-white">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16.7 3c.4 2.3 1.7 3.6 4 3.8v3.2a7.2 7.2 0 0 1-4-1.2v5.8c0 3.8-2.6 6.4-6.2 6.4A6.1 6.1 0 0 1 4.3 15c0-3.7 3-6.5 6.8-6.2V12a2.8 2.8 0 0 0-3.4 2.7 2.8 2.8 0 0 0 2.8 2.8c1.7 0 2.8-1.1 2.8-3.1V3h3.4Z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-black text-pink-950">TikTok</h3>
                  <p className="mt-1 text-sm font-bold text-pink-500">@jasmintopup03</p>
                </a>
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="flex-1 rounded-[1.4rem] bg-gradient-to-r from-pink-500 to-fuchsia-500 px-6 py-4 text-center text-sm font-black text-white shadow-xl shadow-pink-300/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pink-300/60">
              🏠 ត្រឡប់ទៅទំព័រដើម
            </Link>
            <Link href="/privacy-policy" className="flex-1 rounded-[1.4rem] border-2 border-pink-300 bg-white px-6 py-4 text-center text-sm font-black text-pink-600 shadow-sm shadow-pink-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-50 hover:shadow-lg hover:shadow-pink-200/70">
              🔐 អាន Privacy Policy
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
