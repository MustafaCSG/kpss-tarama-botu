/**
 * ÖABT Tarih PDF metinlerinden sadece 10 KPSS konusuna uyan soruları ayıran script.
 * Gemini 3.6 Flash ile metin temizleme, konu analizi ve JSON verileştirme yapar.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const PAGES_PATH = path.join(__dirname, "oabt_pages_text.json");
const OUTPUT_PATH = path.join(__dirname, "oabt_extracted_questions.json");
const PROGRESS_PATH = path.join(__dirname, "oabt_node_progress.json");

const VALID_TOPICS = [
  "İslam Öncesi Türk Tarihi",
  "İlk Türk İslam Devletleri",
  "Beylikler Dönemi ve Türkiye Selçuklu Devleti",
  "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri",
  "Osmanlı Kültür ve Medeniyeti",
  "XVII, XVIII ve XIX. Yüzyılda Osmanlı Devleti ve Islahatlar",
  "XX. Yüzyıl Başlarında Osmanlı Devleti ve İnkılap Tarihi",
  "Milli Mücadele Dönemi (Hazırlık, Cepheler ve Diplomasi)",
  "Atatürk Dönemi İç ve Dış Politika & İnkılaplar",
  "Çağdaş Türk ve Dünya Tarihi"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(textChunk) {
  return `Sen ÖSYM ÖABT Tarih sorularını KPSS Genel Kültür Tarih müfredatına göre süzüp temizleyen uzman bir tarihçisin.
Aşağıda ÖABT Tarih çıkmış sorular kitabının ham metinleri verilmiştir.

## METİN:
${textChunk}

## GÖREVLERİN:
1. Metindeki soruları düzgün Türkçe karakterlerle (ş, ç, ö, ü, ğ, ı, İ) oku ve temizle.
2. SADECE VE SADECE AŞAĞIDAKİ 10 KPSS TARİH KONUSUNA GİREN SORULARI ÇIKAR:
   - "İslam Öncesi Türk Tarihi"
   - "İlk Türk İslam Devletleri"
   - "Beylikler Dönemi ve Türkiye Selçuklu Devleti"
   - "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri"
   - "Osmanlı Kültür ve Medeniyeti"
   - "XVII, XVIII ve XIX. Yüzyılda Osmanlı Devleti ve Islahatlar"
   - "XX. Yüzyıl Başlarında Osmanlı Devleti ve İnkılap Tarihi"
   - "Milli Mücadele Dönemi (Hazırlık, Cepheler ve Diplomasi)"
   - "Atatürk Dönemi İç ve Dış Politika & İnkılaplar"
   - "Çağdaş Türk ve Dünya Tarihi"

3. ELE (ATLA VE ÇIKARMA):
   - Tarih Metodolojisi, Tarih Yazıcılığı, Tarih Felsefesi, Tarih Eğitimi / Pedagoji soruları
   - Eski Çağ Tarihi (Sümer, Mısır, Hitit, İyonya, Yunan, Roma, Mezopotamya vb.)
   - Türk/Osmanlı ile ilgisi olmayan Orta Çağ / Yeni Çağ Avrupa Tarihi soruları

## ÇIKTI FORMATI (Sadece JSON array):
[
  {
    "ders": "Tarih",
    "konu": "Yukarıdaki 10 konudan birebir uyan başlık ismi",
    "yil": 2020,
    "sinav": "ÖABT-TARİH",
    "kaynak": "oabt-cikmis",
    "soru_koku": "Temizlenmiş soru metni ve öncüller...",
    "secenekler": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
    "dogru_cevap": "C",
    "aciklama": "Kısa 1 cümlelik çözüm açıklaması"
  }
]`;
}

async function main() {
  if (!fs.existsSync(PAGES_PATH)) {
    console.log("❌ oabt_pages_text.json bulunamadı.");
    return;
  }

  const allPages = JSON.parse(fs.readFileSync(PAGES_PATH, "utf-8"));
  console.log(`📖 Toplam Sayfa Sayısı: ${allPages.length}`);

  let extractedQuestions = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try { extractedQuestions = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8")); } catch {}
  }

  let processedIndices = new Set();
  if (fs.existsSync(PROGRESS_PATH)) {
    try { processedIndices = new Set(JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"))); } catch {}
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });

  const CHUNK_SIZE = 4; // 4 sayfa per chunk
  let addedCount = 0;

  for (let i = 0; i < allPages.length; i += CHUNK_SIZE) {
    const chunkPages = allPages.slice(i, i + CHUNK_SIZE);
    const chunkKey = `${chunkPages[0].page}-${chunkPages[chunkPages.length - 1].page}`;

    if (processedIndices.has(chunkKey)) {
      continue;
    }

    console.log(`\n⏳ Chunk [Sayfa ${chunkKey}] taranıyor...`);
    const combinedText = chunkPages.map(p => `--- SAYFA ${p.page} ---\n${p.text}`).join("\n\n");

    const prompt = buildPrompt(combinedText);
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed = [];
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = [];
        for (const q of parsed) {
          if (!q.soru_koku || !q.secenekler || !q.dogru_cevap) continue;
          
          const konu = q.konu || "";
          const matchedTopic = VALID_TOPICS.find(vt => vt.toLowerCase() === konu.toLowerCase() || konu.toLowerCase().includes(vt.toLowerCase()) || vt.toLowerCase().includes(konu.toLowerCase()));
          if (matchedTopic) {
            valid.push({
              ...q,
              ders: "Tarih",
              konu: matchedTopic,
              sinav: "ÖABT-TARİH",
              kaynak: "oabt-cikmis",
              dogru_cevap: (q.dogru_cevap || "").trim().toUpperCase(),
              aciklama: q.aciklama || ""
            });
          }
        }

        extractedQuestions.push(...valid);
        addedCount += valid.length;
        console.log(`  ✅ ${valid.length} yeni geçerli KPSS ÖABT sorusu süzüldü. (Toplam ÖABT Deposu: ${extractedQuestions.length})`);
      } else {
        console.log(`  ℹ️ Bu sayfalarda KPSS müfredatına uygun soru bulunamadı/elenmiş.`);
      }

      processedIndices.add(chunkKey);

      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(extractedQuestions, null, 4), "utf-8");
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify([...processedIndices], null, 2), "utf-8");
    } catch (err) {
      console.error(`  ❌ Chunk hatası: ${err.message}`);
    }

    await sleep(12000);
  }

  console.log(`\n🎉 TAMAMLANDI! Toplam ${addedCount} geçerli KPSS ÖABT sorusu ayrıştırılıp ${OUTPUT_PATH} dosyasına yazıldı.`);
}

main();
