import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

def normalize(text):
    if not text:
        return ""
    return text.lower().replace(" ", "").replace("\n", "").replace("\r", "")[:60]

def main():
    existing_path = "sorular.json"
    pdf_path = "pdf_extracted_all.json"
    ai_path = "uretilen_sorular.json"
    
    existing = []
    if os.path.exists(existing_path):
        with open(existing_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
            
    pdf_questions = []
    if os.path.exists(pdf_path):
        with open(pdf_path, "r", encoding="utf-8") as f:
            pdf_questions = json.load(f)
            
    ai_questions = []
    if os.path.exists(ai_path):
        with open(ai_path, "r", encoding="utf-8") as f:
            ai_questions = json.load(f)
            
    print(f"📊 Mevcut çıkmış soru sayısı: {len(existing)}")
    print(f"📄 PDF'den çıkarılan soru sayısı: {len(pdf_questions)}")
    print(f"🤖 AI üretilen soru sayısı: {len(ai_questions)}")
    
    # Deduplicate PDF questions against existing questions
    existing_fps = set(normalize(q.get("soru_koku", "")) for q in existing)
    
    unique_pdf = []
    for q in pdf_questions:
        fp = normalize(q.get("soru_koku", ""))
        if fp and len(fp) > 10 and fp not in existing_fps:
            existing_fps.add(fp)
            unique_pdf.append(q)
            
    print(f"🆕 PDF'den eklenen yeni benzersiz soru: {len(unique_pdf)}")
    
    # Merge existing + unique PDF questions
    max_id = max((q.get("id", 0) for q in existing), default=0)
    for i, q in enumerate(unique_pdf):
        q["id"] = max_id + i + 1
        q["kaynak"] = "pdf-cikmis"
        
    merged_cikmis = existing + unique_pdf
    
    with open(existing_path, "w", encoding="utf-8") as f:
        json.dump(merged_cikmis, f, ensure_ascii=False, indent=4)
        
    total_active = len(merged_cikmis) + len(ai_questions)
    
    print("\n" + "="*50)
    print("✨ TÜM VERİLER BİRLEŞTİRİLDİ VE GÜNCELLENDİ!")
    print(f"   Çıkmış Sorular (sorular.json): {len(merged_cikmis)}")
    print(f"   AI Üretilen Sorular (uretilen_sorular.json): {len(ai_questions)}")
    print(f"   🌟 SİTEDE ÇÖZÜLEBİLİR TOPLAM SORU SAYISI: {total_active}")
    print("="*50)

if __name__ == "__main__":
    main()
