#!/usr/bin/env node
/**
 * חסימת בטיחות — לא נוגעים בקמפיין שלא נבנה כאן
 *
 * כל קמפיין, קבוצת מודעות, מודעה וקריאייטיב שהפלאגין יוצר נרשמים ברשימה.
 * כל פעולת עריכה, הדלקה או הוספה בחשבון המודעות מותרת רק על מזהה שברשימה.
 * קמפיין שהיה בחשבון לפני כן (למשל הקמפיין שרץ ועובד) לא ברשימה, ולכן חסום.
 *
 * שימוש (מתוך hooks.json):
 *   node guard.mjs pre    ← לפני כל כלי: חוסם אם צריך
 *   node guard.mjs post   ← אחרי יצירה: רושם את המזהים החדשים
 *
 * הרשימה: ~/.claude/tal-meta-ads/created-ids.json
 * מוסיפים לה מזהה ידנית רק בעצמכם, לא דרך Claude.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.homedir(), ".claude", "tal-meta-ads");
const FILE = path.join(DIR, "created-ids.json");
const mode = process.argv[2];

// כלי כתיבה, ואיזה שדות בהם מצביעים על משהו קיים בחשבון
const GUARDED = {
  ads_update_entity: ["entity_id"],
  ads_activate_entity: ["entity_id", "object_ids"],
  ads_create_ad_set: ["campaign_id"],
  ads_create_ad: ["ad_set_id"],
  ads_creative_update: ["creative_id"],
  ads_creative_delete: ["creative_id"],
};
// כלי יצירה, והשדה בתשובה של מטא שמחזיק את המזהה החדש
const CREATORS = {
  ads_create_campaign: "campaign_id",
  ads_create_ad_set: "ad_set_id",
  ads_create_ad: "ad_id",
  ads_create_creative: "creative_id",
};

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return null;
  }
}

function loadIds() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return new Set((data.ids || []).map(String));
  } catch {
    return new Set();
  }
}

function saveIds(ids) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ ids: [...ids] }, null, 2));
  fs.renameSync(tmp, FILE);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

// "mcp__claude_ai_meta__ads_update_entity" → "ads_update_entity"
function shortName(toolName) {
  const m = /(?:^|__)(ads_[a-z_]+)$/.exec(toolName || "");
  return m ? m[1] : null;
}

const input = readInput();

if (mode === "pre") {
  if (!input)
    deny(
      "חסימת בטיחות: לא הצלחתי לקרוא את הפעולה, ולכן לא מבצעים אותה בחשבון המודעות.",
    );
  const tool = input.tool_name || "";
  const args = input.tool_input || {};

  // אסור לשנות את הרשימה עצמה דרך Claude
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const p = String(args.file_path || args.notebook_path || "");
    if (p.includes("created-ids"))
      deny("חסימת בטיחות: את רשימת הקמפיינים המותרים לא משנים דרך Claude.");
    process.exit(0);
  }
  if (tool === "Bash") {
    if (String(args.command || "").includes("created-ids"))
      deny("חסימת בטיחות: את רשימת הקמפיינים המותרים לא משנים דרך Claude.");
    process.exit(0);
  }

  const name = shortName(tool);
  if (!name || !GUARDED[name]) process.exit(0);

  const ids = loadIds();
  const targets = [];
  for (const field of GUARDED[name]) {
    const v = args[field];
    if (Array.isArray(v)) targets.push(...v.map(String));
    else if (v !== undefined && v !== null && v !== "") targets.push(String(v));
  }
  if (targets.length === 0)
    deny(`חסימת בטיחות: בפעולה ${name} חסר מזהה, ולכן לא מבצעים אותה.`);

  const foreign = targets.filter((id) => !ids.has(id));
  if (foreign.length) {
    deny(
      `חסימת בטיחות: ${foreign.join(", ")} לא נבנה על ידי מנהל הקמפיינים, ולכן אסור לגעת בו. ` +
        `קמפיינים שהיו בחשבון לפני כן (כמו קמפיין שכבר רץ) נשארים בדיוק כמו שהם. ` +
        `אם צריך לשנות אותם, בעל העסק עושה את זה בעצמו במנהל המודעות. לא לנסות לעקוף.`,
    );
  }
  process.exit(0);
}

if (mode === "post") {
  if (!input) process.exit(0);
  const name = shortName(input.tool_name);
  if (!name || !CREATORS[name]) process.exit(0);

  // התשובה של מטא יכולה להגיע כאובייקט, כטקסט או כ-JSON בתוך טקסט. מחפשים בכל הצורות,
  // ורק את השדה של מה שנוצר עכשיו (לא מזהים אחרים שמופיעים בתשובה)
  const raw = JSON.stringify(input.tool_response ?? "");
  const re = new RegExp(
    `\\\\*"${CREATORS[name]}\\\\*"\\s*:\\s*\\\\*"?(\\d{6,})`,
    "g",
  );
  const ids = loadIds();
  let added = 0;
  for (const m of raw.matchAll(re)) {
    if (!ids.has(m[1])) {
      ids.add(m[1]);
      added++;
    }
  }
  if (added) saveIds(ids);
  process.exit(0);
}

process.exit(0);
