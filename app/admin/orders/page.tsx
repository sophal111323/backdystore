"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUSES = ["ALL", "PENDING", "PAID", "PROCESSING", "DELIVERED", "FAILED", "REFUNDED", "CANCELLED"];

const PILL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  PAID: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  PROCESSING: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  DELIVERED: "bg-green-400/10 text-green-400 border-green-400/30",
  FAILED: "bg-red-400/10 text-red-400 border-red-400/30",
  REFUNDED: "bg-fox-muted/10 text-fox-muted border-fox-border",
  CANCELLED: "bg-fox-muted/10 text-fox-muted border-fox-border",
};

interface ApiResultData {
  total: number;
  stats?: {
    total: number;
    paidAndFulfilled: number;
    fulfilled: number;
    refreshed: number;
    stillPending: number;
    failed: number;
    unchanged: number;
  };
  results?: Array<{
    orderNumber: string;
    action: string;
    status: string;
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Call API states
  const [callingApiAll, setCallingApiAll] = useState(false);
  const [callingOrder, setCallingOrder] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultData | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ status, page: String(page) });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);

    // Always fetch count of orders that need fulfillment (PAID)
    try {
      const countRes = await fetch(`/api/admin/orders?status=PAID&page=1`);
      const countData = await countRes.json();
      setPendingCount(countData.total ?? countData.orders?.length ?? 0);
    } catch {
      /* ignore */
    }
  }

  async function callApiOnAll(customStatus?: string) {
    const targetStatus = customStatus || status;
    const desc =
      targetStatus === "ALL"
        ? "all actionable orders (sync PENDING payments & fulfill PAID/PROCESSING orders)"
        : `all ${targetStatus} orders`;

    const confirmed = window.confirm(
      `⚡ Call API on ${desc}?\n\nThis will trigger live payment verification with Tola Saint gateway and top-up fulfillment via Bay2Game / supplier APIs.`
    );
    if (!confirmed) return;

    setCallingApiAll(true);
    setApiResult(null);

    try {
      const res = await fetch("/api/admin/orders/call-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          all: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to trigger API on orders.");
        return;
      }

      setApiResult(data);
      await load();
    } catch (err: any) {
      alert("Error calling API: " + (err?.message || String(err)));
    } finally {
      setCallingApiAll(false);
    }
  }

  async function callApiSingle(orderNumber: string) {
    setCallingOrder(orderNumber);
    try {
      const res = await fetch("/api/admin/orders/call-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to call API on order.");
        return;
      }

      const outcome = data.result;
      const statusMsg = outcome.message || outcome.error || outcome.status || "API call finished";
      alert(`[Order #${orderNumber}]\nResult: ${statusMsg}`);
      await load();
    } catch (err: any) {
      alert("Error: " + (err?.message || String(err)));
    } finally {
      setCallingOrder(null);
    }
  }

  async function clearAllOrders() {
    const scope = status === "ALL" ? "ALL orders (every status)" : `all ${status} orders`;
    const typed = window.prompt(
      `This will PERMANENTLY DELETE ${scope} from the database.\n\nType DELETE to confirm.`
    );
    if (typed !== "DELETE") return;

    const res = await fetch("/api/admin/orders/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE", status }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to delete orders.");
      return;
    }
    alert(`Deleted ${data.deleted} order(s).`);
    setPage(1);
    load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  return (
    <div className="p-8">
      {/* Header with Call API Button */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <p className="text-fox-muted mt-1">All customer orders and fulfillment management.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main "Call API on all orders" button */}
          <button
            onClick={() => callApiOnAll()}
            disabled={callingApiAll}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-fox-primary px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-fox-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            title="Call API to sync payments and fulfill top-ups for all orders"
          >
            {callingApiAll ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Calling API on Orders...</span>
              </>
            ) : (
              <>
                <span className="text-sm">⚡</span>
                <span>Call API on All Orders</span>
              </>
            )}
          </button>

          <a
            href={`/api/admin/orders/export?${new URLSearchParams({ ...(status !== "ALL" && { status }), ...(q && { q }) }).toString()}`}
            className="btn-ghost text-xs"
          >
            ⬇ Export CSV
          </a>
        </div>
      </div>

      {/* Result feedback notification after running Call API */}
      {apiResult && (
        <div className="mb-6 rounded-2xl border border-fox-primary/40 bg-fox-surface p-5 shadow-xl transition-all">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h3 className="font-display text-base font-bold text-fox-text">
                  API Execution Finished
                </h3>
              </div>
              <p className="text-xs text-fox-muted mt-1">
                Processed {apiResult.total} order{apiResult.total === 1 ? "" : "s"}.
              </p>
            </div>
            <button
              onClick={() => setApiResult(null)}
              className="text-fox-muted hover:text-fox-text text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          {apiResult.stats && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                <div className="text-green-400 font-bold text-lg">{apiResult.stats.fulfilled}</div>
                <div className="text-fox-muted">Top-ups Delivered</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                <div className="text-blue-400 font-bold text-lg">{apiResult.stats.paidAndFulfilled}</div>
                <div className="text-fox-muted">Paid & Triggered</div>
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                <div className="text-yellow-400 font-bold text-lg">{apiResult.stats.stillPending}</div>
                <div className="text-fox-muted">Awaiting Payment</div>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <div className="text-red-400 font-bold text-lg">{apiResult.stats.failed}</div>
                <div className="text-fox-muted">Errors / Failed</div>
              </div>
            </div>
          )}

          {apiResult.results && apiResult.results.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-black/40 p-3 text-[11px] font-mono divide-y divide-white/5">
              {apiResult.results.map((r, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-fox-primary font-bold">{r.orderNumber}</span>
                  <span className={r.success ? "text-green-400" : "text-yellow-400"}>
                    {r.message || r.error || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending orders alert banner */}
      {pendingCount > 0 && status !== "PAID" && (
        <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-fox-primary/50 bg-fox-primary/10 px-5 py-4 transition-colors">
          <div
            onClick={() => { setStatus("PAID"); setPage(1); }}
            className="flex items-center gap-3 cursor-pointer flex-1"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fox-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-fox-primary" />
            </span>
            <div>
              <div className="font-display text-base font-bold text-fox-text">
                {pendingCount} order{pendingCount === 1 ? "" : "s"} waiting for fulfillment
              </div>
              <div className="text-xs text-fox-muted">Customer paid. Ready to trigger top-up supplier API.</div>
            </div>
          </div>
          <button
            onClick={() => callApiOnAll("PAID")}
            disabled={callingApiAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-fox-primary px-4 py-2 text-xs font-bold text-black shadow hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            ⚡ Fulfill All {pendingCount} Orders Now
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
                status === s ? "bg-fox-primary text-black" : "bg-fox-surface text-fox-muted hover:text-fox-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 flex-1 min-w-[300px]"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order #, UID, or email"
            className="input text-sm flex-1"
          />
          <button type="submit" className="btn-ghost text-sm px-4 py-2">Search</button>
        </form>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Order #</th>
                <th className="text-left px-5 py-3">Game</th>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">UID</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Payment</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-fox-muted">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="text-fox-muted mb-1">No orders match these filters</p>
                    <p className="text-xs text-fox-muted/60">Try adjusting the status filter or check back later.</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className={`hover:bg-fox-surface/50 ${o.status === "PAID" ? "bg-fox-primary/5" : ""}`}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${o.orderNumber}`}
                        className="font-mono text-fox-primary hover:underline font-semibold"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{o.game.name}</td>
                    <td className="px-5 py-3 text-fox-muted">{o.product.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-fox-accent">{o.playerUid}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold">${o.amountUsd.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs text-fox-muted">{o.paymentMethod.replace("_", " ")}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PILL_COLORS[o.status] || "border-fox-border text-fox-muted"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-fox-muted text-xs whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => callApiSingle(o.orderNumber)}
                        disabled={callingOrder === o.orderNumber || callingApiAll}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          o.status === "PAID"
                            ? "bg-fox-primary/20 text-fox-primary border-fox-primary/50 hover:bg-fox-primary/30 animate-pulse"
                            : o.status === "PENDING"
                            ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/25"
                            : o.status === "PROCESSING"
                            ? "bg-blue-400/15 text-blue-300 border-blue-400/40 hover:bg-blue-400/25"
                            : o.status === "FAILED"
                            ? "bg-red-400/15 text-red-300 border-red-400/40 hover:bg-red-400/25"
                            : "bg-fox-surface text-fox-muted border-fox-border hover:text-fox-text"
                        }`}
                        title={`Trigger API for order ${o.orderNumber}`}
                      >
                        {callingOrder === o.orderNumber ? (
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <span>⚡</span>
                        )}
                        <span>
                          {o.status === "PAID"
                            ? "Fulfill"
                            : o.status === "PENDING"
                            ? "Sync API"
                            : o.status === "PROCESSING"
                            ? "Check API"
                            : o.status === "FAILED"
                            ? "Retry API"
                            : "Call API"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-fox-border flex justify-between items-center text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost disabled:opacity-40 text-xs py-1 px-3"
            >
              ← Prev
            </button>
            <span className="text-fox-muted">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost disabled:opacity-40 text-xs py-1 px-3"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-10 card border-red-500/40 bg-red-500/5 p-5">
        <h2 className="font-display text-lg font-bold text-red-400 mb-1">Danger zone</h2>
        <p className="text-xs text-fox-muted mb-4">
          Permanently delete orders from the database. This action is irreversible and is recorded in the audit log.
          The current filter ({status === "ALL" ? "ALL statuses" : status}) will be used.
        </p>
        <button
          onClick={clearAllOrders}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Delete {status === "ALL" ? "all orders" : `all ${status} orders`}
        </button>
      </div>
    </div>
  );
}
