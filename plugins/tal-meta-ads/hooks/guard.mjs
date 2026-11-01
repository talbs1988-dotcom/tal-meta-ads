#!/usr/bin/env node
/**
 * חסימת בטיחות — לא נוגעים בקמפיין שלא נבנה כאן
 *
 * עובדת ברשימה של מה שמותר, לא ברשימה של מה שאסור:
 * - קריאה מהחשבון (דוחות, סיור, נתונים): תמיד מותרת.
 * - יצירה של משהו חדש: מותרת, אבל לא כהעתק של משהו קיים.
 * - עריכה, הדלקה או הוספה לתוך משהו קיים: רק על מזהה שהפלאגין יצר בעצמו.
 * - כל פעולת כתיבה אחרת בחשבון המודעות (קהלים קיימים, פיקסל, ניסויים, קידום פוסט,
 *   וכל כלי חדש שמטא תוסיף): חסומה.
 *
 * כל קמפיין, קבוצת מודעות, מודעה וקריאייטיב שהפלאגין יוצר נרשמים ברשימה.
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

// קריאה בלבד: לא משנה כלום בחשבון
const READ_ONLY =
  /^ads_(get_|account_get_|insights_|library_|entity_get_|entity_schedule_report$|mcp_enabled$|log_ui_interaction$|experiment_list_tests$|experiment_check_eligibility$|experiment_(abtest|lift)_get_test$|catalog_(get|list)_|catalog_event_source_get|pixel_(event|parameter)_read$)/;

// העלאת קבצים לספריית המדיה: לא נוגעת בשום קמפיין
const UPLOADS = new Set([
  "ads_creative_upload_media",
  "ads_creative_upload_video",
  "ads_creative_upload_image",
  "ads_creative_upload_local_image",
  "ads_finalize_local_ad_image_upload",
  "ads_delete_local_ad_image",
]);

// יצירה של משהו חדש. אסור רק להעתיק משהו קיים
const CREATE_NEW = new Set([
  "ads_create_campaign",
  "ads_create_creative",
  "ads_create_custom_audience",
]);

// פעולות על משהו קיים: השדות האלה חייבים להצביע על מזהה מהרשימה
const OWNED_ONLY = {
  ads_update_entity: ["entity_id"],
  ads_activate_entity: ["entity_id", "object_ids"],
  ads_create_ad_set: ["campaign_id"],
  ads_create_ad: ["ad_set_id"],
  ads_creative_update: ["creative_id"],
  ads_creative_delete: ["creative_id"],
};

// שדות שמעתיקים משהו קיים. בכל כלי, אסורים
const COPY_FIELDS = [
  "source_campaign_id",
  "source_adset_id",
  "source_ad_id",
  "object_story_id", // פוסט של מודעה קיימת
  "adset_spec", // יצירת סדרה בתוך מודעה, עם campaign_id שלא נבדק
  "campaign_spec",
  "include_in_ad_study_id",
  "include_in_ad_study_cell_id",
];

// כלי יצירה, והשדה בתשובה של מטא שמחזיק את המזהה החדש
const CREATORS = {
  ads_create_campaign: "campaign_id",
  ads_create_ad_set: "ad_set_id",
  ads_create_ad: "ad_id",
  ads_create_creative: "creative_id",
};

// הרשימה עצמה והפלאגין המותקן: לא משנים דרך Claude
const PROTECTED_PATHS = [
  path.join(".claude", "tal-meta-ads"),
  path.join("plugins", "cache", "tal-meta-ads"),
  path.join("plugins", "marketplaces", "tal-meta-ads"),
  "created-ids",
];

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
        permissionDecisionReason: `חסימת בטיחות: ${reason} לא לנסות לעקוף. עוצרים ומספרים לבעל העסק.`,
      },
    }),
  );
  process.exit(0);
}

const FOREIGN =
  "קמפיינים שהיו בחשבון לפני כן (כמו קמפיין שכבר רץ) נשארים בדיוק כמו שהם. אם צריך לשנות אותם, בעל העסק עושה את זה בעצמו במנהל המודעות.";

// "mcp__claude_ai_meta__ads_update_entity" → "ads_update_entity"
function shortName(toolName) {
  const m = /(?:^|__)(ads_[a-z0-9_]+)$/.exec(toolName || "");
  return m ? m[1] : null;
}

// התשובה של מטא מגיעה כאובייקט, כטקסט JSON, או כרשימת בלוקים של טקסט.
// לוקחים רק את השדה ברמה העליונה, כדי שמזהה של קמפיין אחר שמופיע בתוך התשובה לא יירשם
function topLevelId(resp, field) {
  const candidates = [];
  const add = (v) => {
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        return;
      }
    }
    if (Array.isArray(v)) v.forEach((b) => b && b.text !== undefined && add(b.text));
    else if (v && typeof v === "object") {
      candidates.push(v);
      if (Array.isArray(v.content)) add(v.content);
      if (v.structuredContent) add(v.structuredContent);
    }
  };
  add(resp);
  for (const o of candidates) {
    const id = o[field];
    if (id !== undefined && /^\d{6,}$/.test(String(id))) return String(id);
  }
  return null;
}

function touchesProtected(text) {
  return PROTECTED_PATHS.some((p) => text.includes(p));
}

const input = readInput();

if (mode === "pre") {
  if (!input) deny("לא הצלחתי לקרוא את הפעולה, ולכן לא מבצעים אותה.");
  const tool = input.tool_name || "";
  const args = input.tool_input || {};

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const file = String(args.file_path || args.notebook_path || "");
    const body = JSON.stringify([args.content, args.new_string, args.edits]);
    if (
      touchesProtected(file) ||
      (/settings(\.local)?\.json$/.test(file) &&
        /tal-meta-ads|disableAllHooks/.test(body))
    )
      deny("את רשימת הקמפיינים המותרים ואת חסימת הבטיחות לא משנים דרך Claude.");
    process.exit(0);
  }
  if (tool === "Bash") {
    const cmd = String(args.command || "");
    if (
      touchesProtected(cmd) ||
      /plugin\s+(disable|uninstall|remove)\b[^\n]*tal-meta-ads/.test(cmd) ||
      /disableAllHooks/.test(cmd) ||
      (cmd.includes(".claude") &&
        cmd.includes("tal-meta-ads") &&
        /\bsed\s+-i|>|\b(mv|rm|cp|tee|truncate)\b/.test(cmd))
    )
      deny("את רשימת הקמפיינים המותרים ואת חסימת הבטיחות לא משנים דרך Claude.");
    process.exit(0);
  }

  const name = shortName(tool);
  if (!name) process.exit(0);
  // כלים של שרתים אחרים שגם השם שלהם מתחיל ב-ads_ (למשל Ads Studio של Higgsfield)
  if (name.startsWith("ads_studio_") || /higgsfield/i.test(tool)) process.exit(0);
  if (READ_ONLY.test(name) || UPLOADS.has(name)) process.exit(0);

  const copied = COPY_FIELDS.filter(
    (f) => args[f] !== undefined && args[f] !== null && args[f] !== "",
  );
  if (copied.length)
    deny(
      `אסור להעתיק קמפיין, קבוצת מודעות או מודעה קיימים (${copied.join(", ")}). בונים מאפס. ${FOREIGN}`,
    );

  if (CREATE_NEW.has(name)) process.exit(0);

  if (!OWNED_ONLY[name])
    deny(
      `הפעולה ${name} משנה את חשבון המודעות, ומנהל הקמפיינים לא מבצע אותה. ${FOREIGN}`,
    );

  const ids = loadIds();
  const targets = [];
  for (const field of OWNED_ONLY[name]) {
    const v = args[field];
    if (Array.isArray(v)) targets.push(...v.map(String));
    else if (v !== undefined && v !== null && v !== "") targets.push(String(v));
  }
  if (targets.length === 0)
    deny(`בפעולה ${name} חסר מזהה, ולכן לא מבצעים אותה.`);

  // מודעה חדשה יכולה להשתמש רק בקריאייטיב שהפלאגין יצר, לא בקריאייטיב של מודעה קיימת
  if (name === "ads_create_ad") {
    const raw = JSON.stringify(args.creative ?? "");
    for (const m of raw.matchAll(/creative_id\\*"\s*:\s*\\*"?(\d{6,})/g))
      targets.push(m[1]);
    if (args.creative_id) targets.push(String(args.creative_id));
    if (/object_story_id/.test(raw))
      deny(`אסור להשתמש בפוסט של מודעה קיימת. בונים מאפס. ${FOREIGN}`);
  }

  const foreign = [...new Set(targets.filter((id) => !ids.has(id)))];
  if (foreign.length)
    deny(
      `${foreign.join(", ")} לא נבנה על ידי מנהל הקמפיינים, ולכן אסור לגעת בו. ${FOREIGN}`,
    );
  process.exit(0);
}

if (mode === "post") {
  if (!input) process.exit(0);
  const name = shortName(input.tool_name);
  if (!name || !CREATORS[name]) process.exit(0);

  // התשובה של מטא יכולה להגיע כאובייקט, כטקסט או כ-JSON בתוך טקסט. מחפשים בכל הצורות,
  // ורק את השדה של מה שנוצר עכשיו (לא מזהים אחרים שמופיעים בתשובה)
  const id = topLevelId(input.tool_response, CREATORS[name]);
  if (!id) process.exit(0);
  const ids = loadIds();
  if (!ids.has(id)) {
    ids.add(id);
    saveIds(ids);
  }
  process.exit(0);
}

process.exit(0);
