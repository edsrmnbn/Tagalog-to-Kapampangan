// translate-hybrid-autosave.js
// Hybrid translator: local dictionary first; if missing and online, fetch and auto-save only meaningful translations.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dictPath = path.join(__dirname, 'dictionary.json');

// load or create dictionary
let dictionary = {};
try {
  if (fs.existsSync(dictPath)) {
    dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  } else {
    fs.writeFileSync(dictPath, JSON.stringify({}, null, 2), 'utf8');
    dictionary = {};
  }
} catch (err) {
  console.error('Failed to load dictionary.json:', err.message);
  dictionary = {};
}

// normalize helper
const normalize = s => s.trim().toLowerCase();

// lazy-load online translator
let onlineAvailable = true;
let pkg = null;
try {
  pkg = require('@vitalets/google-translate-api');
} catch (e) {
  onlineAvailable = false;
}
const translateFunction = pkg ? (pkg.translate ?? pkg.default ?? pkg) : null;

function saveDictionarySync() {
  try {
    fs.writeFileSync(dictPath, JSON.stringify(dictionary, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save dictionary:', err.message);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

console.log('🔁 Hybrid Tagalog → Kapampangan Translator (autosave)');
console.log("Type a word or phrase (type 'exit' to quit).");
console.log('Local entries:', Object.keys(dictionary).length);
console.log(onlineAvailable ? 'Online fallback: ENABLED' : 'Online fallback: DISABLED (install package to enable)');
console.log('');

const ask = () => {
  rl.question('Enter text: ', async (text) => {
    const raw = text || '';
    const key = normalize(raw);

    if (!raw.trim()) {
      ask();
      return;
    }
    if (key === 'exit') {
      console.log('👋 Exiting translator...');
      rl.close();
      return;
    }

    // local lookup
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
      console.log(`(local) Kapampangan: ${dictionary[key]}\n`);
      ask();
      return;
    }

    // online fallback
    if (!onlineAvailable || !translateFunction) {
      console.log('⚠️ Offline & not found in dictionary. No online translator available.');
      console.log('Kapampangan: ⚠️ No translation found.\n');
      ask();
      return;
    }

    try {
      const res = await translateFunction(raw, { from: 'tl', to: 'pam' });
      // res might be object { text: '...' } or string; normalize returned text
      const translated = (typeof res === 'string') ? res : (res?.text ?? '');
      const translatedNormalized = normalize(translated);

      console.log(`(online) Kapampangan: ${translated}\n`);

      // Only save if translation is meaningfully different (avoid saving identical copies)
      // Also avoid saving empty responses
      if (translatedNormalized && translatedNormalized !== key) {
        dictionary[key] = translated;
        saveDictionarySync();
        console.log('(autosave) Saved to dictionary.json\n');
      } else {
        console.log('(autosave) Not saved: API returned same text or empty (no meaningful translation).\n');
      }

      ask();
      return;
    } catch (err) {
      console.error('⚠️ Online translation failed:', err.message || err);
      console.log('Kapampangan: ⚠️ No translation found (offline fallback not matched).\n');
      ask();
      return;
    }
  });
};

ask();

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, exiting...');
  rl.close();
  process.exit(0);
});
