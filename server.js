import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as pkg from "@vitalets/google-translate-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const translate = pkg.translate ?? pkg.default ?? pkg;
const app = express();
app.use(express.json());

const dictPath = path.join(__dirname, "dictionary.json");
let dictionary = {};

if (fs.existsSync(dictPath)) {
  dictionary = JSON.parse(fs.readFileSync(dictPath, "utf8"));
} else {
  fs.writeFileSync(dictPath, JSON.stringify({}, null, 2));
}

// Utility to save dictionary
function saveDictionary() {
  fs.writeFileSync(dictPath, JSON.stringify(dictionary, null, 2));
}

// Translator route
app.post("/translate", async (req, res) => {
  const text = (req.body.text || "").trim().toLowerCase();
  if (!text) return res.status(400).json({ error: "No text provided" });

  // 1️⃣ Check local dictionary
  if (dictionary[text]) {
    return res.json({ source: "local", translated: dictionary[text] });
  }

  // 2️⃣ Try online
  try {
    const result = await translate(text, { from: "tl", to: "pam" });
    const translated = result.text;

    // save if meaningful
    if (translated && translated.toLowerCase() !== text) {
      dictionary[text] = translated;
      saveDictionary();
    }

    return res.json({ source: "online", translated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Basic homepage
app.get("/", (req, res) => {
  res.send(`
    <h1>🗣️ Tagalog → Kapampangan Translator</h1>
    <form method="POST" action="/translate" id="form">
      <input name="text" placeholder="Enter text..." required />
      <button>Translate</button>
    </form>
    <pre id="result"></pre>

    <script>
      const form = document.getElementById('form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const text = form.text.value;
        const res = await fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        document.getElementById('result').innerText = JSON.stringify(data, null, 2);
      };
    </script>
  `);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Translator live at http://localhost:${PORT}`));
