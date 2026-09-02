/**
 * KPSS Tarih sorularını analiz edip örüntü raporu çıkaran script.
 * 
 * Kullanım: node analyze_questions.js
 */

const fs = require("fs");
const path = require("path");

const SORULAR_PATH = path.join(__dirname, "sorular.json");

function loadQuestions() {
  const raw = fs.readFileSync(SORULAR_PATH, "utf-8");
  return JSON.parse(raw);
}

function analyzeQuestions(questions) {
  console.log("=".repeat(60));
  console.log("📊 KPSS TARİH SORU ANALİZ RAPORU");
  console.log("=".repeat(60));
  console.log(`\n📌 Toplam Soru: ${questions.length}`);

  // 1. Konu dağılımı
  console.log("\n" + "─".repeat(40));
  console.log("📚 KONU DAĞILIMI");
  console.log("─".repeat(40));
  const konuGruplari = groupBy(questions, "konu");
  const konuSirali = Object.entries(konuGruplari).sort((a, b) => b[1].length - a[1].length);
  konuSirali.forEach(([konu, sorular]) => {
    const yuzde = ((sorular.length / questions.length) * 100).toFixed(1);
    console.log(`  ${konu}: ${sorular.length} soru (${yuzde}%)`);
  });

  // 2. Yıl dağılımı
  console.log("\n" + "─".repeat(40));
  console.log("📅 YIL DAĞILIMI");
  console.log("─".repeat(40));
  const yilGruplari = groupBy(questions, "yil");
  Object.keys(yilGruplari).sort().forEach(yil => {
    const bar = "█".repeat(Math.ceil(yilGruplari[yil].length / 2));
    console.log(`  ${yil}: ${String(yilGruplari[yil].length).padStart(3)} ${bar}`);
  });

  // 3. Sınav türü dağılımı
  console.log("\n" + "─".repeat(40));
  console.log("🎯 SINAV TÜRÜ DAĞILIMI");
  console.log("─".repeat(40));
  const sinavGruplari = groupBy(questions, "sinav");
  Object.entries(sinavGruplari)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([sinav, sorular]) => {
      console.log(`  ${sinav}: ${sorular.length}`);
    });

  // 4. Doğru cevap dağılımı
  console.log("\n" + "─".repeat(40));
  console.log("✅ DOĞRU CEVAP DAĞILIMI");
  console.log("─".repeat(40));
  const cevapGruplari = groupBy(questions, "dogru_cevap");
  ["A", "B", "C", "D", "E"].forEach(sik => {
    const count = (cevapGruplari[sik] || []).length;
    const yuzde = ((count / questions.length) * 100).toFixed(1);
    const bar = "█".repeat(Math.ceil(count / 2));
    console.log(`  ${sik}: ${String(count).padStart(3)} (${yuzde}%) ${bar}`);
  });

  // 5. Soru tipi analizi (anahtar kelime tabanlı)
  console.log("\n" + "─".repeat(40));
  console.log("📝 SORU TİPİ ANALİZİ");
  console.log("─".repeat(40));
  const soruTipleri = {
    "Çıkarım (hangilerine ulaşılabilir)": q => 
      q.soru_koku.includes("ulaşılabilir") || q.soru_koku.includes("ulaşıla bilir"),
    "Olumsuz (söylenemez/değildir)": q => 
      q.soru_koku.includes("söylenemez") || q.soru_koku.includes("değildir") || 
      q.soru_koku.includes("biri değil") || q.soru_koku.includes("hangisi yanlış"),
    "Ulaşılamaz (hangisine ulaşılamaz)": q =>
      q.soru_koku.includes("ulaşılamaz") || q.soru_koku.includes("çıkarılamaz"),
    "Bilgi (hangisidir)": q => 
      q.soru_koku.includes("hangisidir") || q.soru_koku.includes("hangisi doğru"),
    "Eşleştirme": q => 
      q.soru_koku.includes("eşleştirme") || q.soru_koku.includes("eşleştirildiğinde"),
    "Hangileri etkili/doğru": q =>
      q.soru_koku.includes("hangileri") && !q.soru_koku.includes("ulaşılabilir"),
    "Vurgulama (hangisi vurgulanmaktadır)": q =>
      q.soru_koku.includes("vurgulan") || q.soru_koku.includes("kanıt"),
  };

  Object.entries(soruTipleri).forEach(([tip, filter]) => {
    const count = questions.filter(filter).length;
    const yuzde = ((count / questions.length) * 100).toFixed(1);
    console.log(`  ${tip}: ${count} (${yuzde}%)`);
  });

  // 6. En sık geçen kavramlar
  console.log("\n" + "─".repeat(40));
  console.log("🔑 EN SIK GEÇEN KAVRAMLAR");
  console.log("─".repeat(40));
  const kavramlar = [
    "Kut", "Töre", "Kurultay", "İkili teşkilat", "Yabgu", "Kağan", 
    "Otağ", "Balbal", "Kurgan", "Tigin", "Budun", "Oguş", "Urug",
    "Hatun", "Şad", "Tuğ", "Örgin", "Ayguci", "Aygucı",
    "Mete", "Attila", "Bumin", "Bilge Kağan", "Kutluk", "Tonyukuk",
    "Göktürk", "Kök Türk", "Uygur", "Hun", "Avar", "Hazar", 
    "Kıpçak", "Peçenek", "Karluk", "Kırgız", "Oğuz",
    "Orhun", "Maniheizm", "Budizm", "Şamanizm", "Göktanrı", "Gök Tanrı",
    "cihan hâkimiyeti", "cihan hakimiyeti",
    "Kavimler Göçü",
    "Selçuklu", "Osmanlı", "Beylik",
    "Divan", "Tımar", "İltizam", "Vakıf", "Kapıkulu",
    "Devşirme", "Yeniçeri", "Sadrazam", "Enderun",
    "Fatih", "Kanuni", "Yavuz", "II. Mehmet",
    "Malazgirt", "İstanbul", "Miryokefalon", "Kösedağ", "Ankara",
    "Medrese", "Kervansaray", "Cami", "Külliye", "İmaret",
  ];

  const kavramFrekans = {};
  kavramlar.forEach(kavram => {
    const count = questions.filter(q => 
      q.soru_koku.toLowerCase().includes(kavram.toLowerCase())
    ).length;
    if (count > 0) {
      kavramFrekans[kavram] = count;
    }
  });

  Object.entries(kavramFrekans)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([kavram, count]) => {
      const bar = "█".repeat(count);
      console.log(`  ${kavram}: ${count} ${bar}`);
    });

  // 7. Konu bazlı yıl trendi
  console.log("\n" + "─".repeat(40));
  console.log("📈 KONU BAZLI YIL TRENDİ (Son 5 Yıl)");
  console.log("─".repeat(40));
  const sonYillar = [2020, 2021, 2022, 2023, 2024, 2025];
  konuSirali.forEach(([konu]) => {
    console.log(`\n  ${konu}:`);
    sonYillar.forEach(yil => {
      const count = questions.filter(q => q.konu === konu && q.yil === yil).length;
      const bar = "█".repeat(count);
      console.log(`    ${yil}: ${String(count).padStart(2)} ${bar}`);
    });
  });

  // 8. Tekrar eden temalar (benzer soru tespiti)
  console.log("\n" + "─".repeat(40));
  console.log("🔄 TEKRAR EDEN TEMALAR");
  console.log("─".repeat(40));
  
  // Basit benzerlik: aynı konu + benzer anahtar kelimeler
  const temaGruplari = {};
  questions.forEach(q => {
    const keywords = extractKeywords(q.soru_koku);
    const tema = `${q.konu} | ${keywords.slice(0, 3).join(", ")}`;
    if (!temaGruplari[tema]) temaGruplari[tema] = [];
    temaGruplari[tema].push({ yil: q.yil, sinav: q.sinav, id: q.id });
  });

  Object.entries(temaGruplari)
    .filter(([_, items]) => items.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15)
    .forEach(([tema, items]) => {
      console.log(`\n  🔹 ${tema} (${items.length} kez)`);
      items.forEach(item => {
        console.log(`     - ${item.yil} ${item.sinav} (id:${item.id})`);
      });
    });

  // Raporu dosyaya kaydet
  return generateReport(questions, konuSirali, kavramFrekans, soruTipleri);
}

