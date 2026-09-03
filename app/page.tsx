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
      <section className="relative overflow-hidden pt-3 pb-1 sm:pt-6 sm:pb-3">
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

      {/* Game catalog */}
      <section
        id="games"
        className="relative mx-auto max-w-7xl px-2 sm:px-6 pt-2 pb-8 sm:pt-4 sm:pb-12"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 sm:px-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-pink-800 flex items-center gap-2">
            <Image
              src="https://i.ibb.co/Q3MfYWGH/1000073292-removebg-preview.png"
              alt="icon"
              width={32}
              height={32}
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            ហ្គេមទាំងអស់
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {games.map((game, i) => (
            <div
              key={game.slug}
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