const fs = require("fs");
const path = require("path");

const files = [
  path.join(__dirname, "..", "node_modules", "@prisma", "client", "runtime", "library.js"),
  path.join(__dirname, "..", "node_modules", "@prisma", "client", "runtime", "binary.js"),
  path.join(__dirname, "..", "node_modules", "@prisma", "client", "runtime", "wasm.js"),
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    let changed = false;

    if (content.includes("globalThis.DEBUG.split")) {
      content = content.replaceAll(
        "globalThis.DEBUG.split",
        '(globalThis.DEBUG || "").split'
      );
      changed = true;
    }

    if (content.includes("process.versions.node.split")) {
      content = content.replaceAll(
        "process.versions.node.split",
        '(process.versions?.node || "22.0.0").split'
      );
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, content, "utf8");
      console.log(`[patch-prisma] Successfully patched ${file}`);
    }
  }
}

try {
  require("./patch-next");
} catch (e) {
  console.warn("[patch-prisma] patch-next warning:", e.message);
}

