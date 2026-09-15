// i18n coverage check: every t("key") used in src must exist in
// src/shared/i18n.ts with non-empty en + zh strings, and every
// {placeholder} in en must also appear in zh.
//
// Usage: npm run i18n:check
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const i18nPath = join(srcDir, "shared", "i18n.ts");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const i18n = readFileSync(i18nPath, "utf8");

// Parse `"key": { en: "...", zh: "..." }` blocks (en/zh may be multiline).
const dict = new Map();
const keyPattern = /"([^"]+)":\s*\{\s*en:\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
let match;
while ((match = keyPattern.exec(i18n)) !== null) {
  const key = match[1];
  const blockStart = match.index;
  // Grab enough of the block to include the zh string (up to 1200 chars).
  const block = i18n.slice(blockStart, blockStart + 1200);
  const zhMatch = block.match(/zh:\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/);
  dict.set(key, { enRaw: match[2], zhRaw: zhMatch ? zhMatch[1] : null });
}

const used = new Map(); // key -> files[]
for (const file of walk(srcDir)) {
  const content = readFileSync(file, "utf8");
  const usePattern = /\bt\(\s*"([^"]+)"/g;
  let use;
  while ((use = usePattern.exec(content)) !== null) {
    const key = use[1];
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(file.replace(root, "").replace(/\\/g, "/"));
  }
}

let failed = false;
for (const [key, files] of [...used.entries()].sort()) {
  const entry = dict.get(key);
  if (!entry) {
    console.error(`MISSING key "${key}" used in: ${files.join(", ")}`);
    failed = true;
    continue;
  }
  if (!entry.zhRaw || entry.zhRaw.replace(/["`]/g, "").trim().length === 0) {
    console.error(`NO zh string for "${key}"`);
    failed = true;
  }
  const enVars = new Set([...entry.enRaw.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const zhVars = new Set([...(entry.zhRaw || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const same =
    enVars.size === zhVars.size && [...enVars].every((v) => zhVars.has(v));
  if (!same) {
    console.error(
      `PLACEHOLDER mismatch for "${key}": en {${[...enVars].join(",")}} vs zh {${[...zhVars].join(",")}}`
    );
    failed = true;
  }
}

if (failed) {
  console.error(`\ni18n coverage FAILED (${used.size} keys used).`);
  process.exit(1);
}
console.log(`i18n coverage clean: ${used.size} keys used, ${dict.size} defined, all en+zh present.`);
