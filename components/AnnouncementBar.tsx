import { getPublicSettings } from "@/lib/publicData";

const TONES: Record<string, string> = {
  info: "border-pink-300 text-white",
  warning: "bg-yellow-400 border-yellow-400 text-yellow-900",
  promo: "bg-green-500 border-green-500 text-white",
};

const TONE_BG: Record<string, string> = {
  info: "linear-gradient(90deg,#E91E8C,#FF6EB4,#E91E8C)",
  warning: "",
  promo: "",
};

export default async function AnnouncementBar() {
  const settings = await getPublicSettings();
  if (!settings.announcementEnabled || !settings.announcementText.trim()) return null;

  const tone = settings.announcementTone || "info";
  const cls = TONES[tone] || TONES.info;
  const bg = TONE_BG[tone] || "";

  return (
    <div className={`border-b-2 ${cls}`} style={bg ? { background: bg } : {}}>
      <div className="mx-auto max-w-7xl px-4 py-2 text-center text-xs sm:text-sm font-bold">
        🌸 {settings.announcementText} 🌸
      </div>
    </div>
  );
}
