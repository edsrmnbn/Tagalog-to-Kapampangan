// server.js (Supabase-backed translator)
import express from "express";
import path from "path";
import * as pkg from "@vitalets/google-translate-api";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const translate = pkg.translate ?? pkg.default ?? pkg;

// Supabase client - requires env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// helper: lookup translation by lowercased key
async function lookupTranslation(key) {
  const { data, error } = await supabase
    .from("translations")
    .select("translated, source")
    .eq("key", key)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[supabase] lookup error:", error);
    throw error;
  }
  return data; // undefined if none
}

// helper: upsert translation
async function upsertTranslation(key, translated, source = "online") {
  const { data, error } = await supabase
    .from("translations")
    .upsert({ key, translated, source }, { onConflict: "key" })
    .select()
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[supabase] upsert error:", error);
    throw error;
  }
  return data;
}

app.post("/translate", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ ok: false, error: "No text provided" });

    const key = text.toLowerCase();

    // 1) Check DB
    const row = await lookupTranslation(key);
    if (row?.translated) {
      console.log("[translate] Found in DB");
      return res.json({ ok: true, source: "local", translated: row.translated });
    }

    // 2) Online fallback
    if (!translate) {
      return res.status(503).json({ ok: false, error: "Online translator library unavailable" });
    }

    console.log("[translate] Calling online translator...");
    const r = await translate(text, { from: "tl", to: "pam" });
    const translated = r?.text ?? String(r ?? "");

    // 3) Save to DB if meaningful
    if (translated && translated.trim().toLowerCase() !== key) {
      await upsertTranslation(key, translated, "online");
      console.log("[translate] Saved new translation to Supabase");
    } else {
      console.log("[translate] Online result empty or same as input — not saved");
    }

    return res.json({ ok: true, source: "online", translated });
  } catch (err) {
    console.error("[translate] Error:", err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/ping", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  const indexPath = path.join(process.cwd(), "public", "index.html");
  if (indexPath) return res.sendFile(indexPath);
  res.send("Translator running - UI not found");
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
