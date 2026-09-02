/**
 * Gemini API ile ÖSYM tarzında özgün KPSS Tarih soruları üreten script.
 * Mükerrer soru engelleme (deduplication) ve 10 konu için özgün soru üretimi.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCodxevpgdU2zfK0ZRsz8HEpA7lzGEXQdQ";
const SORULAR_PATH = path.join(__dirname, "sorular.json");
const OUTPUT_PATH = path.join(__dirname, "uretilen_sorular.json");

const genAI = new GoogleGenerativeAI(API_KEY);

const KONULAR = [
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

function normalize(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9çğıöşü]/g, "").substring(0, 50);
}

function buildPrompt(konu, mevcutSorular, uretilmisSorular) {
  const konuSorulari = mevcutSorular.filter(q => q.konu && q.konu.toLowerCase().includes(konu.toLowerCase().substring(0, 10)));
  const uretilmisKonu = uretilmisSorular.filter(q => q.konu === konu);
  
  const sonUretilenler = uretilmisKonu.slice(-15).map((q, i) => 
    `- ${q.soru_koku ? q.soru_koku.substring(0, 80) : ''}...`
  ).join("\n");

  return `Sen ÖSYM'nin kıdemli tarih soru hazırlama komisyonu üyesisin.

## GÖREVİN
"${konu}" konusunda **10 adet yepyeni, daha önce hiç üretilmemiş** özgün ÖSYM tarzı çoktan seçmeli soru hazırla.

## DAHA ÖNCE ÜRETİLMİŞ SON SORULAR (BUNLARI ASLA TEKRARLAMA VE BENZERİNİ YAZMA!):
${sonUretilenler || 'Henüz üretilen soru yok.'}

## ÖSYM SORU KURALLARI:
1. Her soru benzersiz bir tarihsel olayı, kavramı veya çıkarımı sorgulamalı.
2. I, II, III öncüllü yorum soruları, olumsuz soru kalıpları ("ulaşılamaz", "değildir") ve paragraf çıkarım soruları olmalı.
3. Çeldirici şıklar son derece güçlü olmalı.
4. Çözüm açıklaması ("aciklama") detaylı olmalı.

## ÇIKTI FORMATI (Sadece JSON array):
[
  {
    "ders": "Tarih",
    "konu": "${konu}",
    "yil": 0,
    "sinav": "AI-URETIM",
    "soru_koku": "Benzersiz yeni soru metni...",
    "secenekler": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
    "dogru_cevap": "C",
    "zorluk": "orta",
    "aciklama": "Çözüm açıklaması..."
  }
]`;
}

async function generateAllQuestions() {
  let sorular = [];
  if (fs.existsSync(SORULAR_PATH)) {
    sorular = JSON.parse(fs.readFileSync(SORULAR_PATH, "utf-8"));
  }

  let mevcutUretilen = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    mevcutUretilen = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  }

  // Fingerprints of all existing questions
  const existingFingerprints = new Set([
    ...sorular.map(q => normalize(q.soru_koku)),
    ...mevcutUretilen.map(q => normalize(q.soru_koku))
  ]);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.9, // High creativity and variation
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
  });

  let eklenenYeni = 0;

  for (let i = 0; i < KONULAR.length; i++) {
    const konu = KONULAR[i];
    console.log(`\n[${i+1}/${KONULAR.length}] 📝 Konu: ${konu}`);

    const prompt = buildPrompt(konu, sorular, mevcutUretilen);
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().strip ? result.response.text().strip() : result.response.text();

      let parsed = [];
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (Array.isArray(parsed)) {
        const uniqueNew = [];

        for (const q of parsed) {
          if (!q.soru_koku || !q.secenekler || !q.dogru_cevap) continue;
          
          const fp = normalize(q.soru_koku);
          if (fp && fp.length > 10 && !existingFingerprints.has(fp)) {
            existingFingerprints.add(fp);
            uniqueNew.push({
              ...q,
              ders: "Tarih",
              konu: konu,
              yil: 0,
              sinav: "AI-URETIM",
              kaynak: "gemini-2.5-flash",
              uretim_tarihi: new Date().toISOString().split("T")[0],
              zorluk: q.zorluk || "orta",
              aciklama: q.aciklama || ""
            });
          }
        }

        mevcutUretilen.push(...uniqueNew);
        eklenenYeni += uniqueNew.length;
        console.log(`✅ ${uniqueNew.length} benzersiz yeni soru eklendi! (Mevcut Toplam: ${mevcutUretilen.length})`);
      }
    } catch (err) {
      console.error(`❌ Üretim hatası (${konu}):`, err.message);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Re-index IDs
  mevcutUretilen = mevcutUretilen.map((q, idx) => ({
    id: idx + 1,
    ...q
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mevcutUretilen, null, 4), "utf-8");
  console.log(`\n🎉 TAMAMLANDI! Toplam ${eklenenYeni} yeni benzersiz soru üretildi. Toplam AI soru deposu: ${mevcutUretilen.length}`);
}

generateAllQuestions();
