// Fails if a canary secret appears in the built CLIENT bundle (.next/static).
// Server chunks (.next/server) legitimately contain server-only env values.
// Usage:
//   ZEROWASTE_API_KEY=<canary> npm run build
//   node scripts/scan-bundle.mjs <canary>   (or: npm run scan:secrets -- <canary>)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [canary] = process.argv.slice(2);
if (!canary) {
  console.error("usage: node scripts/scan-bundle.mjs <canary-secret>");
  process.exit(2);
}
const hits = [];
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`missing build output: ${dir} (run a production build first)`);
    process.exit(2);
  }
  for (const f of entries) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(js|css|map)$/.test(f) && readFileSync(p, "utf8").includes(canary)) {
      hits.push(p);
    }
  }
}
walk(".next/static");
if (hits.length > 0) {
  console.error(`SECRET LEAK: canary found in client bundle:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("scan clean: canary absent from .next/static client bundle");
