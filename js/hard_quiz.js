/**
 * KPSS Tarama Botu — Zor Soru Avcısı Çözme Mantığı (Temiz UI & Raporlama Desteği)
 */

let hardQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let answered = false;
let timerInterval = null;
let elapsedSeconds = 0;

const TOPIC_EMOJIS = {
  "İslam Öncesi Türk Tarihi": "🏹",
  "İlk Türk İslam Devletleri": "☪️",
  "Beylikler Dönemi ve Türkiye Selçuklu Devleti": "🏰",
  "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri": "⚔️",
  "Osmanlı Kültür ve Medeniyeti": "🕌",
};

document.addEventListener("DOMContentLoaded", async () => {
  hardQuestions = await DataManager.loadHardQuestions();
  
  populateFilters();
  
  const params = new URLSearchParams(window.location.search);
  const konu = params.get("konu");

  if (konu) {
    applyURLParams();
  } else {
    renderTopicSelectionScreen();
  }
  
  const filterBtn = document.getElementById("btn-apply-filter");
  if (filterBtn) filterBtn.addEventListener("click", applyFilters);
  document.addEventListener("keydown", handleKeyboard);
});

function renderTopicSelectionScreen() {
  stopTimer();

  const filterBar = document.getElementById("filter-bar");
  if (filterBar) filterBar.style.display = "flex";

  const hardBanner = document.getElementById("hard-banner");
  if (hardBanner) hardBanner.style.display = "block";

  const area = document.getElementById("quiz-area");
  const topicStats = DataManager.getTopicStats(hardQuestions);

  area.innerHTML = `
    <div class="animate-in" style="margin-bottom: 2rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: var(--text-primary);">🎯 Zor Soru Avcısı Konu Seçimi</h2>
        <p class="text-secondary">Çözmek istediğiniz derece seviyesi zor soru konusunu seçin.</p>
      </div>

      <!-- Karma Zor Test Kartı -->
      <div class="card" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.08)); border-color: rgba(239, 68, 68, 0.4); margin-bottom: 1.5rem; cursor: pointer;"
           onclick="startTopicQuiz('')">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="stat-icon red" style="font-size: 2rem; width: 54px; height: 54px; background: rgba(239, 68, 68, 0.2);">🎯</div>
            <div>
              <h3 style="font-size: 1.2rem; color: var(--text-primary);">Tüm Konular Derece Seviyesi Karma Test</h3>
              <p class="text-secondary" style="font-size: 0.85rem;">AI Kalite Kontrol onaylı zor sorular arasından rastgele test</p>
            </div>
          </div>
          <button class="btn btn-primary" style="background: linear-gradient(135deg, #ef4444, #f59e0b); border: none;">🔥 Zor Testi Başlat (${hardQuestions.length} Soru)</button>
        </div>
      </div>

      <!-- Konu Kartları Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        ${topicStats.map(t => {
          const emoji = TOPIC_EMOJIS[t.konu] || "🎯";
          return `
            <div class="card" style="cursor: pointer; display: flex; flex-direction: column; justify-space-between; border-color: rgba(239, 68, 68, 0.25); transition: transform 0.2s;"
                 onclick="startTopicQuiz('${escapeHtml(t.konu)}')">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <span style="font-size: 2.2rem;">${emoji}</span>
                <span class="question-tag" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3); font-size: 0.8rem;">${t.total} Zor Soru</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 0.75rem; color: var(--text-primary); line-height: 1.4;">${t.konu}</h4>
              
              <div style="margin-top: auto; padding-top: 1rem;">
                <div class="progress-header" style="font-size: 0.8rem; margin-bottom: 0.35rem;">
                  <span class="text-muted">Çözülen: ${t.answered}/${t.total}</span>
                  <span class="text-success">%${t.percentage} başarı</span>
                </div>
                <div class="progress-bar" style="height: 6px; margin-bottom: 1rem;">
                  <div class="progress-fill ${t.percentage >= 70 ? 'success' : t.percentage >= 40 ? 'warning' : ''}" style="width: ${t.progress}%; background: linear-gradient(135deg, #ef4444, #f59e0b);"></div>
                </div>
                <button class="btn btn-ghost btn-sm" style="width: 100%; justify-content: center; border-color: rgba(239, 68, 68, 0.3); color: #f87171;">
                  🎯 Zor Testi Başlat
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function startTopicQuiz(konu) {
  const konuSelect = document.getElementById("filter-konu");
  if (konuSelect) konuSelect.value = konu;
  applyFilters();
}

