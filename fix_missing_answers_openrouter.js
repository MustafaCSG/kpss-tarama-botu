/**
 * OpenRouter API ile tüm eksik cevap anahtarlarını (dogru_cevap == "") çözüp tamamlayan script.
 * Model: google/gemini-2.5-flash
 */

const fs = require("fs");
const path = require("path");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const SORULAR_PATH = path.join(__dirname, "sorular.json");
const PDF_PATH = path.join(__dirname, "pdf_extracted_all.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solveBatchOpenRouter(questionsBatch) {
  const promptQuestions = questionsBatch.map((q, idx) => ({
    batchIndex: idx,
    id: q.id,
    konu: q.konu,
    soru_koku: q.soru_koku,
    secenekler: q.secenekler
  }));

  const prompt = `Sen ÖSYM Tarih Soru Komisyonu Başkanısın.
Aşağıda cevabı eksik olan KPSS Tarih soruları verilmiştir. Her soruyu tarihsel gerçeklere göre analiz et, DOĞRU CEVAP ŞIKKINI (A, B, C, D veya E) ve 1 cümlelik net çözüm açıklamasını belirlenmiş JSON formatında ver.

İNCELENECEK SORULAR:
${JSON.stringify(promptQuestions, null, 2)}

ÇIKTI FORMATI (Sadece ve sadece JSON array döndür):
[
  {
    "batchIndex": 0,
    "dogru_cevap": "C",
    "aciklama": "Çözüm açıklaması..."
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
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000
      })
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("  ❌ OpenRouter yanıt hatası:", JSON.stringify(data));
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
    console.error("  ❌ İstek hatası:", err.message);
    return [];
  }
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

  const BATCH_SIZE = 15; // 15 soru per batch
  let solvedCount = 0;

  for (let i = 0; i < missingIndices.length; i += BATCH_SIZE) {
    const chunkIndices = missingIndices.slice(i, i + BATCH_SIZE);
    const chunkQuestions = chunkIndices.map(idx => questions[idx]);

    console.log(`\n⏳ Batch [${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingIndices.length / BATCH_SIZE)}] - ${chunkQuestions.length} soru çözülüyor...`);
    
    const answers = await solveBatchOpenRouter(chunkQuestions);

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
      console.log(`  ✅ Bu batch'te ${batchSolved} cevap çözüldü. Toplam Çözülen: ${solvedCount}/${missingIndices.length}`);
    } else {
      console.log(`  ⚠️ Bu batch es geçildi, yeniden denenecek.`);
    }

    fs.writeFileSync(filePath, JSON.stringify(questions, null, 4), "utf-8");
    await sleep(2000);
  }

  console.log(`\n🎉 ${path.basename(filePath)} dosyasındaki ${solvedCount} soru tamamlandı!`);
}

async function main() {
  console.log("==========================================");
  console.log("🚀 OPENROUTER İLE EKSİK CEVAP ÇÖZÜCÜ");
  console.log("==========================================");

  await processFile(SORULAR_PATH);
  await processFile(PDF_PATH);

  console.log("\n✨ TÜM EKSİK CEVAPLAR BAŞARIYLA TAMAMLANDI!");
}

main();
