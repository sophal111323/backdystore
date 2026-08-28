import Link from "next/link";

interface GameCardProps {
  slug: string;
  name: string;
  publisher: string;
  currencyName: string;
  imageUrl: string;
  featured?: boolean;
}

export default function GameCard({ slug, name, publisher, currencyName, imageUrl, featured }: GameCardProps) {
  return (
    <Link
      href={`/games/${slug}`}
      className="game-card group relative block rounded-xl sm:rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 h-full"
    >
      {/* Glow border on hover */}
      <span
        className="pointer-events-none absolute -inset-[2px] rounded-xl sm:rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4,#E91E8C)" }}
        aria-hidden
      />

      <div className="relative flex h-full flex-col items-center justify-between rounded-xl sm:rounded-2xl border-1.5 sm:border-2 border-pink-200 bg-white p-2 sm:p-3.5 md:p-4 transition-all duration-500 group-hover:border-transparent group-hover:shadow-xl group-hover:shadow-pink-200/60">
        {/* Game image */}
        <div className="relative w-full aspect-square overflow-hidden rounded-lg sm:rounded-xl bg-pink-50 mb-1.5 sm:mb-2.5">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
            style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : { background: "linear-gradient(135deg,#FFE4F0,#FFCCE5)" }}
          />

          {/* Shine sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg sm:rounded-xl">
            <div className="absolute -inset-y-1 -left-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-700 ease-out group-hover:left-[150%]" />
          </div>

          {featured && (
            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 badge-best flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5">
              <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
              </svg>
              HOT
            </div>
          )}
        </div>

        {/* Game name */}
        <h3 className="font-display font-extrabold text-[11px] sm:text-sm md:text-base text-center leading-snug mb-1.5 sm:mb-2.5 text-pink-800 transition-colors duration-300 group-hover:text-pink-600 line-clamp-1 w-full px-0.5">
          {name}
        </h3>

        {/* TOP UP button */}
        <button className="btn-topup mt-auto">
          TOP UP
        </button>
      </div>
    </Link>
  );
}
