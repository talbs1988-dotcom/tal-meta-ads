#!/usr/bin/env node
/**
 * יצירת קריאייטיבים למודעות — OpenAI Images API
 *
 * שימוש:
 *   node generate-images.mjs <prompts.json> <output-dir>
 *
 * prompts.json — מערך: [{ "id": "v1-hero", "prompt": "..." }, ...]
 * כל תמונה נשמרת כ-<id>.png בתיקיית הפלט.
 *
 * המפתח נקרא מ-OPENAI_API_KEY בסביבה, או מקובץ .env בתיקייה הנוכחית.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

// ── הגדרות ──────────────────────────────────────────────
const QUALITY = "low"; // ~0.006$ לתמונה. ההבדל מ-high לא נראה בפיד.
const MODEL = "gpt-image-2";
const SIZE = process.env.AD_SIZE || "1024x1024"; // ריבוע = פורמט פיד סטנדרטי
// ────────────────────────────────────────────────────────

function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();

  const envPath = resolve(".env");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith("OPENAI_API_KEY="));
    const key = line ? line.slice("OPENAI_API_KEY=".length).trim() : "";
    if (key) return key;
  }

  console.error("❌ לא נמצא מפתח.");
  console.error("   הוסיפו OPENAI_API_KEY לקובץ .env בתיקייה הנוכחית,");
  console.error("   או הגדירו אותו כמשתנה סביבה.");
  process.exit(1);
}

function checkPrompt(item) {
  const p = (item.prompt || "").toLowerCase();
  if (!p.includes("no text") && !p.includes("no letters")) {
    console.warn(
      `   ⚠️  "${item.id}" — חסר "no text" בפרומפט. עברית תצא שבורה.`,
    );
  }
}

async function generateOne(apiKey, item, outDir) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: item.prompt,
      size: SIZE,
      quality: QUALITY,
      n: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} — ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("התשובה חזרה בלי תמונה");

  const outPath = join(outDir, `${item.id}.png`);
  writeFileSync(outPath, Buffer.from(b64, "base64"));
  return outPath;
}

async function main() {
  const [promptsFile, outDirArg] = process.argv.slice(2);

  if (!promptsFile) {
    console.error(
      "שימוש: node generate-images.mjs <prompts.json> <output-dir>",
    );
    process.exit(1);
  }

  const outDir = resolve(outDirArg || "./out");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const items = JSON.parse(readFileSync(resolve(promptsFile), "utf8"));
  const apiKey = loadApiKey();

  console.log(`\n🎨 ${items.length} קריאייטיבים · ${SIZE} · איכות ${QUALITY}`);
  console.log(`   עלות משוערת: ~$${(items.length * 0.006).toFixed(3)}\n`);

  items.forEach(checkPrompt);

  let ok = 0;
  for (const item of items) {
    process.stdout.write(`   ${item.id} ... `);
    try {
      await generateOne(apiKey, item, outDir);
      console.log("✓");
      ok++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
    }
  }

  console.log(`\n✅ ${ok}/${items.length} נוצרו → ${outDir}`);
  if (ok > 0) {
    console.log("   הצעד הבא: להלביש טקסט עם templates/overlay.html\n");
  }
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
