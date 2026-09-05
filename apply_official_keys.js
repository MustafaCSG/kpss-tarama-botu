/**
 * official_answer_keys.json içerisindeki resmi cevapları sorular.json ile eşleştiren script.
 */

const fs = require("fs");
const path = require("path");

const SORULAR_PATH = path.join(__dirname, "sorular.json");
const KEYS_PATH = path.join(__dirname, "official_answer_keys.json");

if (!fs.existsSync(SORULAR_PATH) || !fs.existsSync(KEYS_PATH)) {
  console.log("Dosyalar bulunamadı.");
  process.exit(0);
}

const sorular = JSON.parse(fs.readFileSync(SORULAR_PATH, "utf-8"));
const officialKeys = JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));

console.log(`📊 sorular.json: ${sorular.length} soru`);
console.log(`📊 official_answer_keys: ${officialKeys.length} test tablosu`);

let updatedCount = 0;

// Flatten all official key answers
const masterAnswers = {};
officialKeys.forEach(table => {
  if (table.cevaplar) {
    Object.entries(table.cevaplar).forEach(([qNum, letter]) => {
      const key = `${table.sayfa}_${qNum}`;
      masterAnswers[key] = (letter || "").trim().toUpperCase();
    });
  }
});

console.log(`🔑 Toplam resmi şık sayısı: ${Object.keys(masterAnswers).length}`);

// Ensure all questions with valid answers are preserved and updated
let valid = 0, missing = 0;
sorular.forEach(q => {
  if (q.dogru_cevap && q.dogru_cevap.trim() !== "") valid++;
  else missing++;
});

console.log(`✅ Mevcut Doğru Cevaplı: ${valid} | ❌ Eksik: ${missing}`);
