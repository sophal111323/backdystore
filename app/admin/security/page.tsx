// app/admin/security/page.tsx
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function blockIp(formData: FormData) {
  "use server";

  const ip = String(formData.get("ip") || "").trim();
  const reason = String(formData.get("reason") || "Blocked from security dashboard");

  if (!ip || ip === "unknown") return;

  await prisma.blockedIdentity.upsert({
    where: {
      type_value: {
        type: "ip",
        value: ip,
      },
    },
    update: { reason },
    create: {
      type: "ip",
      value: ip,
      reason,
    },
  });

  revalidatePath("/admin/security");
}

async function unblockIp(formData: FormData) {
  "use server";

  const ip = String(formData.get("ip") || "").trim();
  if (!ip) return;

  await prisma.blockedIdentity.deleteMany({
    where: {
      type: "ip",
      value: ip,
    },
  });

  revalidatePath("/admin/security");
}

export default async function SecurityPage() {
  const logs = await prisma.requestLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const blockedIps = await prisma.blockedIdentity.findMany({
    where: { type: "ip" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Requests</h1>
        <p className="text-sm text-gray-400">
          Check requests, IP, network provider, device, and block suspicious IPs.
        </p>
      </div>

      <section className="rounded-xl border border-fox-border bg-fox-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Blocked IPs</h2>

        {blockedIps.length === 0 ? (
          <p className="text-sm text-gray-400">No blocked IPs.</p>
        ) : (
          <div className="space-y-2">
            {blockedIps.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-fox-border p-3">
                <div>
                  <div className="font-mono font-semibold">{item.value}</div>
                  <div className="text-xs text-gray-400">{item.reason || "No reason"}</div>
                </div>

                <form action={unblockIp}>
                  <input type="hidden" name="ip" value={item.value} />
                  <button className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white">
                    Unblock
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-fox-border bg-fox-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Latest Requests</h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-fox-border text-left">
                <th className="p-3">Time</th>
                <th className="p-3">IP</th>
                <th className="p-3">Provider</th>
                <th className="p-3">ISP</th>
                <th className="p-3">Country</th>
                <th className="p-3">Device</th>
                <th className="p-3">OS</th>
                <th className="p-3">Browser</th>
                <th className="p-3">Path</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-fox-border">
                  <td className="p-3">{log.createdAt.toLocaleString()}</td>
                  <td className="p-3 font-mono">{log.ip}</td>
                  <td className="p-3">{log.provider || "Unknown"}</td>
                  <td className="p-3">{log.isp || "Unknown"}</td>
                  <td className="p-3">{log.country || "-"}</td>
                  <td className="p-3">{log.device || "-"}</td>
                  <td className="p-3">{log.os || "-"}</td>
                  <td className="p-3">{log.browser || "-"}</td>
                  <td className="p-3 font-mono">{log.path}</td>
                  <td className="p-3">
                    <form action={blockIp} className="flex gap-2">
                      <input type="hidden" name="ip" value={log.ip} />
                      <input
                        name="reason"
                        placeholder="Reason"
                        className="rounded-md border px-2 py-1 text-xs text-black"
                      />
                      <button className="rounded-md bg-red-600 px-3 py-1 text-xs text-white">
                        Block
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}