function populateFilters() {
  const konular = DataManager.getUniqueValues(hardQuestions, "konu");
  const konuSelect = document.getElementById("filter-konu");
  if (konuSelect) {
    konuSelect.innerHTML = `<option value="">Tüm Konular (Karma)</option>`;
    konular.forEach(k => {
      const count = hardQuestions.filter(q => q.konu === k).length;
      konuSelect.innerHTML += `<option value="${k}">${k} (${count})</option>`;
    });
  }
}

function applyURLParams() {
  const params = new URLSearchParams(window.location.search);
  const konu = params.get("konu");

  if (konu) {
    const konuSelect = document.getElementById("filter-konu");
    if (konuSelect) konuSelect.value = konu;
  }

  applyFilters();
}

function applyFilters() {
  const konuVal = document.getElementById("filter-konu") ? document.getElementById("filter-konu").value : "";

  const filters = { konu: konuVal };
  filteredQuestions = DataManager.filterQuestions(hardQuestions, filters);

  if (filteredQuestions.length === 0) {
    showEmptyState("Bu filtrelere uygun zor soru bulunamadı.");
    return;
  }

  currentIndex = 0;
  renderQuiz();
}

// ─── Quiz Render (FİLTRE & BANNER GİZLİ) ───
function renderQuiz() {
  const filterBar = document.getElementById("filter-bar");
  if (filterBar) filterBar.style.display = "none";

  const hardBanner = document.getElementById("hard-banner");
  if (hardBanner) hardBanner.style.display = "none";

  const area = document.getElementById("quiz-area");
  const question = filteredQuestions[currentIndex];
  answered = false;

  const isReported = DataManager.isReported(question._globalId);

  area.innerHTML = `
    <!-- Top Action & Progress Bar -->
    <div class="quiz-header" style="margin-bottom: 1.25rem; border-color: rgba(239, 68, 68, 0.35);">
      <button class="btn btn-ghost btn-sm" onclick="renderTopicSelectionScreen()" style="border-color: rgba(239, 68, 68, 0.35); color: #f87171;">
        ← Zor Konu Seçimi
      </button>
      <div class="quiz-progress" style="flex: 1; max-width: 300px; margin: 0 1rem;">
        <span class="quiz-progress-text">Zor Soru ${currentIndex + 1}/${filteredQuestions.length}</span>
        <div class="quiz-progress-bar" style="flex: 1;">
          <div class="quiz-progress-fill" style="width: ${((currentIndex + 1) / filteredQuestions.length) * 100}%; background: linear-gradient(135deg, #ef4444, #f59e0b);"></div>
        </div>
      </div>
      <div class="quiz-timer" id="quiz-timer">
        ⏱️ <span id="timer-display">00:00</span>
      </div>
    </div>

    <!-- MAIN QUESTION CARD -->
    <div class="question-card animate-in" style="border-color: rgba(239, 68, 68, 0.3);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <span class="question-number" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">🔥 Derece Soru ${currentIndex + 1}</span>
        
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <!-- 🚩 Soru Hatalı Bildir Butonu -->
          <button class="btn btn-ghost btn-sm" onclick="openReportModal('${question._globalId}')" 
                  id="report-btn-${question._globalId}"
                  style="font-size: 0.78rem; border-color: rgba(239, 68, 68, 0.3); ${isReported ? 'color: var(--accent-danger);' : ''}" ${isReported ? 'disabled' : ''}>
            ${isReported ? '🚩 Bildirildi' : '🚩 Hatalı Bildir'}
          </button>
          
          <button class="btn btn-icon btn-ghost" onclick="toggleBookmark('${question._globalId}')" 
                  id="bookmark-btn" title="İşaretle"
                  style="font-size: 1.2rem; ${DataManager.isBookmarked(question._globalId) ? 'color: var(--accent-warning);' : ''}">
            ${DataManager.isBookmarked(question._globalId) ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      <div class="question-meta">
        <span class="question-tag tag-topic">📚 ${shortenTopic(question.konu)}</span>
        <span class="question-tag" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3);">🎯 Zor Soru Avcısı</span>
        <span class="question-tag" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border-color: rgba(16, 185, 129, 0.3);">✅ AI Onaylı</span>
      </div>

      <div class="question-text">${escapeHtml(question.soru_koku)}</div>

      <div class="options-list" id="options-list">
        ${renderOptions(question)}
      </div>

      <div id="explanation-area"></div>
    </div>

    <!-- BOTTOM ACTIONS -->
    <div class="quiz-actions" style="margin-top: 1.5rem; margin-bottom: 2rem;">
      <button class="btn btn-ghost btn-lg" onclick="prevQuestion()" ${currentIndex === 0 ? 'disabled style="opacity:0.3"' : ''}>
        ← Önceki Soru
      </button>

      <div style="display: flex; gap: 0.75rem;">
        <button class="btn btn-primary btn-lg" onclick="nextQuestion()" id="btn-next" style="background: linear-gradient(135deg, #ef4444, #f59e0b); border: none;">
          Sonraki Soru →
        </button>
        ${currentIndex === filteredQuestions.length - 1 ? 
          `<button class="btn btn-success btn-lg" onclick="showResults()" id="btn-results">
            📊 Sonuçları Gör
          </button>` : ""
        }
      </div>
    </div>

    <!-- QUESTION NUMBERS AKORDEON -->
    <details class="card-glass" style="margin-top: 1.5rem; border-color: rgba(239, 68, 68, 0.25);">
      <summary style="cursor: pointer; font-weight: 600; font-size: 0.9rem; color: #f87171; display: flex; align-items: center; justify-content: space-between;">
        <span>🔢 Tüm Derece Soru Numaraları (${filteredQuestions.length} Soru)</span>
        <span class="text-muted" style="font-size: 0.8rem;">Göstermek / Gizlemek için tıklayın</span>
      </summary>
      <div class="quiz-nav-dots" id="nav-dots" style="margin-top: 1rem; max-height: 200px; overflow-y: auto; padding: 0.5rem;">
        ${filteredQuestions.map((q, i) => {
          const ans = DataManager.getAnswer(q._globalId);
          let cls = "";
          if (i === currentIndex) cls = "current";
          else if (ans) cls = ans.correct ? "correct-dot" : "wrong-dot";
          return `<button class="nav-dot ${cls}" onclick="goToQuestion(${i})" title="Soru ${i + 1}">${i + 1}</button>`;
        }).join("")}
      </div>
    </details>
  `;

  startTimer();

  const prevAnswer = DataManager.getAnswer(question._globalId);
  if (prevAnswer) {
    showPreviousAnswer(question, prevAnswer);
  }
}

