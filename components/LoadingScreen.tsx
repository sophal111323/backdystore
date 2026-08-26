import { Loader2 } from "lucide-react";

interface Props {
  label?: string;
  fullscreen?: boolean;
}

export default function LoadingScreen({ label = "កំពុងដំណើរការ...", fullscreen = true }: Props) {
  return (
    <div
      className={
        fullscreen
          ? "flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
          : "flex flex-col items-center justify-center gap-4 py-12"
      }
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-pink-500/20 blur-xl animate-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-pink-400/40 bg-white shadow-lg shadow-pink-300/30">
          <Loader2 className="h-7 w-7 animate-spin text-pink-600" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-sm font-semibold tracking-wide text-pink-800">
          {label}
        </span>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-bounce" />
          
        </div>
      </div>
    </div>
  );
}
