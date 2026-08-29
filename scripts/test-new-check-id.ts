import { POST as checkIdHandler } from "../app/api/games/check-id/route";
import { POST as lookupUidHandler } from "../app/api/lookup-uid/route";
import { NextRequest } from "next/server";

function createMockRequest(url: string, body: any, ip: string = "127.0.0.1"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("🚀 TESTING BAY2GAME ID CHECKER & LOOKUP ENDPOINTS");
  console.log("==================================================\n");

  // TEST 1: Mobile Legends with UID + Server ID
  console.log("TEST 1: Mobile Legends (MLBB) with Valid UID + Server ID");
  const req1 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "mobile-legends",
    uid: "262856740",
    serverId: "3543",
  }, "1.1.1.1");
  const res1 = await checkIdHandler(req1);
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Body:`, data1);
  if (res1.status === 200 && data1.success && data1.name === "Eveline") {
    console.log("✅ TEST 1 PASSED\n");
  } else {
    console.error("❌ TEST 1 FAILED\n");
  }

  // TEST 2: Free Fire (No Server ID needed)
  console.log("TEST 2: Free Fire with Valid UID");
  const req2 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "free-fire",
    uid: "12345678",
  }, "1.1.1.2");
  const res2 = await checkIdHandler(req2);
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Body:`, data2);
  if (res2.status === 200 && data2.success && data2.name) {
    console.log("✅ TEST 2 PASSED\n");
  } else {
    console.error("❌ TEST 2 FAILED\n");
  }

  // TEST 3: PUBG Mobile
  console.log("TEST 3: PUBG Mobile with Valid UID");
  const req3 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "pubg-mobile",
    uid: "518363271",
  }, "1.1.1.3");
  const res3 = await checkIdHandler(req3);
  const data3 = await res3.json();
  console.log(`Status: ${res3.status}, Body:`, data3);
  if (res3.status === 200 && data3.success && data3.name) {
    console.log("✅ TEST 3 PASSED\n");
  } else {
    console.error("❌ TEST 3 FAILED\n");
  }

  // TEST 4: Missing Server ID on MLBB
  console.log("TEST 4: MLBB with Missing Server ID");
  const req4 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "mobile-legends",
    uid: "262856740",
  }, "1.1.1.4");
  const res4 = await checkIdHandler(req4);
  const data4 = await res4.json();
  console.log(`Status: ${res4.status}, Body:`, data4);
  if (res4.status === 400 && !data4.success && data4.error === "Server ID is required") {
    console.log("✅ TEST 4 PASSED\n");
  } else {
    console.error("❌ TEST 4 FAILED\n");
  }

  // TEST 5: Invalid UID
  console.log("TEST 5: Invalid User ID");
  const req5 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "mobile-legends",
    uid: "999999999999",
    serverId: "9999",
  }, "1.1.1.5");
  const res5 = await checkIdHandler(req5);
  const data5 = await res5.json();
  console.log(`Status: ${res5.status}, Body:`, data5);
  if (res5.status === 404 && !data5.success && data5.error === "Player not found — check your ID") {
    console.log("✅ TEST 5 PASSED\n");
  } else {
    console.error("❌ TEST 5 FAILED\n");
  }

  // TEST 6: Unsupported Game
  console.log("TEST 6: Unsupported Game");
  const req6 = createMockRequest("http://localhost:3000/api/games/check-id", {
    slug: "non-existent-game-xyz",
    uid: "12345678",
  }, "1.1.1.6");
  const res6 = await checkIdHandler(req6);
  const data6 = await res6.json();
  console.log(`Status: ${res6.status}, Body:`, data6);
  if (res6.status === 400 && !data6.success && data6.error === "Unsupported game") {
    console.log("✅ TEST 6 PASSED\n");
  } else {
    console.error("❌ TEST 6 FAILED\n");
  }

  // TEST 7: Rate Limiting
  console.log("TEST 7: Rate Limiting on check-id (Max 5 per minute per IP)");
  const testIp = "9.9.9.9";
  let rateLimited = false;
  for (let i = 1; i <= 6; i++) {
    const req = createMockRequest("http://localhost:3000/api/games/check-id", {
      slug: "free-fire",
      uid: "12345678",
    }, testIp);
    const res = await checkIdHandler(req);
    console.log(`  Request #${i} -> status: ${res.status}`);
    if (res.status === 429) {
      rateLimited = true;
      const rlData = await res.json();
      console.log("  Rate limit response:", rlData);
    }
  }
  if (rateLimited) {
    console.log("✅ TEST 7 PASSED (Rate limit triggered at 6th request)\n");
  } else {
    console.error("❌ TEST 7 FAILED\n");
  }

  // TEST 8: /api/lookup-uid Endpoint
  console.log("TEST 8: /api/lookup-uid (used by frontend TopUpForm)");
  const req8 = createMockRequest("http://localhost:3000/api/lookup-uid", {
    gameSlug: "mobile-legends",
    uid: "262856740",
    server: "3543",
  }, "2.2.2.2");
  const res8 = await lookupUidHandler(req8);
  const data8 = await res8.json();
  console.log(`Status: ${res8.status}, Body:`, data8);
  if (res8.status === 200 && data8.verified && data8.nickname === "Eveline") {
    console.log("✅ TEST 8 PASSED\n");
  } else {
    console.error("❌ TEST 8 FAILED\n");
  }

  console.log("==================================================");
  console.log("🎉 ALL TESTS EXECUTED!");
  console.log("==================================================");
}

runTests().catch(console.error);

