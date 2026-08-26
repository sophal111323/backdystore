import Link from "next/link";
import { getCambodiaDayRange, getDailyDashboardStats } from "@/lib/dailyStats";

export const dynamic = "force-dynamic";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function number(value: number) {
  return value.toLocaleString("en-US");
}

function dateTime(value: Date | string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" });
}

function packageName(product: { name: string; amount: number; bonus: number }) {
  return product.bonus > 0
    ? `${product.name} (${product.amount}+${product.bonus})`
    : product.name;
}

const cardClass = "rounded-2xl border border-fox-border bg-fox-card p-5 shadow-sm";

export default async function AdminDashboardPage() {
  const range = getCambodiaDayRange();
  const stats = await getDailyDashboardStats(range);
  const cf = stats.cloudflareSecurity;

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-fox-muted">
            Daily counters reset by Cambodia day. Today: {stats.range.label}
          </p>
        </div>

        <Link href="/admin/security" className="btn-ghost w-fit text-sm">
          🛡️ Open Security Requests
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={cardClass}>
          <div className="text-sm text-fox-muted">Origin Requests / 1d</div>
          <div className="mt-3 text-4xl font-black text-fox-primary">{number(stats.totalRequests)}</div>
          <div className="mt-2 text-xs text-fox-muted">Reached your Next.js app. Unique IPs: {number(stats.uniqueIps)}</div>
        </div>

        <div className={cardClass}>
          <div className="text-sm text-fox-muted">Cloudflare Protected / 1d</div>
          <div className="mt-3 text-4xl font-black text-red-500">{number(cf.protectedEvents)}</div>
          <div className="mt-2 text-xs text-fox-muted">
            {cf.enabled ? "Blocked/challenged security events" : "Set Cloudflare API env to enable"}
          </div>
        </div>

        <div className={cardClass}>
          <div className="text-sm text-fox-muted">Create Order Requests</div>
          <div className="mt-3 text-4xl font-black">{number(stats.orderApiRequests)}</div>
          <div className="mt-2 text-xs text-fox-muted">POST /api/orders today</div>
        </div>

        <div className={cardClass}>
          <div className="text-sm text-fox-muted">KHQR Generated</div>
          <div className="mt-3 text-4xl font-black">{number(stats.khqrGenerated)}</div>
          <div className="mt-2 text-xs text-fox-muted">Orders with paymentRef / QR / payment URL</div>
        </div>

        <div className={cardClass}>
          <div className="text-sm text-fox-muted">Paid Ready</div>
          <div className="mt-3 text-4xl font-black text-green-500">{number(stats.paidReadyCount)}</div>
          <div className="mt-2 text-xs text-fox-muted">Revenue: {money(stats.paidRevenueUsd)}</div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">🛡️ Cloudflare Bot / DDoS Protection Today</h2>
            <p className="text-sm text-fox-muted">
              These are Cloudflare Security Events for blocked/challenged traffic before it reaches your app.
            </p>
          </div>
          {!cf.enabled ? (
            <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-600">
              Not configured
            </span>
          ) : (
            <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600">
              Connected
            </span>
          )}
        </div>

        {!cf.enabled ? (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700">
            Cloudflare stats are hidden because {cf.error || "the Cloudflare API token/zone ID is missing"}. Add
            <code className="mx-1 rounded bg-white/60 px-1">CLOUDFLARE_API_TOKEN</code>
            and
            <code className="mx-1 rounded bg-white/60 px-1">CLOUDFLARE_ZONE_ID</code>
            in your hosting environment.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <div className="text-xs text-fox-muted">Security Events</div>
                <div className="mt-2 text-2xl font-black">{number(cf.totalSecurityEvents)}</div>
              </div>
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <div className="text-xs text-fox-muted">Blocked</div>
                <div className="mt-2 text-2xl font-black text-red-500">{number(cf.blockedEvents)}</div>
              </div>
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <div className="text-xs text-fox-muted">Challenged</div>
                <div className="mt-2 text-2xl font-black text-orange-500">{number(cf.challengeEvents)}</div>
              </div>
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <div className="text-xs text-fox-muted">Bot-related</div>
                <div className="mt-2 text-2xl font-black">{number(cf.botEvents)}</div>
              </div>
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <div className="text-xs text-fox-muted">DDoS / Rate-limit</div>
                <div className="mt-2 text-2xl font-black">{number(cf.ddosEvents)}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <h3 className="mb-3 font-bold">Top Cloudflare Actions</h3>
                {cf.topActions.length === 0 ? (
                  <p className="text-sm text-fox-muted">No Cloudflare security events today.</p>
                ) : (
                  <div className="space-y-2">
                    {cf.topActions.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-mono">{item.label}</span>
                        <span className="font-bold">{number(item.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-fox-border bg-fox-surface p-4">
                <h3 className="mb-3 font-bold">Top Cloudflare Sources</h3>
                {cf.topSources.length === 0 ? (
                  <p className="text-sm text-fox-muted">No Cloudflare security sources today.</p>
                ) : (
                  <div className="space-y-2">
                    {cf.topSources.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-mono">{item.label}</span>
                        <span className="font-bold">{number(item.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-fox-border text-left text-xs uppercase tracking-wider text-fox-muted">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fox-border">
                  {cf.latestEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-fox-muted">No latest Cloudflare events today.</td>
                    </tr>
                  ) : (
                    cf.latestEvents.map((event, index) => (
                      <tr key={`${event.datetime}-${event.ip}-${index}`} className="hover:bg-fox-surface/50">
                        <td className="p-3 text-xs text-fox-muted">{dateTime(event.datetime || null)}</td>
                        <td className="p-3 font-mono text-xs">{event.action || "unknown"}</td>
                        <td className="p-3 font-mono text-xs">{event.source || "unknown"}</td>
                        <td className="p-3 font-mono text-xs">{event.ip || "unknown"}</td>
                        <td className="p-3">{event.country || "-"}</td>
                        <td className="max-w-[320px] truncate p-3 font-mono text-xs">{event.path || "/"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">✅ Paid Ready Orders Today</h2>
            <p className="text-sm text-fox-muted">Shows IP, game, amount, player ID, and package for orders already paid.</p>
          </div>
          <Link href="/admin/orders?status=PAID" className="text-sm font-semibold text-fox-primary hover:underline">
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b border-fox-border text-left text-xs uppercase tracking-wider text-fox-muted">
              <tr>
                <th className="p-3">Paid Time</th>
                <th className="p-3">IP</th>
                <th className="p-3">Game</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Player ID</th>
                <th className="p-3">Package</th>
                <th className="p-3">Order</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {stats.paidOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-fox-muted">No paid orders today.</td>
                </tr>
              ) : (
                stats.paidOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-fox-surface/50">
                    <td className="p-3 text-xs text-fox-muted">{dateTime(order.paidAt)}</td>
                    <td className="p-3 font-mono text-xs">{order.ipAddress || "unknown"}</td>
                    <td className="p-3 font-semibold">{order.game.name}</td>
                    <td className="p-3 font-mono">{money(order.amountUsd)}</td>
                    <td className="p-3 font-mono text-xs">{order.playerUid}</td>
                    <td className="p-3 text-fox-muted">{packageName(order.product)}</td>
                    <td className="p-3">
                      <Link href={`/admin/orders/${order.orderNumber}`} className="font-mono text-fox-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-bold text-green-500">
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-bold">🧾 Orders Created + KHQR Generated Today</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b border-fox-border text-left text-xs uppercase tracking-wider text-fox-muted">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">IP</th>
                <th className="p-3">Game</th>
                <th className="p-3">Player ID</th>
                <th className="p-3">Package</th>
                <th className="p-3">Amount</th>
                <th className="p-3">KHQR</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {stats.latestOrderRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-fox-muted">No orders created today.</td>
                </tr>
              ) : (
                stats.latestOrderRequests.map((order) => (
                  <tr key={order.id} className="hover:bg-fox-surface/50">
                    <td className="p-3 text-xs text-fox-muted">{dateTime(order.createdAt)}</td>
                    <td className="p-3 font-mono text-xs">{order.ipAddress || "unknown"}</td>
                    <td className="p-3 font-semibold">{order.game.name}</td>
                    <td className="p-3 font-mono text-xs">{order.playerUid}</td>
                    <td className="p-3 text-fox-muted">{packageName(order.product)}</td>
                    <td className="p-3 font-mono">{money(order.amountUsd)}</td>
                    <td className="p-3">
                      {order.paymentRef || order.qrString || order.paymentUrl ? (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-bold text-green-500">Generated</span>
                      ) : (
                        <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-500">No QR</span>
                      )}
                    </td>
                    <td className="p-3">{order.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-bold">🌐 Top Origin IPs Today</h2>
        {stats.topIps.length === 0 ? (
          <p className="text-sm text-fox-muted">No request logs yet. Make sure INTERNAL_SECURITY_SECRET is set.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.topIps.map((item) => (
              <div key={item.ip} className="rounded-xl border border-fox-border bg-fox-surface p-3">
                <div className="font-mono text-sm">{item.ip}</div>
                <div className="text-xs text-fox-muted">{number(item.count)} request(s) that reached the app</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
