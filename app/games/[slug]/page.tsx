import Header from "@/components/Header";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicGameBySlug } from "@/lib/publicData";
import Footer from "@/components/Footer";
import TopUpForm from "@/components/TopUpForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getPublicGameBySlug(slug);

  if (!game || !game.active) notFound();

  return (
    <>
      <PublicDataRefresh scope="game" slug={slug} intervalMs={15000} />
      <Header />

      {/* Game banner */}
      <section className="relative overflow-hidden border-b border-fox-border">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: game.bannerUrl ? `url(${game.bannerUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-fox-bg via-fox-bg/90 to-fox-bg/70" />

        <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-3 sm:pt-6 sm:pb-5 sm:px-6 lg:px-8">
          <Link
            href="/#games"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-fox-muted hover:text-fox-primary transition-colors mb-2 sm:mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
            All games
          </Link>

          <div className="flex items-center gap-3.5 sm:gap-6">
            <div
              className="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl border-2 border-fox-border bg-fox-card shadow-xl shrink-0 overflow-hidden"
              style={{
                backgroundImage: `url(${game.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-fox-muted mb-0.5">
                {game.publisher}
              </p>
              <h1 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-1">
                {game.name}
              </h1>
              <div className="flex items-center gap-2.5">
                <p className="text-fox-accent text-xs sm:text-sm">
                  Top up {game.currencyName}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-300">
                  <Zap className="h-2.5 w-2.5" strokeWidth={3} />
                  រហ័សទាន់ចិត្ត
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-3 pb-8 sm:pt-5 sm:pb-12 sm:px-6 lg:px-8">
        <TopUpForm
          game={{
            id: game.id,
            slug: game.slug,
            name: game.name,
            currencyName: game.currencyName,
            uidLabel: game.uidLabel,
            uidExample: game.uidExample,
            requiresServer: game.requiresServer,
            servers: (() => { try { return JSON.parse(game.servers || "[]"); } catch { return []; } })(),
            categoryOrder: (() => { try { return JSON.parse((game as any).categoryOrder || "[]"); } catch { return []; } })(),
          }}
          products={game.products.map((p) => ({
            id: p.id,
            name: p.name,
            amount: p.amount,
            bonus: p.bonus,
            priceUsd: p.priceUsd,
            badge: p.badge,
            category: (p as any).category || "Diamonds",
            imageUrl: p.imageUrl,
          }))}
        />
      </main>

      <Footer />
    </>
  );
}
