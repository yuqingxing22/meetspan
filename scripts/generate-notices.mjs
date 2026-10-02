// Writes public/third-party-notices.txt from the packages that end up in the production
// build, plus the non-code assets. Run with: node scripts/generate-notices.mjs
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dirs = execSync("npm ls --omit=dev --all --parseable", { maxBuffer: 1e8 })
  .toString()
  .split("\n")
  .filter(Boolean);

const pkgs = new Map();
for (const dir of dirs) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  if (pkg.name === "meetspan" || pkgs.has(pkg.name)) continue;
  const license =
    typeof pkg.license === "string" ? pkg.license : pkg.license?.type ?? pkg.licenses?.map((l) => l.type).join(" OR ") ?? "UNKNOWN";
  const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.|$)/i.test(f));
  const text = file ? readFileSync(join(dir, file), "utf8").trim() : "";
  const copyright = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^copyright\b/i.test(l))
    .slice(0, 3);
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? "";
  pkgs.set(pkg.name, { name: pkg.name, version: pkg.version, license, copyright, repo: repo.replace(/^git\+/, ""), text });
}

const list = [...pkgs.values()].sort((a, b) => a.name.localeCompare(b.name));
const byLicense = new Map();
for (const p of list) {
  if (!byLicense.has(p.license)) byLicense.set(p.license, []);
  byLicense.get(p.license).push(p);
}

const out = [];
out.push("MeetSpan: third-party notices", "meetspan.app", "");
out.push(
  "MeetSpan is built with the open-source software, fonts, illustrations and data listed below.",
  "Their licenses allow commercial use. This file reproduces their notices.",
  ""
);

out.push("=".repeat(70), "FONTS", "=".repeat(70), "");
out.push("Geist and Geist Mono. SIL Open Font License, Version 1.1.");
out.push("", readFileSync("src/assets/fonts/OFL.txt", "utf8").trim(), "");

out.push("=".repeat(70), "ILLUSTRATIONS", "=".repeat(70), "");
out.push(
  "Four illustrations come from unDraw (https://undraw.co), by Katerina Limpitsouni,",
  "used under the unDraw license, which allows free use, including commercial use,",
  "without attribution.",
  ""
);

out.push("=".repeat(70), "DATA", "=".repeat(70), "");
out.push(
  "Chinese timezone city names come from the Unicode Common Locale Data Repository",
  "(CLDR, https://cldr.unicode.org), used under the Unicode License v3.",
  "",
  readFileSync("src/lib/tzZh.LICENSE.txt", "utf8").trim(),
  ""
);

out.push("=".repeat(70), "SOFTWARE PACKAGES", "=".repeat(70), "");
out.push(`${list.length} packages are included in the production build.`, "");
for (const [license, items] of [...byLicense].sort((a, b) => b[1].length - a[1].length)) {
  out.push("-".repeat(70), `${license} (${items.length} packages)`, "-".repeat(70), "");
  for (const p of items) {
    out.push(`${p.name} ${p.version}${p.repo ? `  ${p.repo}` : ""}`);
    for (const c of p.copyright) out.push(`  ${c}`);
  }
  out.push("");
}

out.push("=".repeat(70), "LICENSE TEXTS", "=".repeat(70), "");
for (const [license, items] of [...byLicense].sort((a, b) => b[1].length - a[1].length)) {
  const rep = items.find((p) => p.text);
  if (!rep) continue;
  out.push("-".repeat(70), `${license}: text as shipped with ${rep.name}`, "-".repeat(70), "", rep.text, "");
}

writeFileSync("public/third-party-notices.txt", out.join("\n"));
console.log(`Wrote public/third-party-notices.txt (${list.length} packages, ${byLicense.size} license types)`);
