import os
import sys
import json
import time

# Ensure UTF-8 output encoding for Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import fitz  # PyMuPDF
import google.generativeai as genai

API_KEY = "AIzaSyCodxevpgdU2zfK0ZRsz8HEpA7lzGEXQdQ"
genai.configure(api_key=API_KEY)

PDF_PATH = "974140972-Dizgi-Tarih-Cıkmış-1322-Soru-Video-Cozumlu-1_compressed.pdf"
OUTPUT_JSON = "pdf_extracted_all.json"
PROGRESS_JSON = "pdf_progress.json"

SYSTEM_PROMPT = """Sen bir KPSS Tarih soru bankası OCR ve verileştirme uzmanısın. 
Sana verilen PDF sayfalarından TÜM çoktan seçmeli soruları Türkçe karakterleri koruyarak JSON formatında çıkar.

ÇIKTI FORMATI (Kesinlikle sadece JSON array döndür, markdown ```json blogu olmadan):
[
  {
    "ders": "Tarih",
    "konu": "İslam Öncesi Türk Tarihi",
    "yil": 2024,
    "sinav": "KPSS-GYGK-LİSANS",
    "soru_koku": "Soru metninin tamamı...",
    "secenekler": {
      "A": "Metin A",
      "B": "Metin B",
      "C": "Metin C",
      "D": "Metin D",
      "E": "Metin E"
    },
    "dogru_cevap": "C"
  }
]

KURALLAR:
1. Görseldeki metinleri dikkatle oku (OCR yap).
2. Sadece SORULARI ve ŞIKLARI al. Sayfa numaralarını, cevap anahtarı çizelgelerini veya reklamları atla.
3. Eğer doğru cevap şıkkı sayfada/soru altında belirtilmişse "dogru_cevap" alanına yaz. Belirtilmemişse "" boş bırak.
4. "yil" ve "sinav" bilgisi sorunun üstünde veya yanında varsa yaz, yoksa 0 ve "" ver.
5. Soruda soru numarası varsa soru köküne ekleme. Soru kökü temiz metin olsun.
"""

def extract_chunk(start_page, end_page, doc):
    chunk_doc = fitz.open()
    chunk_doc.insert_pdf(doc, from_page=start_page, to_page=end_page)
    chunk_filename = f"temp_chunk_{start_page+1}_{end_page+1}.pdf"
    chunk_doc.save(chunk_filename)
    chunk_doc.close()
    
    print(f"[+] Uploading pages {start_page+1}-{end_page+1} ({os.path.getsize(chunk_filename)/1024:.1f} KB)...")
    uploaded_file = genai.upload_file(chunk_filename, mime_type="application/pdf")
    
    # Wait for file processing if needed
    while uploaded_file.state.name == "PROCESSING":
        time.sleep(2)
        uploaded_file = genai.get_file(uploaded_file.name)
        
    if uploaded_file.state.name == "FAILED":
        print(f"[!] Upload failed for pages {start_page+1}-{end_page+1}")
        if os.path.exists(chunk_filename):
            os.remove(chunk_filename)
        return []

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config={"temperature": 0.1, "response_mime_type": "application/json"}
    )
    
    print(f"[*] Processing pages {start_page+1}-{end_page+1} with Gemini 2.5 Flash Vision...")
    try:
        response = model.generate_content([uploaded_file, SYSTEM_PROMPT])
        text = response.text.strip()
        
        # Clean up Gemini file & local chunk
        try:
            genai.delete_file(uploaded_file.name)
        except Exception:
            pass
        if os.path.exists(chunk_filename):
            os.remove(chunk_filename)
        
        # Parse JSON
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        questions = json.loads(text)
        if isinstance(questions, list):
            print(f"[OK] Extracted {len(questions)} questions from pages {start_page+1}-{end_page+1}")
            return questions
        else:
            print(f"[!] Non-list output on pages {start_page+1}-{end_page+1}")
            return []
    except Exception as e:
        print(f"[!] Error on pages {start_page+1}-{end_page+1}: {e}")
        try:
            genai.delete_file(uploaded_file.name)
        except Exception:
            pass
        if os.path.exists(chunk_filename):
            os.remove(chunk_filename)
        return []

def main():
    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    print(f"Total PDF pages: {total_pages}")
    
    # Load progress
    extracted_questions = []
    processed_chunks = []
    
    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            extracted_questions = json.load(f)
            
    if os.path.exists(PROGRESS_JSON):
        with open(PROGRESS_JSON, "r", encoding="utf-8") as f:
            processed_chunks = json.load(f)
            
    print(f"Loaded existing {len(extracted_questions)} questions from previous runs.")
    
    CHUNK_SIZE = 5  # 5 pages per chunk for high reliability & speed
    
    for start_page in range(0, total_pages, CHUNK_SIZE):
        end_page = min(start_page + CHUNK_SIZE - 1, total_pages - 1)
        chunk_key = f"{start_page}-{end_page}"
        
        if chunk_key in processed_chunks:
            print(f"[>] Skipping chunk {start_page+1}-{end_page+1} (already done)")
            continue
            
        print(f"\n--- Processing Chunk: Pages {start_page+1} to {end_page+1} ---")
        questions = extract_chunk(start_page, end_page, doc)
        
        if questions:
            extracted_questions.extend(questions)
            
        processed_chunks.append(chunk_key)
        
        # Save progress after each chunk
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(extracted_questions, f, ensure_ascii=False, indent=2)
            
        with open(PROGRESS_JSON, "w", encoding="utf-8") as f:
            json.dump(processed_chunks, f, ensure_ascii=False, indent=2)
            
        time.sleep(1)

    doc.close()
    print(f"\nExtraction complete! Total extracted: {len(extracted_questions)} questions.")

if __name__ == "__main__":
    main()
