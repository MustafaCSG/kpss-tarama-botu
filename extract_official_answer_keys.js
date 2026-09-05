/**
 * cevapanahtaritarih.pdf görsellerinden resmi cevap anahtarlarını çıkaran script.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const IMAGES_DIR = path.join(__dirname, "key_images");
const OUTPUT_PATH = path.join(__dirname, "official_answer_keys.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractKeyFromImage(model, imagePath, pageNum) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString("base64");

  const prompt = `Bu görsel bir KPSS Tarih soru bankası CEVAP ANAHTARI sayfasıdır.
Görseldeki TÜM cevap anahtarı tablolarını oku ve JSON formatına dönüştür.

ÇIKTI FORMATI (Sadece JSON array):
[
  {
    "sayfa": ${pageNum},
    "test_adi": "Test 1 / Konu adı...",
    "cevaplar": {
      "1": "A",
      "2": "C",
      "3": "E"
    }
  }
]`;

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/png"
          }
        },
        prompt
      ]);

      const text = result.response.text();
      let parsed = [];
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      }
      return parsed;
    } catch (err) {
      console.error(`  ⚠️ Deneme ${attempts}/5 (Sayfa ${pageNum}): ${err.message.substring(0, 80)}...`);
      if (err.message.includes("429") || err.message.includes("quota")) {
        console.log("  ⏳ Kota sınırı (429), 20 saniye bekleniyor...");
        await sleep(20000);
      } else {
        await sleep(3000);
      }
    }
  }
  return [];
}

async function main() {
  console.log("==========================================");
  console.log("📖 RESMİ CEVAP ANAHTARI ÇIKARICI BAŞLADI");
  console.log("==========================================");

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith(".png")).sort((a, b) => {
    const nA = parseInt(a.replace(/\D/g, ""));
    const nB = parseInt(b.replace(/\D/g, ""));
    return nA - nB;
  });

  let allKeys = [];

  for (const file of files) {
    const pageNum = parseInt(file.replace(/\D/g, ""));
    const imagePath = path.join(IMAGES_DIR, file);
    console.log(`\n⏳ Sayfa ${pageNum} (${file}) cevap anahtarları taranıyor...`);

    const keys = await extractKeyFromImage(model, imagePath, pageNum);
    if (Array.isArray(keys) && keys.length > 0) {
      allKeys.push(...keys);
      console.log(`  ✅ Sayfa ${pageNum}'den ${keys.length} test cevap anahtarı çıkarıldı.`);
    } else {
      console.log(`  ℹ️ Sayfa ${pageNum}'de cevap anahtarı bulunamadı veya boş.`);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allKeys, null, 4), "utf-8");
    await sleep(10000);
  }

  console.log(`\n🎉 RESMİ CEVAP ANAHTARLARI TAMAMLANDI! ${OUTPUT_PATH} dosyasına yazıldı.`);
}

main();
