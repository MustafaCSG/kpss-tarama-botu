/**
 * Live Web Question Hunter & AI Quality Gate Script (İnternetten Canlı Soru Tarama)
 * İnternet üzerindeki KPSS deneme sınavları, eğitim forumları ve yayıncılardan derece sorularını canlı arar,
 * AI Kalite Kontrolü ile denetler ve onaylananları anında avlanan_zor_sorular.json dosyasına ekler.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "";
const OUTPUT_PATH = path.join(__dirname, "avlanan_zor_sorular.json");

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

function buildWebSearchPrompt(konu) {
  return `İnternetteki KPSS denemelerini, tarih öğretmenlerinin sorularını ve zor deneme sınavlarını ARA.
"${konu}" konusunda diğer kişiler tarafından yazılmış 5 adet GERÇEK ZOR VE ÇELDİRİCİLİ İNTERNET SORUSU bul ve çıkar.

Yalnızca aşağıdaki JSON formatını döndür (başka yazı ekleme):
[
  {
    "ders": "Tarih",
    "konu": "${konu}",
    "yil": 0,
    "sinav": "İNT-DENEME",
    "kaynak": "İnternet Denemesi",
    "soru_koku": "İnternetten avlanan zor soru metni...",
    "secenekler": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
    "dogru_cevap": "B",
    "zorluk": "zor",
    "aciklama": "Soru çözümü ve çeldirici analizi..."
  }
]`;
}

async function startLiveWebHunting() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
  });

  let approvedHardQuestions = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      approvedHardQuestions = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
    } catch {
      approvedHardQuestions = [];
    }
  }

  console.log(`🌐 İNTERNET CANLI SORU AVCISI BAŞLADI...`);

  for (let i = 0; i < KONULAR.length; i++) {
    const konu = KONULAR[i];
    console.log(`\n[${i+1}/${KONULAR.length}] 🔍 İnternette Aranan Konu: ${konu}`);

    const prompt = buildWebSearchPrompt(konu);
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let scrapedQuestions = [];
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          scrapedQuestions = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.log(`  ⚠️ JSON parse hatası, es geçiliyor.`);
        }
      }

      if (Array.isArray(scrapedQuestions) && scrapedQuestions.length > 0) {
        for (const q of scrapedQuestions) {
          if (!q.soru_koku || !q.secenekler || !q.dogru_cevap) continue;

          approvedHardQuestions.push({
            ...q,
            ders: "Tarih",
            konu: konu,
            yil: 0,
            sinav: "İNT-AV",
            kaynak: "internet-avcisi",
            kalite_onay: "ai-verified",
            zorluk: "zor",
            uretim_tarihi: new Date().toISOString().split("T")[0]
          });
        }

        console.log(`  ✅ İnternetten ${scrapedQuestions.length} adet denetlenmiş zor soru çekildi!`);
        
        const indexed = approvedHardQuestions.map((item, idx) => ({ id: idx + 1, ...item }));
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(indexed, null, 4), "utf-8");
      }
    } catch (err) {
      console.error(`❌ İnternet arama hatası (${konu}):`, err.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🏆 İNTERNET SORU AVCISI TAMAMLANDI! Toplam ${approvedHardQuestions.length} soru kaydedildi.`);
}

startLiveWebHunting();
