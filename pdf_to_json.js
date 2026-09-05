/**
 * PDF'den KPSS Tarih sorularını çıkaran script (Görsel/Taranmış PDF desteği).
 * Gemini 2.5 Flash'ın vision özelliği ile image-based PDF'leri okur.
 * File API ile büyük dosyaları (>20MB) yükler.
 * 
 * Kullanım: node pdf_to_json.js
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs");
const path = require("path");

// ─── Yapılandırma ──────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY || "";
const PDF_FILENAME = "974140972-Dizgi-Tarih-Cıkmış-1322-Soru-Video-Cozumlu-1_compressed.pdf";
const PDF_PATH = path.join(__dirname, PDF_FILENAME);
const OUTPUT_PATH = path.join(__dirname, "pdf_sorular.json");
const EXISTING_PATH = path.join(__dirname, "sorular.json");
const PROGRESS_PATH = path.join(__dirname, "extraction_progress.json");

const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY);

// ─── Prompt ──────────────────────────────────────────────────
const EXTRACTION_PROMPT = `Bu PDF sayfalarını dikkatlice incele. Bu bir TARANMIŞ (görsel) PDF — resimlerdeki metinleri oku.

Bu bir KPSS Tarih soru bankası kitabı. İçindeki TÜM çoktan seçmeli soruları JSON formatında çıkar.

HER SORU İÇİN:
- "ders": "Tarih"
- "konu": Bölüm/ünite başlığına göre belirle. Olası değerler:
  * "İslam Öncesi Türk Tarihi"
  * "İlk Türk İslam Devletleri"  
  * "Beylikler Dönemi ve Türkiye Selçuklu Devleti"
  * "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri"
  * "Osmanlı Kültür ve Medeniyeti"
  * "Osmanlı Devleti Gerileme ve Dağılma Dönemleri"
  * "Kurtuluş Savaşı ve İnkılaplar"
  * "Çağdaş Türk ve Dünya Tarihi"
  * veya PDF'deki başlığa uygun başka bir konu
- "yil": Sorunun çıktığı yıl (genelde sorunun üstünde veya yanında yazar, örn: "2024 KPSS")
- "sinav": Sınav türü (KPSS-GYGK-LİSANS, AYT, TYT, MSÜ, MEB-EKYS, EKPSS-ÖNLİSANS, vb.)
- "soru_koku": Soru metninin TAMAMI (şıklar hariç). Metni olduğu gibi oku, değiştirme.
- "secenekler": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."} — bazı sorularda 4 şık (A-D) olabilir
- "dogru_cevap": Doğru şık harfi. Eğer sayfada belirtilmemişse boş string "" yaz.

ÖNEMLİ KURALLAR:
1. Bu görsel bir PDF — resimleri dikkatlice oku, OCR yap
2. Sadece SORULARI çıkar. Cevap anahtarı, açıklama, çözüm bölümlerini ATLA
3. Eğer bir sayfada soru yoksa (sadece başlık, açıklama veya cevap anahtarı varsa) o sayfayı atla
4. Soru numaralarını takip et (1., 2., 3., ... gibi)
5. Türkçe karakterleri doğru yaz (ş, ç, ö, ü, ğ, ı, İ)
6. Her sorunun tam metnini kopyala — eksik bırakma

Yanıt olarak SADECE bir JSON array döndür, başka hiçbir metin ekleme:
[{"ders":"Tarih","konu":"...","yil":2024,"sinav":"...","soru_koku":"...","secenekler":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"dogru_cevap":"A"}]`;

// ─── Ana Fonksiyonlar ─────────────────────────────────────────

async function uploadPDF() {
  console.log("📤 PDF dosyası Gemini File API'ye yükleniyor...");
  console.log(`   Dosya: ${PDF_FILENAME}`);
  console.log(`   Boyut: ${(fs.statSync(PDF_PATH).size / (1024 * 1024)).toFixed(1)} MB`);

  const uploadResult = await fileManager.uploadFile(PDF_PATH, {
    mimeType: "application/pdf",
    displayName: "KPSS Tarih Çıkmış Sorular",
  });

  console.log(`✅ Yükleme tamamlandı! URI: ${uploadResult.file.uri}`);
  console.log(`   Durum: ${uploadResult.file.state}`);

  // Dosyanın işlenmesini bekle
  let file = uploadResult.file;
  while (file.state === "PROCESSING") {
    console.log("⏳ Dosya işleniyor, 10 saniye bekleniyor...");
    await sleep(10000);
    file = await fileManager.getFile(file.name);
  }

  if (file.state === "FAILED") {
    throw new Error("Dosya işleme başarısız oldu: " + JSON.stringify(file));
  }

  console.log(`✅ Dosya hazır! State: ${file.state}`);
  return file;
}

async function extractQuestions(file) {
  console.log("\n🤖 Gemini Vision ile sorular çıkarılıyor...");
  console.log("   (Bu işlem görsel PDF olduğu için 5-15 dakika sürebilir)\n");

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
  });

  // İlk önce PDF'nin yapısını öğren
  console.log("📊 PDF yapısı analiz ediliyor...");
  const structModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  });

  const structResult = await structModel.generateContent([
    {
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri,
      },
    },
    { text: "Bu PDF kaç sayfadan oluşuyor? İçindeki bölüm başlıkları ve sayfa numaraları neler? Hangi sayfa aralıklarında sorular var, hangi sayfalarda cevap anahtarı var? Kısa bir özet ver." },
  ]);
  
  console.log("📋 PDF Yapısı:");
  console.log(structResult.response.text());
  console.log("");

  // Soruları çıkar — büyük PDF'ler için tek seferde deniyoruz
  // Gemini 2.5 Flash vision ile tüm sayfaları tarayabilir
  console.log("📝 Sorular çıkarılıyor (tam PDF taraması)...");
  
  const result = await model.generateContent([
    {
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri,
      },
    },
    { text: EXTRACTION_PROMPT },
  ]);

  const responseText = result.response.text();
  console.log(`📦 Yanıt alındı: ${responseText.length} karakter`);

  // JSON parse
  let questions;
  try {
    questions = JSON.parse(responseText);
  } catch (e) {
    // JSON array'i bulmaya çalış
    const match = responseText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        questions = JSON.parse(match[0]);
      } catch (e2) {
        console.error("❌ JSON parse hatası. Ham yanıt kaydediliyor...");
        fs.writeFileSync(path.join(__dirname, "raw_response.txt"), responseText, "utf-8");
        console.log("   raw_response.txt dosyasını kontrol edin.");
        return null;
      }
    } else {
      console.error("❌ Yanıtta JSON array bulunamadı. Ham yanıt kaydediliyor...");
      fs.writeFileSync(path.join(__dirname, "raw_response.txt"), responseText, "utf-8");
      return null;
    }
  }

  if (!Array.isArray(questions)) {
    console.error("❌ Yanıt bir array değil:", typeof questions);
    return null;
  }

  console.log(`✅ ${questions.length} soru çıkarıldı!`);
  return questions;
}

async function processAndSave(questions) {
  if (!questions || questions.length === 0) {
    console.log("⚠️ Çıkarılacak soru bulunamadı.");
    return;
  }

  // ID'leri ekle
  questions = questions.map((q, i) => ({
    id: i + 1,
    ders: q.ders || "Tarih",
    konu: q.konu || "Belirtilmemiş",
    yil: q.yil || 0,
    sinav: q.sinav || "",
    soru_koku: q.soru_koku || "",
    secenekler: q.secenekler || {},
    dogru_cevap: q.dogru_cevap || "",
  }));

  // Boş soruları filtrele
  questions = questions.filter(q => q.soru_koku && q.soru_koku.length > 10);
  console.log(`📋 Geçerli soru sayısı: ${questions.length}`);

  // PDF'den çıkarılan soruları kaydet
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(questions, null, 4), "utf-8");
  console.log(`💾 PDF soruları kaydedildi: ${OUTPUT_PATH}`);

  // İstatistikler
  const konuDagilimi = {};
  questions.forEach(q => {
    konuDagilimi[q.konu] = (konuDagilimi[q.konu] || 0) + 1;
  });
  console.log("\n📊 Çıkarılan Soruların Konu Dağılımı:");
  Object.entries(konuDagilimi)
    .sort((a, b) => b[1] - a[1])
    .forEach(([konu, count]) => {
      console.log(`   ${konu}: ${count}`);
    });

  // Mevcut sorularla birleştir
  await mergeWithExisting(questions);
}

async function mergeWithExisting(newQuestions) {
  console.log("\n🔗 Mevcut sorular.json ile birleştiriliyor...");

  let existing = [];
  if (fs.existsSync(EXISTING_PATH)) {
    existing = JSON.parse(fs.readFileSync(EXISTING_PATH, "utf-8"));
    console.log(`📋 Mevcut soru sayısı: ${existing.length}`);
  }

  // Duplikasyon kontrolü: soru kökünün normalize edilmiş ilk 80 karakteri
  const normalize = (text) => 
    text.toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/["""'']/g, "")
      .trim()
      .substring(0, 80);

  const existingFingerprints = new Set(
    existing.map(q => normalize(q.soru_koku))
  );

  const uniqueNew = newQuestions.filter(q => {
    if (!q.soru_koku || q.soru_koku.length < 10) return false;
    return !existingFingerprints.has(normalize(q.soru_koku));
  });

  const dupCount = newQuestions.length - uniqueNew.length;
  console.log(`🆕 Yeni benzersiz soru: ${uniqueNew.length}`);
  console.log(`🔄 Duplikasyon (atlandı): ${dupCount}`);

  // ID'leri yeniden numarala
  const maxId = existing.length > 0 ? Math.max(...existing.map(q => q.id)) : 0;
  const reNumbered = uniqueNew.map((q, i) => ({
    ...q,
    id: maxId + i + 1,
  }));

  const merged = [...existing, ...reNumbered];

  // Birleştirilmiş dosyayı kaydet (güvenlik için ayrı dosya)
  const mergedPath = path.join(__dirname, "sorular_merged.json");
  fs.writeFileSync(mergedPath, JSON.stringify(merged, null, 4), "utf-8");
  
  console.log(`\n💾 Birleştirilmiş dosya: sorular_merged.json`);
  console.log(`   Toplam: ${merged.length} soru (${existing.length} eski + ${uniqueNew.length} yeni)`);
  console.log(`\n✨ İşlem tamamlandı!`);
  console.log(`   → sorular_merged.json dosyasını kontrol edin.`);
  console.log(`   → Doğru görünüyorsa, sorular.json olarak yeniden adlandırabilirsiniz.`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Çalıştır ──────────────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log("📚 KPSS Tarih PDF → JSON Çıkarıcı");
  console.log("   Gemini 2.5 Flash Vision ile görsel PDF tarama");
  console.log("═".repeat(60));
  console.log("");

  try {
    // 1. PDF'yi yükle
    const file = await uploadPDF();

    // 2. Soruları çıkar
    const questions = await extractQuestions(file);

    // 3. İşle ve kaydet
    await processAndSave(questions);

    // 4. Yüklenen dosyayı temizle
    try {
      await fileManager.deleteFile(file.name);
      console.log("\n🗑️ Yüklenen dosya Gemini'den silindi.");
    } catch (e) {
      // Silme başarısız olsa da sorun değil
    }

  } catch (error) {
    console.error("\n❌ Hata oluştu:", error.message);
    
    if (error.message.includes("quota") || error.message.includes("rate")) {
      console.log("\n💡 API kotası aşılmış olabilir. Birkaç dakika bekleyip tekrar deneyin.");
    } else if (error.message.includes("too large") || error.message.includes("size")) {
      console.log("\n💡 Dosya çok büyük. PDF'yi daha küçük parçalara bölmeyi deneyin.");
    }
    
    console.error("\nDetaylı hata:", error);
  }
}

main();
