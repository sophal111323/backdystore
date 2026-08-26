// scripts/test-bay2game.ts
// Tests Bay2Game API connectivity + key validity WITHOUT printing the key.
import { readFileSync } from "node:fs";

// Minimal .env parser (no dotenv dependency).
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}


const BASE = (process.env.BAY2GAME_BASE_URL || "https://api.bay2game.xyz/api").replace(/^['"]|['"]$/g, "");
const KEY = (process.env.BAY2GAME_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");

async function call(endpoint: string): Promise<any> {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_key", KEY);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { http: res.status, data };
}

(async () => {
  console.log("Base URL:", BASE);
  console.log("API key present:", KEY ? "YES (length=" + KEY.length + ")" : "❌ NO");

  try {
    const p = await call("/profile");
    console.log("\n--- GET /profile ---");
    console.log("HTTP:", p.http);
    console.log("status:", p.data?.status);
    if (p.data?.user) {
      console.log("balance:", p.data.user.balance, "USD");
      console.log("username:", p.data.user.username);
    }
    if (p.data?.message) console.log("message:", p.data.message);
  } catch (e: any) {
    console.log("Network error:", e?.message ?? e);
  }

  try {
    const c = await call("/categories");
    console.log("\n--- GET /categories ---");
    console.log("HTTP:", c.http, "| status:", c.data?.status);
    if (Array.isArray(c.data?.categories)) {
      console.log("game count:", c.data.categories.length);
      for (const g of c.data.categories.slice(0, 10)) {
        console.log(`  ${g.game_code} → ${g.name} (fields: ${(g.game_fields || []).join(", ")})`);
      }
    } else if (c.data?.message) {
      console.log("message:", c.data.message);
    }
  } catch (e: any) {
    console.log("Network error:", e?.message ?? e);
  }
})();
