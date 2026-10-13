#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANARY_PATTERNS = [
  "CANARY_KEY_9f3a",
  "CANARY_ADMIN_7c1d",
];

const staticDir = path.resolve(__dirname, "../.next/static");

console.log("=================================================");
console.log("ZeroWaste AI Secret Canary Scanner");
console.log(`Scanning client bundle directory: ${staticDir}`);
console.log("=================================================");

if (!fs.existsSync(staticDir)) {
  console.error("ERROR: .next/static directory does not exist. Run 'npm run build' first.");
  process.exit(1);
}

let violations = [];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".json") || entry.name.endsWith(".css") || entry.name.endsWith(".html"))) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of CANARY_PATTERNS) {
          if (content.includes(pattern)) {
            violations.push({
              file: path.relative(path.resolve(__dirname, ".."), fullPath),
              pattern: pattern,
            });
          }
        }
      } catch (err) {
        console.warn(`Could not read file ${fullPath}:`, err.message);
      }
    }
  }
}

scanDirectory(staticDir);

if (violations.length > 0) {
  console.error("\n❌ CRITICAL SECURITY VIOLATION: Canary secret detected in public client bundle!");
  for (const v of violations) {
    console.error(` - Found '${v.pattern}' in ${v.file}`);
  }
  process.exit(1);
} else {
  console.log("\n✅ SECRET CANARY SCAN PASSED: Zero canary secret values found under .next/static.");
  process.exit(0);
}
