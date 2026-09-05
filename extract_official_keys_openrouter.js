/**
 * OpenRouter Vision API ile cevapanahtaritarih.pdf görsellerinden resmi cevap anahtarlarını çıkaran script.
 */

const fs = require("fs");
const path = require("path");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const IMAGES_DIR = path.join(__dirname, "key_images");
const OUTPUT_PATH = path.join(__dirname, "official_answer_keys.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractKeyFromImageOpenRouter(imagePath, pageNum) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Img = imageBuffer.toString("base64");

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

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${base64Img}` } }
            ]
          }
        ],
        max_tokens: 3000
      })
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error(`  ❌ Sayfa ${pageNum} OpenRouter hatası:`, JSON.stringify(data));
      return [];
    }

    const text = data.choices[0].message.content.trim();
    let parsed = [];
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
    }
    return parsed;
  } catch (err) {
    console.error(`  ❌ Sayfa ${pageNum} hata:`, err.message);
    return [];
  }
}

async function main() {
  console.log("==========================================");
  console.log("📖 OPENROUTER VISION İLE CEVAP ANAHTARI ÇIKARICI");
  console.log("==========================================");

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith(".png")).sort((a, b) => {
    const nA = parseInt(a.replace(/\D/g, ""));
    const nB = parseInt(b.replace(/\D/g, ""));
    return nA - nB;
  });

  let allKeys = [];

  for (const file of files) {
    const pageNum = parseInt(file.replace(/\D/g, ""));
    const imagePath = path.join(IMAGES_DIR, file);
    console.log(`\n⏳ Sayfa ${pageNum} (${file}) taranıyor...`);

    const keys = await extractKeyFromImageOpenRouter(imagePath, pageNum);
    if (Array.isArray(keys) && keys.length > 0) {
      allKeys.push(...keys);
      console.log(`  ✅ Sayfa ${pageNum}'den ${keys.length} test cevap anahtarı çıkarıldı.`);
    } else {
      console.log(`  ℹ️ Sayfa ${pageNum}'de test tablosu bulunamadı.`);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allKeys, null, 4), "utf-8");
    await sleep(1500);
  }

  console.log(`\n🎉 TÜM RESMİ CEVAP ANAHTARLARI TAMAMLANDI! ${OUTPUT_PATH} dosyasına yazıldı.`);
}

main();
