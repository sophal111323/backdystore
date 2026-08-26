import Image from "next/image";
import Header from "@/components/Header";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicHomeData } from "@/lib/publicData";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import HeroCarousel from "@/components/HeroCarousel";
import HomeInvisibleTurnstile from "@/components/HomeInvisibleTurnstile";
import Link from "next/link";
import {
  Zap,
  ShieldCheck,
  BadgePercent,
  Gamepad2,
  UserRoundCheck,
  CreditCard,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { games, banners } = await getPublicHomeData();

  return (
    <>
      <PublicDataRefresh scope="home" intervalMs={15000} />
      <Header />

      {/* ✅ Invisible Turnstile: auto verify homepage visitor in background */}
      <HomeInvisibleTurnstile />

      {/* Hero — scrolling image marquee */}
      <section className="relative overflow-hidden py-6 sm:py-10">
        <div className="hero-bg" />

        <div
          className="pointer-events-none absolute top-0 left-1/4 h-72 w-72 rounded-full opacity-30 blur-[100px] animate-float"
          style={{ background: "#E91E8C" }}
        />

        <div
          className="pointer-events-none absolute bottom-0 right-1/4 h-60 w-60 rounded-full opacity-20 blur-[100px] animate-float-slow"
          style={{ background: "#FF6EB4" }}
        />

        {banners.length > 0 ? (
          <HeroCarousel banners={banners} />
        ) : (
          <div className="text-center py-16 text-pink-400 font-semibold">
            <p>
              Add banners in{" "}
              <span className="font-mono text-pink-600">
                Admin → Banners
              </span>{" "}
              to show images here.
            </p>
          </div>
        )}
      </section>

      {/* Section title + games grid */}
      <section
        id="games"
        className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-2 text-pink-800 flex items-center justify-center gap-2">
            <Image
              src="https://i.ibb.co/Q3MfYWGH/1000073292-removebg-preview.png"
              alt="icon"
              width={48}
              height={48}
              className="h-12 w-12"
            />
            ហ្គេមទាំងអស់
          </h2>
          <p className="text-pink-500 text-sm font-bold"></p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {games.map((game, i) => (
            <div
              key={game.id}
              className="fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <GameCard
                slug={game.slug}
                name={game.name}
                publisher={game.publisher}
                currencyName={game.currencyName}
                imageUrl={game.imageUrl}
                featured={game.featured}
              />
            </div>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-20 text-pink-400 font-semibold">
            <p>
              No games yet. Run{" "}
              <code className="text-pink-600 font-mono">
                npm run db:seed
              </code>{" "}
              to populate.
            </p>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 rounded-3xl mx-4 opacity-10"
          style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4)" }}
        />

        <div className="relative text-center mb-10">
          <div
            className="inline-block rounded-2xl px-6 py-2 mb-4 font-extrabold text-white text-sm shadow-lg shadow-pink-300/40"
            style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4)" }}
          >
            📋 របៀបប្រើប្រាស់
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-2 text-pink-800">
            ដំណើរការ Top Up
          </h2>

          <p className="text-pink-500 text-sm font-bold">
            បីជំហានងាយស្រួល ក្នុងរយៈពេលក្រោមមួយនាទី
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              step: "01",
              Icon: Gamepad2,
              title: "ជ្រើសរើសហ្គេម",
              desc: "ជ្រើសរើសហ្គេមពីបញ្ជីហ្គេមដ៏ពេញនិយមរបស់យើង",
            },
            {
              step: "02",
              Icon: UserRoundCheck,
              title: "បញ្ចូល UID",
              desc: "បញ្ចូល Player IDរបស់លោកអ្នក",
            },
            {
              step: "03",
              Icon: CreditCard,
              title: "បង់ & ទទួល",
              desc: "បង់ជាមួយ KHQR។ Diamonds មកដល់ភ្លាមៗ!",
            },
          ].map((s, i) => (
            <div
              key={s.step}
              className="group relative rounded-2xl border-2 border-pink-200 bg-white p-6 text-center transition-all duration-500 hover:border-pink-400 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-200/60 fade-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-extrabold text-white shadow-md"
                style={{
                  background: "linear-gradient(135deg,#E91E8C,#FF6EB4)",
                }}
              >
                STEP {s.step}
              </div>

              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4 mt-2 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-md shadow-pink-200/60"
                style={{
                  background: "linear-gradient(135deg,#FFE4F0,#FFB3D1)",
                }}
              >
                <s.Icon className="h-7 w-7 text-pink-600" strokeWidth={2} />
              </div>

              <h3 className="font-display text-lg font-extrabold mb-1 text-pink-800">
                {s.title}
              </h3>

              <p className="text-sm text-pink-500 font-medium">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              Icon: Zap,
              title: "ដឹកជញ្ជូនភ្លាមៗ",
              desc: "Diamonds ទៅដល់ក្នុងប៉ុន្មានវិនាទី 24/7",
            },
            {
              Icon: ShieldCheck,
              title: "១០០% មានសុវត្ថិភាព",
              desc: "មិនប៉ះពាល់ដល់អាខោនឡើយ",
            },
            {
              Icon: BadgePercent,
              title: "តម្លៃល្អបំផុត",
              desc: "តម្លៃប្រកួតប្រជែង ជាមួយ Promo ជាប្រចាំ",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="group flex items-start gap-4 rounded-2xl border-2 border-pink-200 bg-white p-5 transition-all duration-500 hover:border-pink-400 hover:bg-pink-50 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-200/60 fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 shadow-md shadow-pink-200/60"
                style={{
                  background: "linear-gradient(135deg,#FFE4F0,#FFB3D1)",
                }}
              >
                <f.Icon className="h-6 w-6 text-pink-600" strokeWidth={2} />
              </div>

              <div>
                <h3 className="font-display font-extrabold text-sm mb-1 text-pink-800">
                  {f.title}
                </h3>

                <p className="text-xs text-pink-500 font-medium leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="text-center mb-10">
          <div
            className="inline-block rounded-2xl px-6 py-2 mb-4 font-extrabold text-white text-sm shadow-lg shadow-pink-300/40"
            style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4)" }}
          >
            ❓ ចម្លើយដែលសួរញឹកញាប់
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-2 text-pink-800">
            FAQ
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "ការដឹកជញ្ជូនចំណាយពេលប៉ុន្មាន?",
              a: "ភ្លាមៗ — ប៉ុន្មានវិនាទីបន្ទាប់ពីការបង់ប្រាក់ត្រូវបានបញ្ជាក់។ អាចដល់ ៥ នាទីក្នុងម៉ោងមមាញឹក។",
            },
            {
              q: "វាមានសុវត្ថិភាពសម្រាប់គណនីរបស់ខ្ញុំទេ?",
              a: "បាទ/ចាស។ យើងត្រូវការតែ UID របស់អ្នក — មិនត្រូវការ Password ឡើយ។ ការបញ្ជាទិញតាមរយៈអ្នកចែកចាយដែលមានអាជ្ញាប័ណ្ណ។",
            },
            {
              q: "វិធីទូទាត់អ្វីខ្លះ?",
              a: "KHQR ដែលគាំទ្រ (ABA, Wing, ជាដើម)។",
            },
            {
              q: "បញ្ចូល UID ខុស?",
              a: "ទំនាក់ទំនងយើងតាម Telegram @thephal ភ្លាមៗ។ យើងអាចជួសជុលវាមុនការដឹកជញ្ជូន។",
            },
            {
              q: "តើខ្ញុំអាចទទួលបានការបញ្ចុះតម្លៃទេ?",
              a: "បាទ/ចាស លោកអ្នកអាចទទួលបានការបញ្ចុះតម្លៃតាមរយៈ promo និង Events ផ្សេងៗ",
            },
          ].map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border-2 border-pink-200 bg-white transition-all duration-300 open:border-pink-400 open:bg-pink-50 open:shadow-lg open:shadow-pink-200/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-extrabold text-sm text-pink-800">
                {item.q}

                <span
                  className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-pink-300 text-pink-500 transition-transform duration-300 group-open:rotate-45 group-open:border-pink-500"
                  style={{
                    background: "linear-gradient(135deg,#FFE4F0,#FFB3D1)",
                  }}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>

              <p className="px-5 pb-5 text-sm text-pink-600 font-medium leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center shadow-2xl shadow-pink-300/40"
          style={{
            background:
              "linear-gradient(135deg,#E91E8C 0%,#FF6EB4 50%,#C2185B 100%)",
          }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10" />

          <div className="relative">
            <div className="text-4xl mb-3">🌸</div>

            <h3 className="font-display text-2xl sm:text-3xl font-extrabold mb-2 text-white">
              រៀបចំ Top Up? <span className="opacity-90">តោះទៅ!</span>
            </h3>

            <p className="text-pink-100 text-sm mb-6 font-semibold">
              ជ្រើសរើសហ្គេម ហើយបញ្ចប់ក្នុងរយៈពេលក្រោមមួយនាទី
            </p>

            <Link
              href="#games"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-extrabold text-pink-600 text-sm shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]"
            >
              ស្វែងរកហ្គេម
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}