function renderOptions(question) {
  const keys = Object.keys(question.secenekler || {}).sort();
  return keys.map(letter => {
    const text = question.secenekler[letter];
    return `
      <button class="option-btn" id="opt-${letter}" onclick="selectAnswer('${letter}')">
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHtml(text)}</span>
      </button>
    `;
  }).join("");
}

function selectAnswer(letter) {
  if (answered) return;
  answered = true;
  stopTimer();

  const question = filteredQuestions[currentIndex];
  const isCorrect = DataManager.recordAnswer(question._globalId, letter, question.dogru_cevap);

  document.querySelectorAll(".option-btn").forEach(btn => btn.classList.add("disabled"));

  const selectedBtn = document.getElementById(`opt-${letter}`);
  if (selectedBtn) selectedBtn.classList.add(isCorrect ? "correct" : "wrong");

  if (!isCorrect && question.dogru_cevap) {
    const correctBtn = document.getElementById(`opt-${question.dogru_cevap}`);
    if (correctBtn) correctBtn.classList.add("correct");
  }

  const explanationArea = document.getElementById("explanation-area");
  explanationArea.innerHTML = `
    <div class="explanation-box ${isCorrect ? 'correct' : 'wrong'}">
      <div class="explanation-title">
        ${isCorrect ? '✅ Doğru! Tebrikler, derece sorusunu bildiniz!' : `❌ Yanlış! Doğru cevap: ${question.dogru_cevap}`}
      </div>
      ${question.aciklama ? `<div class="explanation-text"><strong>💡 Akademisyen Çözümü & Açıklama:</strong><br>${escapeHtml(question.aciklama)}</div>` : ""}
    </div>
  `;

  updateNavDot(currentIndex, isCorrect);
  showToast(isCorrect ? "✅ Harika! Zor soruyu bildiniz!" : "❌ Yanlış cevap", isCorrect ? "success" : "error");
}

