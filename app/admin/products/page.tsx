"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const CATEGORY_PRESETS = [
  "Diamonds",
  "Weekly Lite",
  "Weekly Membership",
  "3 in 1",
  "Pass",
  "UC",
  "WOW Coins",
  "Level Up",
  "Special Offer",
  "Tokens",
  "Coins",
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

  const currentGame = games.find((g) => g.id === selectedGame) || (games.length === 1 ? games[0] : null);

  const currentGameCategories: string[] = Array.from(
    new Set<string>(
      products
        .filter((p) => !currentGame || p.gameId === currentGame.id)
        .map((p) => String(p.category || "Diamonds").trim())
        .filter(Boolean)
    )
  );

  let gameSavedOrder: string[] = [];
  try {
    if (currentGame?.categoryOrder) {
      gameSavedOrder = JSON.parse(currentGame.categoryOrder);
    }
  } catch {}

  const currentOrderedSlots: string[] = Array.from(
    new Set<string>([...gameSavedOrder, ...currentGameCategories])
  ).filter((s) => currentGameCategories.includes(s) || gameSavedOrder.includes(s));

  async function moveSlot(fromIndex: number, direction: "left" | "right") {
    if (!currentGame) return;
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= currentOrderedSlots.length) return;

    const updated = [...currentOrderedSlots];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    await fetch(`/api/admin/games/${currentGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryOrder: JSON.stringify(updated) }),
    });
    await loadAll();
  }

  async function setAsSlot1(slotName: string) {
    if (!currentGame) return;
    const updated = [slotName, ...currentOrderedSlots.filter((s) => s !== slotName)];
    await fetch(`/api/admin/games/${currentGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryOrder: JSON.stringify(updated) }),
    });
    await loadAll();
  }

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

      {/* Category Slot Order Bar */}
      {currentGame && currentOrderedSlots.length > 0 && (
        <div className="card p-4 mb-6 border border-pink-500/30 bg-gradient-to-r from-fox-card via-fox-surface/80 to-fox-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-sm text-pink-300 flex items-center gap-2">
                <span>📦</span>
                <span>Category Slot Order (លំដាប់ Slot កញ្ចប់សម្រាប់ {currentGame.name})</span>
              </h3>
              <p className="text-xs text-fox-muted mt-0.5">
                ចុច ◀ ▶ ដើម្បីផ្លាស់ប្តូរលំដាប់ Slot ឬចុចលើឈ្មោះ Slot ដើម្បីកំណត់ជា <strong className="text-pink-300">Slot 1 (លើគេបង្អស់)</strong>។
              </p>
            </div>
            <span className="text-xs text-fox-muted font-mono px-2 py-0.5 rounded bg-fox-surface border border-fox-border">
              {currentOrderedSlots.length} Slots
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentOrderedSlots.map((slotName, idx) => {
              const isFirst = idx === 0;
              return (
                <div
                  key={slotName}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                    isFirst
                      ? "bg-pink-500/20 border-pink-500 text-pink-200 font-bold ring-2 ring-pink-500/30 shadow-md shadow-pink-500/10"
                      : "bg-fox-surface border-fox-border text-fox-muted hover:border-pink-400/50"
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                      isFirst ? "bg-pink-500 text-white" : "bg-fox-border text-fox-muted"
                    }`}
                  >
                    Slot {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAsSlot1(slotName)}
                    className={`font-semibold hover:underline text-left ${isFirst ? "text-white" : "text-fox-text"}`}
                    title={isFirst ? "Active Slot 1" : "Click to set as Slot 1 (លើគេ)"}
                  >
                    {slotName}
                  </button>
                  <div className="flex items-center gap-0.5 ml-1 border-l border-fox-border/60 pl-1.5">
                    <button
                      type="button"
                      onClick={() => moveSlot(idx, "left")}
                      disabled={idx === 0}
                      className="p-0.5 text-fox-muted hover:text-pink-400 disabled:opacity-20 disabled:hover:text-fox-muted transition-colors text-xs"
                      title="Move Slot ◀ (ឡើងលើ)"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlot(idx, "right")}
                      disabled={idx === currentOrderedSlots.length - 1}
                      className="p-0.5 text-fox-muted hover:text-pink-400 disabled:opacity-20 disabled:hover:text-fox-muted transition-colors text-xs"
                      title="Move Slot ▶ (ចុះក្រោម)"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <ProductForm
          games={games}
          products={products}
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

function ProductForm({ games, products = [], defaultGameId, initial, onCancel, onSaved }: any) {
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

  // Custom slots state
  const [customSlots, setCustomSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState("");
  const [showAddSlot, setShowAddSlot] = useState(false);

  // Load custom slots from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dytopup_custom_category_slots");
      if (saved) setCustomSlots(JSON.parse(saved));
    } catch {}
  }, []);

  function addCustomSlot(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!customSlots.includes(trimmed) && !CATEGORY_PRESETS.includes(trimmed)) {
      const updated = [...customSlots, trimmed];
      setCustomSlots(updated);
      try {
        localStorage.setItem("dytopup_custom_category_slots", JSON.stringify(updated));
      } catch {}
    }
    setForm((prev: any) => ({ ...prev, category: trimmed }));
    setNewSlotInput("");
    setShowAddSlot(false);
  }

  function removeCustomSlot(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = customSlots.filter((s) => s !== name);
    setCustomSlots(updated);
    try {
      localStorage.setItem("dytopup_custom_category_slots", JSON.stringify(updated));
    } catch {}
  }

  // Combine default presets + game-specific categories + user custom slots
  const gameCategories: string[] = Array.from(
    new Set<string>(
      products
        .filter((p: any) => !form.gameId || p.gameId === form.gameId)
        .map((p: any) => String(p.category || "Diamonds").trim())
        .filter(Boolean)
    )
  );

  const allSlots: string[] = Array.from(
    new Set<string>([...CATEGORY_PRESETS, ...gameCategories, ...customSlots])
  );

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

        {/* Category / Package Type Slots */}
        <div className="md:col-span-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Package Type / Category Slots (ប្រភេទកញ្ចប់)</label>
            <button
              type="button"
              onClick={() => setShowAddSlot(!showAddSlot)}
              className="text-xs text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 transition-colors"
            >
              {showAddSlot ? "✕ Cancel" : "+ Add New Slot (បង្កើត Slot ថ្មី)"}
            </button>
          </div>

          {/* Slots List */}
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            {allSlots.map((cat) => {
              const isSelected = form.category === cat;
              const isCustom = customSlots.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat })}
                  className={`group relative px-3 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-pink-500 text-white font-bold border-pink-500 shadow-md shadow-pink-500/30 ring-2 ring-pink-400/30"
                      : "bg-fox-surface text-fox-muted border-fox-border hover:border-pink-400 hover:text-white"
                  }`}
                >
                  <span>{cat}</span>
                  {isCustom && (
                    <span
                      onClick={(e) => removeCustomSlot(cat, e)}
                      className="text-[10px] opacity-60 hover:opacity-100 hover:text-red-300 ml-0.5"
                      title="Remove custom slot"
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}

            {!showAddSlot && (
              <button
                type="button"
                onClick={() => setShowAddSlot(true)}
                className="px-3 py-1 text-xs rounded-full border border-dashed border-pink-400/60 text-pink-400 hover:bg-pink-500/10 transition-colors"
              >
                + Add Slot
              </button>
            )}
          </div>

          {/* Add Slot inline input */}
          {showAddSlot && (
            <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-fox-surface border border-pink-500/30">
              <input
                type="text"
                placeholder="Enter new slot name (e.g. Level Up, Tokens, Special Offer)..."
                value={newSlotInput}
                onChange={(e) => setNewSlotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSlot(newSlotInput);
                  }
                }}
                className="input text-xs py-1.5 flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={() => addCustomSlot(newSlotInput)}
                className="btn-primary text-xs py-1.5 px-3.5 whitespace-nowrap"
              >
                Save Slot
              </button>
              <button
                type="button"
                onClick={() => { setShowAddSlot(false); setNewSlotInput(""); }}
                className="btn-ghost text-xs py-1.5 px-2 text-fox-muted hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Active Category Input with clear button */}
          <div className="relative">
            <input
              className="input pr-8"
              placeholder="Select from slots above or type package type here..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            />
            {form.category && (
              <button
                type="button"
                onClick={() => setForm({ ...form, category: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fox-muted hover:text-white text-xs p-1"
                title="Clear input"
              >
                ✕
              </button>
            )}
          </div>
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