"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const CATEGORY_PRESETS = [
  "Diamonds",
  "Weekly Lite",
  "Weekly Membership",
  "3 in 1",
  "Pass",
  "Other",
];

const BADGE_PRESETS = [
  "ទទួលបាន20💎",
  "ទទួលបាន40💎",
  "ទទួលបាន60💎",
  "ទទួលបាន80💎",
  "ទទួលបាន100💎",
  "ទទួលបាន120💎",
  "ទទួលបាន140💎",
  "ទទួលបាន160💎",
  "ទទួលបាន180💎",
  "ទទួលបាន200💎",
  "ទទួលបាន400💎",
  "ទទួលបាន600💎",
  "ទទួលបាន800💎",
  "ទទួលបាន1220💎",
  "Hot",
  "Best Value",
  "Pass",
  "Instant",
];

export default function AdminProductsPage() {
  const searchParams = useSearchParams();
  const gameIdFilter = searchParams.get("gameId") || "";

  const [games, setGames] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState(gameIdFilter);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [gRes, pRes] = await Promise.all([
      fetch("/api/admin/games").then((r) => r.json()),
      fetch(`/api/admin/products${selectedGame ? `?gameId=${selectedGame}` : ""}`).then((r) => r.json()),
    ]);
    setGames(Array.isArray(gRes) ? gRes : []);
    setProducts(Array.isArray(pRes) ? pRes : []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame]);

  async function toggleActive(p: any) {
    await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    await loadAll();
  }

  async function deleteProduct(p: any) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    await loadAll();
  }

  // Get distinct categories from loaded products
  const availableCategories = Array.from(
    new Set(
      products
        .map((p) => p.category || "Diamonds")
        .filter(Boolean)
    )
  );

  const filteredProducts = products.filter((p) => {
    if (!selectedCategory) return true;
    return (p.category || "Diamonds") === selectedCategory;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          <p className="text-fox-muted">Top-up packages grouped by type/category for customers.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">+ Add Product</button>
      </div>

      <div className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Filter by Game</label>
          <select
            className="input w-full"
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Filter by Package Type / Category</label>
          <select
            className="input w-full"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories ({products.length} products)</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({products.filter((p) => (p.category || "Diamonds") === cat).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {(creating || editing) && (
        <ProductForm
          games={games}
          defaultGameId={selectedGame}
          initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await loadAll(); }}
        />
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Game</th>
                <th className="text-left px-5 py-3">Category / Type</th>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-right px-5 py-3">Bonus</th>
                <th className="text-right px-5 py-3">Price USD</th>
                <th className="text-left px-5 py-3">Badge</th>
                <th className="text-left px-5 py-3">Supplier</th>
                <th className="text-left px-5 py-3">Supplier Code / ID</th>
                <th className="text-center px-5 py-3">Active</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {loading ? (
                <tr><td colSpan={11} className="px-5 py-12 text-center text-fox-muted">Loading...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-16 text-center">
                    <div className="text-4xl mb-3">💎</div>
                    <p className="text-fox-muted mb-1">No products found</p>
                    <p className="text-xs text-fox-muted/60 mb-3">Add packages for customers to purchase.</p>
                    <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-fox-primary px-4 py-2 text-sm font-semibold text-black hover:bg-fox-primary/90 transition-colors">+ Add Product</button>
                </td></tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-fox-surface/50">
                    <td className="px-5 py-3 text-fox-muted font-medium">{p.game.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30">
                        {p.category || "Diamonds"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-6 w-6 object-contain rounded shrink-0" />
                        )}
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{p.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-mono text-fox-accent">{p.bonus > 0 ? `+${p.bonus}` : "—"}</td>
                    <td className="px-5 py-3 text-right font-mono text-fox-primary font-bold">${p.priceUsd.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs">
                      {p.badge ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {p.badge}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {p.supplier === "khmer_topup" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Khmer TopUp
                        </span>
                      ) : p.supplier === "frozenyuki" || p.supplier === "soratopup" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          FrozenYuki
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Bay2Game
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono">
                      {p.supplierCode ? (
                        <span className="text-green-400 font-semibold">{p.supplierCode}</span>
                      ) : (
                        <span className="text-yellow-400">⚠️ not set</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(p)}>
                        <span className={`inline-block h-5 w-9 rounded-full relative transition-colors ${p.active ? "bg-green-500" : "bg-fox-border"}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${p.active ? "translate-x-4" : "translate-x-0.5"}`} />
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => setEditing(p)} className="text-fox-accent text-xs hover:underline">Edit</button>
                      <button onClick={() => deleteProduct(p)} className="text-red-400 text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductForm({ games, defaultGameId, initial, onCancel, onSaved }: any) {
  const [form, setForm] = useState({
    gameId: initial?.gameId || defaultGameId || games[0]?.id || "",
    name: initial?.name || "",
    category: initial?.category || "Diamonds",
    amount: initial?.amount ?? 0,
    bonus: initial?.bonus ?? 0,
    priceUsd: initial?.priceUsd ?? 0,
    badge: initial?.badge || "",
    imageUrl: initial?.imageUrl || "",
    active: initial?.active ?? true,
    sortOrder: initial?.sortOrder ?? 0,
    supplier: initial?.supplier || "bay2game",
    supplierCode: initial?.supplierCode || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      category: form.category?.trim() || "Diamonds",
      amount: Number(form.amount),
      bonus: Number(form.bonus),
      priceUsd: Number(form.priceUsd),
      sortOrder: Number(form.sortOrder),
      badge: form.badge || null,
      imageUrl: form.imageUrl || null,
      supplier: form.supplier || "bay2game",
      supplierCode: form.supplierCode || null,
    };
    const url = initial ? `/api/admin/products/${initial.id}` : "/api/admin/products";
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed");
      setSaving(false);
      return;
    }
    onSaved();
  }

  const isKhmerTopup = form.supplier === "khmer_topup";
  const isFrozenYuki = form.supplier === "frozenyuki" || form.supplier === "soratopup";

  return (
    <form onSubmit={save} className="card p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">{initial ? "Edit Product" : "New Product"}</h3>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-3">
          <label className="label">Game</label>
          <select
            className="input"
            value={form.gameId}
            onChange={(e) => setForm({ ...form, gameId: e.target.value })}
            disabled={!!initial}
            required
          >
            <option value="">— select —</option>
            {games.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {/* Category / Package Type */}
        <div className="md:col-span-3">
          <label className="label">Package Type / Category (ប្រភេទកញ្ចប់)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {CATEGORY_PRESETS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm({ ...form, category: cat })}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  form.category === cat
                    ? "bg-pink-500 text-white font-semibold border-pink-500 shadow-sm"
                    : "bg-fox-surface text-fox-muted border-fox-border hover:border-pink-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="e.g. Diamonds, Weekly Lite, Weekly Membership, 3 in 1, Pass, Other..."
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
        </div>

        <div className="md:col-span-3">
          <label className="label">Product Name (e.g. &quot;55 Diamonds&quot;, &quot;Weekly Lite&quot;, &quot;3in1&quot;)</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>

        <div>
          <label className="label">Amount (0 for passes/special cards)</label>
          <input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Bonus</label>
          <input className="input" type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
        </div>
        <div>
          <label className="label">Price (USD)</label>
          <input className="input" type="number" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} required />
        </div>

        {/* Badge / Tag */}
        <div className="md:col-span-3">
          <label className="label">Badge Tag (ស្លាកសញ្ញាលើកញ្ចប់ e.g. ទទួលបាន20💎, Hot, Best Value)</label>
          <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto">
            {BADGE_PRESETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setForm({ ...form, badge: b })}
                className={`px-2.5 py-0.5 text-xs rounded-md border transition-all ${
                  form.badge === b
                    ? "bg-amber-500 text-black font-bold border-amber-400"
                    : "bg-fox-surface text-fox-muted border-fox-border hover:border-amber-400/60"
                }`}
              >
                {b}
              </button>
            ))}
            {form.badge && (
              <button
                type="button"
                onClick={() => setForm({ ...form, badge: "" })}
                className="px-2.5 py-0.5 text-xs rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                Clear
              </button>
            )}
          </div>
          <input
            className="input"
            placeholder="e.g. ទទួលបាន20💎, ទទួលបាន1220💎, Hot, Best Value, Pass, etc."
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
          />
        </div>

        {/* Supplier / API Provider Selection */}
        <div>
          <label className="label">Supplier / API Provider</label>
          <select
            className="input"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          >
            <option value="bay2game">Bay2Game</option>
            <option value="khmer_topup">Khmer TopUp</option>
            <option value="frozenyuki">FrozenYuki / SoraTopup</option>
          </select>
        </div>

        {/* Dynamic Supplier Code / Package ID input */}
        <div className="md:col-span-2">
          <label className="label">
            {isKhmerTopup
              ? "Khmer TopUp Package ID"
              : isFrozenYuki
              ? "FrozenYuki Package Code (e.g. 100 or ff:100)"
              : "Bay2Game Product Code"}{" "}
            — required for auto delivery
          </label>
          <input
            className="input font-mono"
            placeholder={
              isKhmerTopup
                ? "e.g. 268"
                : isFrozenYuki
                ? "e.g. 100 or ff:100 or ml:86"
                : "e.g. FF_100_DIA, FF_WEEKLY_PASS"
            }
            value={form.supplierCode}
            onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
          />
          {!form.supplierCode ? (
            <p className="mt-1 text-xs text-yellow-400">
              ⚠️ Without this{" "}
              {isKhmerTopup
                ? "Package ID"
                : isFrozenYuki
                ? "Package Code"
                : "Product Code"}
              , top-up will NOT be sent automatically after payment.
            </p>
          ) : (
            <p className="mt-1 text-xs text-fox-muted">
              {isKhmerTopup
                ? "This numeric package_id will be sent to the Khmer TopUp API upon order completion."
                : isFrozenYuki
                ? "This package code will be sent to FrozenYuki / SoraTopup API upon order completion."
                : "This product_code will be sent to the Bay2Game API upon order completion."}
            </p>
          )}
        </div>

        <div className="md:col-span-3">
          <label className="label">Package Image (optional)</label>
          <div className="flex items-center gap-4 mt-1">
            {form.imageUrl && (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="preview"
                  className="h-20 w-20 rounded-xl object-contain border border-fox-border bg-fox-surface" />
                <button type="button"
                  onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600">
                  ✕
                </button>
              </div>
            )}
            <label className="cursor-pointer flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-fox-border hover:border-fox-primary bg-fox-surface px-6 py-4 text-sm text-fox-muted hover:text-fox-primary transition-colors">
              {uploadingImage ? (
                <span className="animate-pulse">Uploading...</span>
              ) : (
                <>
                  <span className="text-2xl">🖼️</span>
                  <span>{form.imageUrl ? "Change image" : "Upload image"}</span>
                  <span className="text-xs opacity-60">PNG, JPG, WEBP — max 5MB</span>
                </>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp"
                className="hidden" disabled={uploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImage(true);
                  setError(null);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Upload failed");
                    setForm((f: any) => ({ ...f, imageUrl: data.url }));
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setUploadingImage(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300 mb-4">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : initial ? "Save" : "Create"}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}