function showPreviousAnswer(question, prevAnswer) {
  answered = true;
  stopTimer();

  document.querySelectorAll(".option-btn").forEach(btn => btn.classList.add("disabled"));

  const selectedBtn = document.getElementById(`opt-${prevAnswer.selected}`);
  if (selectedBtn) selectedBtn.classList.add(prevAnswer.correct ? "correct" : "wrong");

  if (!prevAnswer.correct && question.dogru_cevap) {
    const correctBtn = document.getElementById(`opt-${question.dogru_cevap}`);
    if (correctBtn) correctBtn.classList.add("correct");
  }

  const explanationArea = document.getElementById("explanation-area");
  explanationArea.innerHTML = `
    <div class="explanation-box ${prevAnswer.correct ? 'correct' : 'wrong'}">
      <div class="explanation-title">
        ${prevAnswer.correct ? '✅ Doğru!' : `❌ Yanlış! Doğru cevap: ${question.dogru_cevap}`}
        <span style="font-weight:400; color:var(--text-muted); font-size:0.8rem;"> (daha önce cevaplanmış)</span>
      </div>
      ${question.aciklama ? `<div class="explanation-text"><strong>💡 Çözüm Açıklaması:</strong><br>${escapeHtml(question.aciklama)}</div>` : ""}
    </div>
  `;
}

function nextQuestion() {
  if (currentIndex < filteredQuestions.length - 1) {
    currentIndex++;
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goToQuestion(index) {
  currentIndex = index;
  renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleKeyboard(e) {
  if (e.key === "ArrowRight" || e.key === "Enter") {
    nextQuestion();
  } else if (e.key === "ArrowLeft") {
    prevQuestion();
  } else if (["a", "b", "c", "d", "e"].includes(e.key.toLowerCase()) && !answered) {
    selectAnswer(e.key.toUpperCase());
  }
}

function startTimer() {
  elapsedSeconds = 0;
  stopTimer();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    const display = document.getElementById("timer-display");
    if (display) {
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      display.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function toggleBookmark(globalId) {
  const isBookmarked = DataManager.toggleBookmark(globalId);
  const btn = document.getElementById("bookmark-btn");
  btn.innerHTML = isBookmarked ? "⭐" : "☆";
  btn.style.color = isBookmarked ? "var(--accent-warning)" : "";
  showToast(isBookmarked ? "⭐ İşaretlendi" : "☆ İşaret kaldırıldı");
}

function updateNavDot(index, isCorrect) {
  const dots = document.querySelectorAll(".nav-dot");
  if (dots[index]) {
    dots[index].className = `nav-dot ${isCorrect ? "correct-dot" : "wrong-dot"}`;
  }
}

function showResults() {
  stopTimer();
  let correct = 0, wrong = 0, unanswered = 0;
  filteredQuestions.forEach(q => {
    const ans = DataManager.getAnswer(q._globalId);
    if (!ans) unanswered++;
    else if (ans.correct) correct++;
    else wrong++;
  });

  const total = filteredQuestions.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const area = document.getElementById("quiz-area");
  area.innerHTML = `
    <div class="score-card animate-in">
      <h2 style="margin-bottom: 1.5rem;">🎯 Zor Soru Avcısı Sonuçları</h2>
      <div style="font-size: 3rem; font-weight: 800; color: #f87171; margin-bottom: 1rem;">%${pct}</div>
      <div style="display: flex; justify-content: center; gap: 2rem; margin: 1.5rem 0;">
        <div><div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-success);">${correct}</div><div class="text-muted">Doğru</div></div>
        <div><div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-danger);">${wrong}</div><div class="text-muted">Yanlış</div></div>
        <div><div style="font-size: 1.8rem; font-weight: 800; color: var(--text-muted);">${unanswered}</div><div class="text-muted">Boş</div></div>
      </div>
      <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-top: 2rem;">
        <button onclick="renderTopicSelectionScreen()" class="btn btn-primary" style="background: linear-gradient(135deg, #ef4444, #f59e0b); border: none;">🎯 Başka Zor Konu Seç</button>
        <a href="quiz.html" class="btn btn-ghost">📚 Çıkmış Sorulara Dön</a>
      </div>
    </div>
  `;
}

function showEmptyState(message) {
  const area = document.getElementById("quiz-area");
  area.innerHTML = `
    <div class="empty-state">
      <div class="icon">🎯</div>
      <h3 style="margin-bottom: 0.5rem;">${message}</h3>
      <button onclick="renderTopicSelectionScreen()" class="btn btn-primary" style="margin-top: 1rem; background: linear-gradient(135deg, #ef4444, #f59e0b); border: none;">🎯 Zor Soru Seçim Ekranı</button>
    </div>
  `;
}

function showToast(message, type = "") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function shortenTopic(topic) {
  if (!topic) return "";
  if (topic.length <= 25) return topic;
  const parts = topic.split(" ");
  if (parts.length > 3) return parts.slice(0, 3).join(" ") + "...";
  return topic.substring(0, 25) + "...";
}
