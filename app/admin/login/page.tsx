import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />

      <main className="relative min-h-[70vh] flex items-center justify-center overflow-hidden px-4 py-20">

        {/* Ambient background blobs */}
        <div
          className="pointer-events-none absolute top-[-60px] left-1/4 h-96 w-96 rounded-full opacity-25 blur-[120px] animate-float"
          style={{ background: "#E91E8C" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full opacity-20 blur-[100px] animate-float-slow"
          style={{ background: "#FF6EB4" }}
        />
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full opacity-10 blur-[160px]"
          style={{ background: "#FFB3D1" }}
        />

        {/* Floating game emoji decorations */}
        <span className="pointer-events-none select-none absolute top-[12%] left-[8%] text-4xl opacity-20 animate-float" style={{ animationDelay: "0.3s" }}>🎮</span>
        <span className="pointer-events-none select-none absolute top-[20%] right-[10%] text-3xl opacity-20 animate-float-slow" style={{ animationDelay: "1s" }}>💎</span>
        <span className="pointer-events-none select-none absolute bottom-[18%] left-[12%] text-3xl opacity-15 animate-float" style={{ animationDelay: "0.7s" }}>⚡</span>
        <span className="pointer-events-none select-none absolute bottom-[14%] right-[8%] text-4xl opacity-15 animate-float-slow" style={{ animationDelay: "0.5s" }}>🌸</span>
        <span className="pointer-events-none select-none absolute top-[45%] left-[4%] text-2xl opacity-10 animate-float" style={{ animationDelay: "1.2s" }}>🎯</span>
        <span className="pointer-events-none select-none absolute top-[38%] right-[5%] text-2xl opacity-10 animate-float-slow" style={{ animationDelay: "0.9s" }}>✨</span>

        {/* Card */}
        <div className="relative z-10 w-full max-w-lg text-center">

          {/* 404 giant number */}
          <div className="relative mb-2 select-none leading-none">
            <span
              className="font-display text-[9rem] sm:text-[11rem] font-extrabold tracking-tighter"
              style={{
                background: "linear-gradient(135deg,#E91E8C 0%,#FF6EB4 40%,#FFD6EC 60%,#FF6EB4 75%,#E91E8C 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shine 3s linear infinite",
                filter: "drop-shadow(0 4px 24px rgba(233,30,140,0.25))",
              }}
            >
              404
            </span>

            {/* Decorative ring behind 404 */}
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span
                className="block h-48 w-48 sm:h-60 sm:w-60 rounded-full opacity-15"
                style={{
                  background: "radial-gradient(circle,#E91E8C 0%,transparent 70%)",
                  animation: "pulse 2.4s ease-in-out infinite",
                }}
              />
            </span>
          </div>

          {/* Icon */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-pink-200 bg-white shadow-xl shadow-pink-200/50">
            <span className="text-4xl">🔍</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-pink-800 mb-3 leading-tight">
            អូ! រកទំព័រនេះមិនឃើញ
            <br />
            <span className="text-pink-500 text-lg sm:text-xl font-bold">Page Not Found</span>
          </h1>

          {/* Sub-text */}
          <p className="text-pink-500 font-semibold text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
            ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមាន ឬត្រូវបានផ្លាស់ប្ដូររួចហើយ។
            <br />
            <span className="text-pink-400"></span>
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn-primary w-full sm:w-auto px-8 py-3 text-sm">
              🏠 ទំព័រដើម
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}