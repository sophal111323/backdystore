import Header from "@/components/Header";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicFaqs } from "@/lib/publicData";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ — JASMINTOPUP",
  description: "Frequently asked questions about game top-ups, KHQR payment, delivery times and more.",
};

export default async function FaqPage() {
  const faqs = await getPublicFaqs();

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <>
      <PublicDataRefresh scope="faq" intervalMs={15000} />
      <Header />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-5xl font-bold mb-3">ជំនួយការ</h1>
          <p className="text-pink-500 font-semibold">ចម្លើយសម្រាប់សំណួរទូទៅ។ នៅតែមានបញ្ហា? <Link href="/order" className="text-pink-600 font-bold hover:underline">តាមដានការបញ្ជាទិញ</Link> ឬទំនាក់ទំនង Telegram។</p>
        </div>

        {faqs.length === 0 ? (
          <div className="card p-10 text-center text-pink-400 text-sm font-semibold">គ្មានសំណួរនៅឡើយ!</div>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mb-10">
              <h2 className="text-xs uppercase tracking-widest text-pink-500 font-extrabold mb-3">{cat}</h2>
              <div className="space-y-2">
                {list.map((f) => (
                  <details key={f.id} className="rounded-2xl border-2 border-pink-200 bg-white p-5 group transition-all duration-300 open:border-pink-400 open:bg-pink-50">
                    <summary className="cursor-pointer font-extrabold text-pink-800 flex items-center justify-between list-none">
                      <span>{f.question}</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-pink-300 text-pink-500 group-open:rotate-45 transition-transform text-sm font-bold">+</span>
                    </summary>
                    <div className="mt-3 text-sm text-pink-600 font-medium whitespace-pre-wrap leading-relaxed">{f.answer}</div>
                  </details>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
      <Footer />
    </>
  );
}
