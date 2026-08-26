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
      className="game-card group relative block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
    >
      {/* Glow border on hover */}
      <span
        className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4,#E91E8C)" }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center rounded-2xl border-2 border-pink-200 bg-white p-4 transition-all duration-500 group-hover:border-transparent group-hover:shadow-xl group-hover:shadow-pink-200/60">
        {/* Game image */}
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-pink-50 mb-3">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
            style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : { background: "linear-gradient(135deg,#FFE4F0,#FFCCE5)" }}
          />

          {/* Shine sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute -inset-y-1 -left-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-700 ease-out group-hover:left-[150%]" />
          </div>

          {featured && (
            <div className="absolute top-2 left-2 badge-best flex items-center gap-1 text-[9px]">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
              </svg>
              HOT
            </div>
          )}
        </div>

        {/* Game name */}
        <h3 className="font-display font-extrabold text-sm sm:text-base text-center leading-tight mb-3 text-pink-800 transition-colors duration-300 group-hover:text-pink-600">
          {name}
        </h3>

        {/* TOP UP button */}
        <button className="btn-topup">
          TOP UP
        </button>
      </div>
    </Link>
  );
}
