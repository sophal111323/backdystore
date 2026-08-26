import { prisma } from "@/lib/prisma";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — JASMINOPUP",
  description: "Game updates, top-up guides and promotions.",
};

export default async function BlogIndex() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverUrl: true,
      tag: true,
      publishedAt: true,
    },
  });

  return (
    <>
      <Header />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10">
          <h1 className="font-display text-3xl sm:text-5xl font-bold mb-3">News & Guides</h1>
          <p className="text-pink-500">Updates, events, and top-up guides for every supported game.</p>
        </div>

        {posts.length === 0 ? (
          <div className="card p-10 text-center text-pink-500 text-sm">No posts published yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="card overflow-hidden transition-all duration-300 hover:border-pink-400/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-300/10"
              >
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="h-44 w-full object-cover" />
                ) : (
                  <div className="h-44 w-full bg-gradient-to-br from-pink-500/20 to-pink-300/10" />
                )}
                <div className="p-5">
                  {p.tag && (
                    <span className="inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 mb-2">
                      {p.tag}
                    </span>
                  )}
                  <h2 className="font-display text-lg font-bold leading-tight">{p.title}</h2>
                  {p.excerpt && <p className="text-sm text-pink-500 mt-2 line-clamp-3">{p.excerpt}</p>}
                  {p.publishedAt && (
                    <div className="text-xs text-pink-500 mt-3">
                      {new Date(p.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </>
  );
}
