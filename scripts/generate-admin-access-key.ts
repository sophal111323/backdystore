/**
 * Generates a new admin access key and its bcrypt hash.
 *
 *   npx tsx scripts/generate-admin-access-key.ts
 *
 * Prints the plaintext key once — it is not recoverable from the hash. Put the
 * printed ADMIN_ACCESS_KEY_HASH line in .env and restart the app.
 */

import { generateAccessKey, hashAccessKey, ACCESS_KEY_LENGTH } from "../lib/accessKey";

async function main() {
  const key = generateAccessKey();
  const hash = await hashAccessKey(key);

  console.log("\n=== ADMIN ACCESS KEY (shown once — save it now) ===\n");
  console.log(key);
  console.log(`\n(${key.length} chars, expected ${ACCESS_KEY_LENGTH})`);
  console.log("\n=== Add to .env on the server ===\n");
  console.log(`ADMIN_ACCESS_KEY_HASH=${hash}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
