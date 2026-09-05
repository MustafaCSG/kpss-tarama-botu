/**
 * Eksik cevap anahtarlarını (dogru_cevap == "") Gemini AI ile otomatik çözen script.
 * Rate-limit (429) koruması ve otomatik retry mekanizması içerir.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const PDF_PATH = path.join(__dirname, "pdf_extracted_all.json");
const SORULAR_PATH = path.join(__dirname, "sorular.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solveBatchWithRetry(model, questionsBatch) {
  const promptQuestions = questionsBatch.map((q, idx) => ({
    batchIndex: idx,
    id: q.id,
    konu: q.konu,
    soru_koku: q.soru_koku,
    secenekler: q.secenekler
  }));

  const prompt = `Sen ÖSYM Tarih Soru Komisyonu Başkanısın.
Aşağıda cevabı eksik olan KPSS Tarih soruları verilmiştir. Her soruyu tarihsel gerçeklere göre analiz et, DOĞRU CEVAP ŞIKKINI (A, B, C, D veya E) ve 1 cümlelik net açıklamasını belirle.

İNCELENECEK SORULAR:
${JSON.stringify(promptQuestions, null, 2)}

ÇIKTI FORMATI:
Sadece ve sadece aşağıdaki JSON array formatını döndür (başka metin ekleme):
[
  {
    "batchIndex": 0,
    "dogru_cevap": "C",
    "aciklama": "Açıklama..."
  }
]`;

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
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
      return parsed;
    } catch (err) {
      console.error(`  ⚠️ Deneme ${attempts}/5 başarısız: ${err.message.substring(0, 100)}...`);
      if (err.message.includes("429") || err.message.includes("quota") || err.message.includes("Quota")) {
        console.log("  ⏳ Kota sınırı (429), 25 saniye bekleniyor...");
        await sleep(25000);
      } else {
        await sleep(5000);
      }
    }
  }
  return [];
}

async function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📂 Dosya işleniyor: ${path.basename(filePath)}`);
  
  const questions = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const missingIndices = [];

  questions.forEach((q, idx) => {
    if (!q.dogru_cevap || q.dogru_cevap.trim() === "") {
      missingIndices.push(idx);
    }
  });

  console.log(`📊 Toplam Soru: ${questions.length} | Eksik Cevaplı Soru: ${missingIndices.length}`);

  if (missingIndices.length === 0) {
    console.log("✨ Bu dosyada tüm cevaplar tamamlanmış!");
    return;
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });

  const BATCH_SIZE = 25;
  let solvedCount = 0;

  for (let i = 0; i < missingIndices.length; i += BATCH_SIZE) {
    const chunkIndices = missingIndices.slice(i, i + BATCH_SIZE);
    const chunkQuestions = chunkIndices.map(idx => questions[idx]);

    console.log(`\n⏳ Batch [${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingIndices.length / BATCH_SIZE)}] - ${chunkQuestions.length} soru çözülüyor...`);
    
    const answers = await solveBatchWithRetry(model, chunkQuestions);

    if (Array.isArray(answers) && answers.length > 0) {
      let batchSolved = 0;
      answers.forEach(ans => {
        if (ans.batchIndex !== undefined && ans.batchIndex < chunkIndices.length) {
          const targetIdx = chunkIndices[ans.batchIndex];
          const letter = (ans.dogru_cevap || "").trim().toUpperCase();
          if (["A", "B", "C", "D", "E"].includes(letter)) {
            questions[targetIdx].dogru_cevap = letter;
            if (ans.aciklama) {
              questions[targetIdx].aciklama = ans.aciklama;
            }
            batchSolved++;
          }
        }
      });
      solvedCount += batchSolved;
      console.log(`  ✅ Bu batch'te ${batchSolved} cevap başarıyla dolduruldu. Toplam Çözülen: ${solvedCount}/${missingIndices.length}`);
    } else {
      console.log(`  ❌ Bu batch atlandı.`);
    }

    fs.writeFileSync(filePath, JSON.stringify(questions, null, 4), "utf-8");
    await sleep(13000);
  }

  console.log(`\n🎉 ${path.basename(filePath)} dosyasındaki ${solvedCount} soru tamamlandı!`);
}

async function main() {
  console.log("==========================================");
  console.log("🤖 EKSİK CEVAP ANAHTARI ÇÖZÜCÜ BAŞLADI");
  console.log("==========================================");

  await processFile(PDF_PATH);
  await processFile(SORULAR_PATH);

  console.log("\n✨ TÜM EKSİK CEVAPLAR BAŞARIYLA ÇÖZÜLDÜ!");
}

main();
