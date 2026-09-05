/**
 * Gemini API ile %100 GERÇEK ÖSYM KONTROLÜNDE ÖZGÜN KPSS TARİH SORULARI ÜRETEN SCRIPT.
 * ÖSYM'nin gerçek soru hazırlama formatı (I, II, III öncüllü, metin analizi, çeldiricili).
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "";
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
  "Çağdaş Türk me Dünya Tarihi"
];

function normalize(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9çğıöşü]/g, "").substring(0, 50);
}

function buildPrompt(konu, uretilmisSorular) {
  const uretilmisKonu = uretilmisSorular.filter(q => q.konu === konu);
  
  const sonUretilenler = uretilmisKonu.slice(-15).map((q) => 
    `- ${q.soru_koku ? q.soru_koku.replace(/\n/g, " ").substring(0, 90) : ''}...`
  ).join("\n");

  return `Sen ÖSYM'nin Kıdemli KPSS Tarih Soru Hazırlama Komisyonu Başkanısın.

## GÖREVİN:
"${konu}" konusunda ÖSYM standartlarında, derece yaptıracak kalitede **10 adet yepyeni, özgün ve ZOR (ÖSYM AYARINDA)** çoktan seçmeli soru hazırla.

## DAHA ÖNCE ÜRETİLMİŞ SON SORULAR (BUNLARI ASLA TEKRARLAMA VE BENZERİNİ YAZMA!):
${sonUretilenler || 'Henüz üretilen soru yok.'}

## ÖSYM SORU HAZIRLAMA İLKELERİ:
1. **Soru Tipleri Dağılımı:**
   - En az 5 soru **I, II, III öncüllü** analiz/çıkarım sorusu olmalı. (Örn: "I. ..., II. ..., III. ... gelişmelerinden hangileri ... göstergesidir?")
   - En az 3 soru **metin/alıntı/tarihsel kaynak** tabanlı yorumlama sorusu olmalı.
   - En az 2 soru **kavram, antlaşma, kronoloji veya terim bilgisi** sorgulayan belirleyici soru olmalı.
2. **Soru Kökü Dil ve Formatı:** ÖSYM'nin resmi sınav dilini birebir kullan ("ulaşılabilir?", "savunulabilir?", "söylenemez?", "hangisidir?").
3. **Çeldirici Mantığı:** Şıklar birbirine yakın, öğrencinin sıkça düştüğü kavram karmaşalarını hedefleyen güçlü çeldiricilerden oluşmalı.
4. **Zorluk Seviyesi:** Soruların zorluk derecesi "zor" veya "çok zor" olmalı.
5. **Çözüm Açıklaması:** "aciklama" alanında sorunun doğru cevabının neden o şık olduğu ve çeldiricilerin neden yanlış olduğu kısa ve net açıklanmalı.

## ÇIKTI FORMATI (Sadece ve sadece JSON array döndür):
[
  {
    "ders": "Tarih",
    "konu": "${konu}",
    "yil": 0,
    "sinav": "ÖSYM-AI-DERECE",
    "soru_koku": "ÖSYM formatında soru metni veya öncüller...",
    "secenekler": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
    "dogru_cevap": "C",
    "zorluk": "zor",
    "aciklama": "Detaylı ÖSYM çözümü ve çeldirici analizi..."
  }
]`;
}

async function generateAllQuestions() {
  let sorular = [];
  if (fs.existsSync(SORULAR_PATH)) {
    try { sorular = JSON.parse(fs.readFileSync(SORULAR_PATH, "utf-8")); } catch {}
  }

  let mevcutUretilen = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try { mevcutUretilen = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8")); } catch {}
  }

  const existingFingerprints = new Set([
    ...sorular.map(q => normalize(q.soru_koku)),
    ...mevcutUretilen.map(q => normalize(q.soru_koku))
  ]);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
  });

  let eklenenYeni = 0;

  for (let i = 0; i < KONULAR.length; i++) {
    const konu = KONULAR[i];
    console.log(`\n[${i+1}/${KONULAR.length}] 📝 ÖSYM Konu: ${konu}`);

    const prompt = buildPrompt(konu, mevcutUretilen);
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
              sinav: "ÖSYM-AI",
              kaynak: "gemini-2.5-flash",
              uretim_tarihi: new Date().toISOString().split("T")[0],
              zorluk: q.zorluk || "zor",
              aciklama: q.aciklama || ""
            });
          }
        }

        mevcutUretilen.push(...uniqueNew);
        eklenenYeni += uniqueNew.length;
        console.log(`✅ ${uniqueNew.length} ÖSYM kalitesinde yeni soru eklendi! (Toplam Depo: ${mevcutUretilen.length})`);
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
  console.log(`\n🎉 TAMAMLANDI! Toplam ${eklenenYeni} yeni ÖSYM tarzı zor soru üretildi.`);
}

generateAllQuestions();