function extractKeywords(text) {
  const stopWords = new Set([
    "bir", "bu", "ile", "ve", "için", "da", "de", "den", "dan", "ki",
    "ne", "mi", "mı", "mu", "mü", "dır", "dir", "dur", "dür",
    "olan", "olan", "olarak", "gibi", "çok", "daha", "sonra", "önce",
    "aşağıdakilerden", "hangisi", "hangisine", "hangileri", "hangilerine",
    "buna", "göre", "ilgili", "aşağıda", "yukarıdaki", "yukarıdakilerden",
    "yalnız", "yer", "alan", "almış", "etmiş", "olduğu", "olduğuna",
    "söylenemez", "ulaşılabilir", "ulaşılamaz", "verilmiştir", "bilgi",
    "verilen", "ifadelerinden", "çıkarımlarından", "durumlarından",
    "arasında", "tarafından", "üzerine", "karşı", "olduğu",
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\wşçöüğıİ\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // Frekansa göre sırala
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 5);
}

function generateReport(questions, konuSirali, kavramFrekans, soruTipleri) {
  let report = `# KPSS Tarih Soru Analiz Raporu\n\n`;
  report += `> Analiz Tarihi: ${new Date().toLocaleDateString("tr-TR")}\n`;
  report += `> Toplam Soru: **${questions.length}**\n\n`;

  report += `## Konu Dağılımı\n\n`;
  report += `| Konu | Soru Sayısı | Oran |\n|------|------------|------|\n`;
  konuSirali.forEach(([konu, sorular]) => {
    const yuzde = ((sorular.length / questions.length) * 100).toFixed(1);
    report += `| ${konu} | ${sorular.length} | ${yuzde}% |\n`;
  });

  report += `\n## En Sık Geçen Kavramlar (Top 20)\n\n`;
  report += `| Kavram | Frekans |\n|--------|--------|\n`;
  Object.entries(kavramFrekans)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([kavram, count]) => {
      report += `| ${kavram} | ${count} |\n`;
    });

  report += `\n## Soru Tipi Dağılımı\n\n`;
  report += `| Soru Tipi | Sayı | Oran |\n|-----------|------|------|\n`;
  Object.entries(soruTipleri).forEach(([tip, filter]) => {
    const count = questions.filter(filter).length;
    const yuzde = ((count / questions.length) * 100).toFixed(1);
    report += `| ${tip} | ${count} | ${yuzde}% |\n`;
  });

  report += `\n## ÖSYM Soru Hazırlama Eğilimleri\n\n`;
  report += `### Gözlemlenen Örüntüler\n\n`;
  report += `1. **Kavram bazlı tekrar**: Kut, Töre, İkili Teşkilat gibi temel kavramlar her yıl farklı açılardan sorulmaktadır.\n`;
  report += `2. **Metin tabanlı çıkarım**: Soruların büyük çoğunluğu bir metin/alıntı verip "bu metinden hangilerine ulaşılabilir?" formatındadır.\n`;
  report += `3. **Olumsuz soru kalıbı**: "Hangisi söylenemez?", "Hangisi değildir?" gibi olumsuz kalıplar sıkça kullanılmaktadır.\n`;
  report += `4. **Çeldirici mantığı**: Doğru gibi görünen ama metinde yer almayan bilgiler çeldirici olarak kullanılmaktadır.\n`;

  const reportPath = path.join(__dirname, "analiz_raporu.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`\n📄 Rapor kaydedildi: ${reportPath}`);
  return report;
}

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const val = item[key];
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
    return groups;
  }, {});
}

// Çalıştır
const questions = loadQuestions();
analyzeQuestions(questions);
