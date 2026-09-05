import os
import sys
import json
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import fitz  # PyMuPDF
import google.generativeai as genai

API_KEY = os.environ.get("GEMINI_API_KEY", "")
genai.configure(api_key=API_KEY)

PDF_PATH = "oabt-tarih-cikmis.pdf"
OUTPUT_JSON = "oabt_extracted_questions.json"
PROGRESS_JSON = "oabt_progress.json"

VALID_TOPICS = [
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
]

SYSTEM_PROMPT = f"""Sen ÖSYM ÖABT Tarih sorularını KPSS Genel Kültür Tarih müfredatına göre ayıran uzman bir tarihçisin.
Sana verilen ÖABT Tarih PDF sayfalarındaki çoktan seçmeli soruları incele.

## SADECE AŞAĞIDAKİ 10 KPSS TARİH KONUSUNA GİREN SORULARI ÇIKAR:
1. "İslam Öncesi Türk Tarihi"
2. "İlk Türk İslam Devletleri"
3. "Beylikler Dönemi ve Türkiye Selçuklu Devleti"
4. "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri"
5. "Osmanlı Kültür ve Medeniyeti"
6. "XVII, XVIII ve XIX. Yüzyılda Osmanlı Devleti ve Islahatlar"
7. "XX. Yüzyıl Başlarında Osmanlı Devleti ve İnkılap Tarihi"
8. "Milli Mücadele Dönemi (Hazırlık, Cepheler ve Diplomasi)"
9. "Atatürk Dönemi İç ve Dış Politika & İnkılaplar"
10. "Çağdaş Türk ve Dünya Tarihi"

## KONU DIŞI SORULAR (BUNLARI "KONU_DISI" OLARAK İŞARETLE VEYA ATLA):
- Tarih Metodolojisi, Tarih Yazıcılığı, Tarih Felsefesi, Tarih Eğitimi/Pedagojisi
- Eski Çağ Tarihi (Sümer, Mısır, Hitit, İyonya, Yunan, Roma, Mezopotamya vb.)
- Orta Çağ / Yeni Çağ Avrupa Tarihi (Türk/Osmanlı ile doğrudan ilgisi olmayan konular)

## HER GEÇERLİ SORU İÇİN ÇIKTI FORMATI (JSON ARRAY):
[
  {{
    "ders": "Tarih",
    "konu": "Yukarıdaki 10 konudan tam birebir ismi veya 'KONU_DISI'",
    "yil": 2023,
    "sinav": "ÖABT-TARİH",
    "soru_koku": "Soru metninin tamamı...",
    "secenekler": {{
      "A": "Metin A",
      "B": "Metin B",
      "C": "Metin C",
      "D": "Metin D",
      "E": "Metin E"
    }},
    "dogru_cevap": "Doğru şık harfi (A-E). Eğer sayfada varsa yaz, yoksa doğru şıkkı analiz edip yaz",
    "aciklama": "Kısa 1 cümlelik çözüm açıklaması"
  }}
]

ÖNEMLİ: Sadece ve sadece JSON array döndür, başka açıklama ekleme.
"""

def extract_chunk(start_page, end_page, doc):
    chunk_doc = fitz.open()
    chunk_doc.insert_pdf(doc, from_page=start_page, to_page=end_page)
    chunk_filename = f"temp_oabt_chunk_{start_page+1}_{end_page+1}.pdf"
    chunk_doc.save(chunk_filename)
    chunk_doc.close()
    
    print(f"[+] Chunk yükleniyor: Sayfa {start_page+1}-{end_page+1} ({os.path.getsize(chunk_filename)/1024:.1f} KB)...")
    uploaded_file = None
    try:
        uploaded_file = genai.upload_file(chunk_filename, mime_type="application/pdf")
        
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)
            
        if uploaded_file.state.name == "FAILED":
            print(f"[!] Yükleme başarısız: Sayfa {start_page+1}-{end_page+1}")
            if os.path.exists(chunk_filename):
                try: os.remove(chunk_filename)
                except: pass
            return []

        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            generation_config={"temperature": 0.1, "response_mime_type": "application/json"}
        )
        
        print(f"[*] Sayfa {start_page+1}-{end_page+1} Gemini 3.6 Flash Vision ile taranıyor...")
        response = model.generate_content([uploaded_file, SYSTEM_PROMPT])
        text = response.text.strip()
        
        # Cleanup
        try: genai.delete_file(uploaded_file.name)
        except: pass
        if os.path.exists(chunk_filename):
            try: os.remove(chunk_filename)
            except: pass
        
        # Parse JSON
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        text = text.strip()

        questions = json.loads(text)
        if isinstance(questions, list):
            valid_questions = []
            for q in questions:
                konu = q.get("konu", "")
                if konu != "KONU_DISI" and any(vt.lower() in konu.lower() or konu.lower() in vt.lower() for vt in VALID_TOPICS):
                    matched_topic = next((vt for vt in VALID_TOPICS if vt.lower() in konu.lower() or konu.lower() in vt.lower()), konu)
                    q["konu"] = matched_topic
                    q["ders"] = "Tarih"
                    q["sinav"] = "ÖABT-TARİH"
                    q["kaynak"] = "oabt-cikmis"
                    valid_questions.append(q)

            print(f"[OK] Sayfa {start_page+1}-{end_page+1}: Toplam {len(questions)} sorudan {len(valid_questions)} KPSS Tarih sorusu seçildi.")
            return valid_questions
        else:
            return []
    except Exception as e:
        print(f"[!] Sayfa {start_page+1}-{end_page+1} hatası: {e}")
        if uploaded_file:
            try: genai.delete_file(uploaded_file.name)
            except: pass
        if os.path.exists(chunk_filename):
            try: os.remove(chunk_filename)
            except: pass
        return []

def main():
    if not os.path.exists(PDF_PATH):
        print(f"❌ PDF bulunamadı: {PDF_PATH}")
        return

    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    print(f"📖 ÖABT Tarih PDF Toplam Sayfa: {total_pages}")
    
    extracted_questions = []
    processed_chunks = []
    
    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            extracted_questions = json.load(f)
            
    if os.path.exists(PROGRESS_JSON):
        with open(PROGRESS_JSON, "r", encoding="utf-8") as f:
            processed_chunks = json.load(f)
            
    print(f"📋 Mevcut kayıtlı soru sayısı: {len(extracted_questions)}")
    
    CHUNK_SIZE = 5
    
    for start_page in range(0, total_pages, CHUNK_SIZE):
        end_page = min(start_page + CHUNK_SIZE - 1, total_pages - 1)
        chunk_key = f"{start_page}-{end_page}"
        
        if chunk_key in processed_chunks:
            print(f"[>] Chunk {start_page+1}-{end_page+1} zaten işlenmiş, atlanıyor.")
            continue
            
        print(f"\n--- İşlenen Chunk: Sayfa {start_page+1} - {end_page+1} ---")
        questions = extract_chunk(start_page, end_page, doc)
        
        if questions:
            extracted_questions.extend(questions)
            
        processed_chunks.append(chunk_key)
        
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(extracted_questions, f, ensure_ascii=False, indent=4)
            
        with open(PROGRESS_JSON, "w", encoding="utf-8") as f:
            json.dump(processed_chunks, f, ensure_ascii=False, indent=2)
            
        time.sleep(12)

    doc.close()
    print(f"\n🎉 ÖABT Soru Çıkarımı Tamamlandı! Toplam KPSS Tarih Sorusu: {len(extracted_questions)}")

if __name__ == "__main__":
    main()
