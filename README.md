# 📚 KPSS Tarih Soru Portalı & AI Soru Avcısı 🤖

ÖSYM'nin geçmiş tüm KPSS, YKS, EKPSS çıkmış soru kalıplarını analiz eden, yapay zeka desteğiyle özgün soru üreten, canlı web taramasıyla zor derece soruları avlayan ve mobil uyumlu soru çözme platformu.

---

## 🌟 Öne Çıkan Özellikler

- 📚 **1.348 Çıkmış Soru Bankası**: 2007-2025 yılları arası tüm KPSS Lisans/Önlisans/Ortaöğretim ve ÖSYM tarih soruları.
- 🤖 **201 AI Özgün Soru**: ÖSYM soru hazırlama standartlarında Gemini 2.5 Flash ile üretilmiş 5 şıklı, detaylı çözüm açıklamalı özgün soru deposu.
- 🎯 **Zor Soru Avcısı & AI Kalite Kontrolü**: Google Search canlı aramasıyla internet denemelerinden taranan ve **Fact-Checker AI** denetiminden geçen derece seviyesi zor sorular.
- 📖 **Yanlış Sorular Defteri**: Hatalı cevapladığınız soruları konularına göre gruplar ve tekrar çözerek eksiklerinizi kapatmanızı sağlar.
- 🚩 **Soru Hatalı Bildir / Raporlama**: Soru kartlarında yer alan butonla hatalı şık ve bilgi bildirim penceresi.
- ⏰ **GitHub Actions Otomatik Güncelleme**: Her gün otomatik çalışan workflow ile sisteme yeni sorular eklenir.
- ☀️ / 🌙 **Aydınlık & Karanlık Tema**: Tek tıkla tema değiştirme ve mobil uyumlu dokunmatik arayüz.

---

## 📊 Soru Veritabanı Dağılımı

| Kategori | Soru Sayısı | Açıklama |
| :--- | :---: | :--- |
| 📚 **Çıkmış Sorular** (`sorular.json`) | **1.348** | Gerçek ÖSYM Sınav Soruları |
| 🤖 **AI Özgün Sorular** (`uretilen_sorular.json`) | **201** | Çözümlü Özgün Yapay Zeka Soruları |
| 🎯 **Zor Soru Avcısı** (`avlanan_zor_sorular.json`) | **45** | Canlı İnternet Taraması Derece Soruları |
| 🌟 **TOPLAM SORU** | **1.594** | Toplam Çözülebilir Soru Portalı |

---

## 🚀 Yerel Kurulum & Çalıştırma

```bash
# 1. Depoyu klonlayın veya indirin
git clone https://github.com/kullaniciadi/kpss-tarama-botu.git
cd kpss-tarama-botu

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirici sunucusunu başlatın (Yerel Ağ ve Mobil Erişilebilir)
npm run dev
```

Sunucu başladıktan sonra tarayıcınızda veya cep telefonunuzda açabilirsiniz:
- Masaüstü: `http://localhost:3000`
- Mobil / Yerel Ağ: `http://192.168.1.41:3000`

---

## 🤖 GitHub Actions Entegrasyonu (Otomatik Soru Üretimi)

GitHub Repository ayarlarınızda **Secrets and Variables > Actions** kısmına aşağıdaki Key'i ekleyin:

- `GEMINI_API_KEY`: Gemini API Anahtarınız

Workflow her sabah 06:00 UTC'de otomatik çalışacak ve yeni soruları repoya ekleyecektir.
