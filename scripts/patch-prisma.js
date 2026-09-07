const fs = require("fs");
const path = require("path");

const targets = [
  path.join(__dirname, "..", "node_modules", "@prisma", "client", "runtime", "binary.js"),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    let content = fs.readFileSync(target, "utf8");
    if (content.includes("process.versions.node.split")) {
      content = content.replace(
        "process.versions.node.split",
        '(process.versions?.node || "22.0.0").split'
      );
      fs.writeFileSync(target, content, "utf8");
      console.log(`[patch-prisma] Patched ${target}`);
    }
  }
}
