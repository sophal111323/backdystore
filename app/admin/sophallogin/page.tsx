"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import AdminClickSound from "@/components/AdminClickSound";
import AdminMouseEffect from "@/components/AdminMouseEffect";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"login" | "2fa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    if (!lockedUntil) {
      setCountdown("");
      return;
    }

    const interval = setInterval(() => {
      const diff = lockedUntil.getTime() - Date.now();

      if (diff <= 0) {
        setLockedUntil(null);
        setError(null);
        setCountdown("");
        clearInterval(interval);
        return;
      }

      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    fetch("/api/admin/auth/2fa")
      .then((r) => r.json())
      .then((data) => {
        if (data.step === "2fa") {
          setStep("2fa");

          if (data.locked && data.forever) {
            setBanned(true);
            setError("កូដ 2FA ខុស ២ លើក Lock ជាអចិន្ត្រៃយ៍ សូមទាក់ទង owner។");
          } else if (data.locked && data.lockedUntil) {
            setLockedUntil(new Date(data.lockedUntil));
            setError("កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
          }

          return;
        }

        const savedEmail = localStorage.getItem("admin_login_email");
        if (!savedEmail) return;

        setEmail(savedEmail);

        fetch(`/api/admin/auth?email=${encodeURIComponent(savedEmail)}`)
          .then((r) => r.json())
          .then((loginData) => {
            if (!loginData.locked) return;

            if (loginData.forever) {
              setBanned(true);
              setError("គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍។ សូមទាក់ទង owner។");
            } else if (loginData.lockedUntil) {
              setLockedUntil(new Date(loginData.lockedUntil));
              setError("password ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const isLocked = banned || !!lockedUntil;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (isLocked || loading) return;

    setError(null);
    setLoading(true);

    localStorage.setItem("admin_login_email", email.trim());

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setBanned(true);
        setError(data.error || "គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍");
        return;
      }

      if (res.status === 429) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setError(data.error || "Lock បណ្ដោះអាសន្ន។ សូមរង់ចាំ។");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "មានបញ្ហាក្នុងការចូល");
      }

      if (data.requires2FA) {
        setStep("2fa");
        setCode("");
        setError(null);
        return;
      }

      localStorage.removeItem("admin_login_email");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "មានបញ្ហាក្នុងការចូល");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA(e: FormEvent) {
    e.preventDefault();
    if (banned || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      const message = data.error || data.message || "";

      if (res.status === 403) {
        setBanned(true);
        setError(message || "គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍");
        return;
      }

      if (res.status === 429) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setError(message || "កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
        return;
      }

      if (res.status === 401) {
        setError(message || "លេខកូដ 2FA មិនត្រឹមត្រូវ");

        const lowerMessage = String(message).toLowerCase();
        if (lowerMessage.includes("expired") || lowerMessage.includes("session")) {
          setStep("login");
          setPassword("");
          setCode("");
        }

        return;
      }

      if (!res.ok) {
        throw new Error(message || "លេខកូដ 2FA មិនត្រឹមត្រូវ");
      }

      localStorage.removeItem("admin_login_email");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "លេខកូដ 2FA មិនត្រឹមត្រូវ");
    } finally {
      setLoading(false);
    }
  }

  async function handleBackToLogin() {
    if (loading) return;

    setStep("login");
    setPassword("");
    setCode("");
    setError(null);
    setBanned(false);
    setLockedUntil(null);

    try {
      await fetch("/api/admin/auth", {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
  }

  const inputCls =
    "admin-login-input w-full rounded-[22px] border border-white/80 bg-white/68 py-4 pl-14 pr-5 text-[0.95rem] font-semibold text-[#5a1232] outline-none backdrop-blur-xl transition-all duration-300 placeholder:text-[#ca8aa5] focus:border-[#ff6fab] focus:bg-white/90 focus:shadow-[0_0_0_5px_rgba(255,105,180,0.14),0_18px_38px_rgba(217,39,115,0.12)] disabled:cursor-not-allowed disabled:opacity-45";

  const submitBtnCls =
    "admin-login-button group relative mt-2 flex h-[58px] w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] border border-white/35 bg-[linear-gradient(135deg,#ff74b8_0%,#ef3f8f_42%,#c81568_100%)] text-[1rem] font-bold text-white shadow-[0_18px_42px_rgba(219,39,119,0.38),inset_0_1px_0_rgba(255,255,255,0.45)] transition-all duration-300 hover:enabled:-translate-y-1 hover:enabled:scale-[1.012] hover:enabled:shadow-[0_24px_54px_rgba(219,39,119,0.48),inset_0_1px_0_rgba(255,255,255,0.55)] active:enabled:translate-y-0 active:enabled:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

  return (
    <main className="admin-login-page font-khmer relative min-h-screen overflow-hidden bg-[#ffe9f3] px-4 py-8 text-[#5a1232] sm:px-6">
      <AdminClickSound />
      <AdminMouseEffect />
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(255,103,173,0.32),transparent_33%),radial-gradient(circle_at_86%_68%,rgba(255,70,152,0.24),transparent_31%),linear-gradient(135deg,#fff7fb_0%,#ffe3f0_45%,#ffcde4_100%)]" />
        <div className="absolute -left-28 -top-28 h-[430px] w-[430px] rounded-full bg-white/20 shadow-[inset_0_0_55px_rgba(255,255,255,0.8)] blur-[1px]" />
        <div className="absolute -bottom-44 -right-28 h-[520px] w-[520px] rounded-full bg-[#ff8fc2]/24 shadow-[inset_0_0_65px_rgba(255,255,255,0.75)]" />
        <div className="admin-login-orbit absolute left-[4%] top-[9%] h-[210px] w-[430px] rounded-[100%] border border-white/45" />
        <div className="admin-login-orbit absolute right-[-5%] top-[6%] h-[250px] w-[520px] rounded-[100%] border border-white/35 [animation-delay:-4s]" />
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1.5px)] [background-size:54px_54px]" />
      </div>

      <FloatingBadge className="left-[10%] top-[16%] hidden md:flex" delay="0s">
        <BarChart3 size={28} />
      </FloatingBadge>
      <FloatingBadge className="left-[9%] bottom-[27%] hidden md:flex" delay="-3s">
        <ShieldCheck size={30} />
      </FloatingBadge>
      <FloatingBadge className="left-[19%] bottom-[15%] hidden lg:flex" delay="-5s">
        <Users size={31} />
      </FloatingBadge>
      <FloatingBadge className="right-[18%] top-[18%] hidden md:flex" delay="-2s">
        <Settings size={30} />
      </FloatingBadge>
      <FloatingBadge className="right-[18%] bottom-[24%] hidden lg:flex" delay="-6s">
        <Lock size={28} />
      </FloatingBadge>
      <span className="admin-login-sparkle left-[17%] top-[39%]">♥</span>
      <span className="admin-login-sparkle right-[10%] top-[42%] [animation-delay:-2s]">✦</span>
      <span className="admin-login-sparkle right-[23%] top-[52%] [animation-delay:-4s]">♥</span>
      <span className="admin-login-sparkle left-[7%] bottom-[18%] [animation-delay:-1s]">✧</span>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center">
        <Link
          href="/"
          className="admin-login-logo group relative mb-4 flex justify-center sm:mb-5"
          aria-label="Go to homepage"
        >
          <span className="absolute inset-x-8 bottom-1 h-8 rounded-full bg-[#e91e63]/25 blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <Image
            src="/jasmintopup-admin-logo.png"
            alt="JASMINTOPUP Logo"
            width={260}
            height={260}
            className="relative h-auto w-[170px] max-w-[58vw] drop-shadow-[0_18px_32px_rgba(196,24,92,0.25)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.035] sm:w-[220px]"
            priority
          />
        </Link>

        <div className="admin-login-card relative w-full max-w-[560px] overflow-hidden rounded-[36px] border border-white/80 bg-white/56 px-6 py-8 shadow-[0_30px_90px_rgba(204,37,111,0.20),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[30px] sm:px-12 sm:py-11">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-[#ff72b3]/18 blur-3xl" />

          <div className="relative text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/65 text-[#e91e63] shadow-[0_10px_30px_rgba(233,30,99,0.15)]">
              {step === "login" ? <Sparkles size={24} /> : <ShieldCheck size={25} />}
            </div>

            <h1 className="text-[1.75rem] font-black leading-tight tracking-[-0.03em] text-[#d41467] sm:text-[2.25rem]">
              {step === "login" ? "ចូលគណនីអ្នកគ្រប់គ្រង" : "បញ្ជាក់កូដ 2FA"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-[#9f5a77]">
              {step === "login"
                ? "ប្រព័ន្ធគ្រប់គ្រង JASMINTOPUP មានសុវត្ថិភាព និងរចនាស្អាតជាងមុន"
                : "Password ត្រឹមត្រូវហើយ។ សូមបញ្ចូលកូដ 2FA ដើម្បីបន្តចូល Admin Panel"}
            </p>
            <div className="mx-auto my-6 flex w-24 items-center justify-center gap-2">
              <span className="h-px flex-1 bg-[#f384b7]" />
              <span className="h-2 w-2 rounded-full bg-[#e91e63] shadow-[0_0_18px_rgba(233,30,99,0.7)]" />
              <span className="h-px flex-1 bg-[#f384b7]" />
            </div>
          </div>

          {step === "login" ? (
            <form className="relative space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-[#ba376f]">អ៊ីមែល</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[#e05493]" size={21} />
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={isLocked || loading}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-extrabold text-[#ba376f]">លេខសម្ងាត់</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[#e05493]" size={21} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputCls} pr-14`}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLocked || loading}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl text-[#bd7894] transition-all duration-300 hover:bg-[#ffe2ef] hover:text-[#e91e63] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLocked || loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <LoginError error={error} banned={banned} countdown={countdown} />

              <button type="submit" className={submitBtnCls} disabled={loading || isLocked}>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {loading ? (
                  <>
                    <Loader2 className="relative animate-spin" size={21} />
                    <span className="relative">កំពុងពិនិត្យ…</span>
                  </>
                ) : banned ? (
                  <span className="relative">🔒 គណនីត្រូវបានផ្អាកជាអចិន្ត្រៃយ៍</span>
                ) : lockedUntil ? (
                  <span className="relative">⏳ Lock {countdown}</span>
                ) : (
                  <>
                    <KeyRound className="relative text-yellow-200 drop-shadow" size={22} />
                    <span className="relative">ចូលគណនី</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="relative space-y-5" onSubmit={handleVerify2FA}>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-[#ba376f]">កូដ 2FA</label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[#e05493]" size={22} />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={inputCls}
                    placeholder="បញ្ចូលកូដ 2FA"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    autoFocus
                    disabled={banned || loading}
                  />
                </div>
              </div>

              <LoginError error={error} banned={banned} countdown={countdown} />

              <button type="submit" className={submitBtnCls} disabled={loading || banned}>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {loading ? (
                  <>
                    <Loader2 className="relative animate-spin" size={21} />
                    <span className="relative">កំពុងបញ្ជាក់…</span>
                  </>
                ) : banned ? (
                  <span className="relative">🔒 គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍</span>
                ) : (
                  <>
                    <ShieldCheck className="relative text-white" size={22} />
                    <span className="relative">បញ្ជាក់ 2FA</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[22px] border border-[#f7a7ca]/55 bg-white/62 font-bold text-[#c2185b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/82 hover:shadow-[0_16px_34px_rgba(233,30,99,0.14)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
                onClick={handleBackToLogin}
              >
                <ArrowLeft size={18} />
                ត្រឡប់ទៅ Login
              </button>
            </form>
          )}
        </div>

        <Link
          href="/"
          className="group mt-6 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[#b54473] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 hover:text-[#e91e63]"
        >
          <ArrowLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-1" />
          ត្រឡប់ទៅទំព័រដើម
        </Link>
      </section>
    </main>
  );
}

function FloatingBadge({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className: string;
  delay: string;
}) {
  return (
    <span
      className={`admin-login-float pointer-events-none fixed z-[1] h-[78px] w-[78px] items-center justify-center rounded-[28px] border border-white/55 bg-white/24 text-white/92 shadow-[0_18px_50px_rgba(205,30,100,0.14),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl ${className}`}
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function LoginError({
  error,
  banned,
  countdown,
}: {
  error: string | null;
  banned: boolean;
  countdown: string;
}) {
  if (!error) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-[20px] px-4 py-3 text-[0.86rem] font-semibold leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
        banned
          ? "border border-red-300/60 bg-red-50/70 text-red-800"
          : "border border-[#ff9ebd]/60 bg-[#fff1f6]/82 text-[#a61b4e]"
      }`}
    >
      <AlertTriangle className="mt-0.5 shrink-0" size={17} />
      <span>
        {error}
        {countdown && (
          <span className="ml-2 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-base font-black text-[#d41467]">
            ⏱ {countdown}
          </span>
        )}
      </span>
    </div>
  );
}
