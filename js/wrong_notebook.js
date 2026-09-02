/**
 * KPSS Tarama Botu — Yanlış Sorular Defteri Mantığı
 */

let allQuestions = [];
let wrongQuestions = [];
let filteredWrong = [];

document.addEventListener("DOMContentLoaded", async () => {
  allQuestions = await DataManager.loadAllQuestions();
  refreshWrongData();
});

function refreshWrongData() {
  wrongQuestions = DataManager.getWrongQuestionsDetailed(allQuestions);
  const wrongCountBadge = document.getElementById("badge-wrong-count");
  if (wrongCountBadge) {
    wrongCountBadge.textContent = `❌ ${wrongQuestions.length} Aktif Yanlış`;
  }

  renderTopicSummary();
  renderWrongQuestions(wrongQuestions);
}

function renderTopicSummary() {
  const topicStats = DataManager.getWrongStatsByTopic(allQuestions);
  const container = document.getElementById("topic-summary-grid");

  if (!container) return;

  if (topicStats.length === 0) {
    document.getElementById("topic-summary-section").style.display = "none";
    return;
  }

  document.getElementById("topic-summary-section").style.display = "block";

  container.innerHTML = topicStats.map(item => `
    <div class="card" style="border-color: rgba(239, 68, 68, 0.25); cursor: pointer;" onclick="filterByTopic('${escapeHtml(item.konu)}')">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="font-size: 0.95rem; color: var(--text-primary);">${shortenTopic(item.konu)}</h4>
        <span class="question-tag" style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-weight: 700;">
          ${item.count} Yanlış
        </span>
      </div>
      <div class="progress-bar" style="height: 6px;">
        <div class="progress-fill danger" style="width: ${Math.min(item.count * 15, 100)}%;"></div>
      </div>
    </div>
  `).join("");
}

function filterByTopic(konu) {
  const list = wrongQuestions.filter(q => q.konu === konu);
  renderWrongQuestions(list, konu);
}

function renderWrongQuestions(list, activeTopicFilter = "") {
  const container = document.getElementById("wrong-questions-container");

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state animate-in">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
        <h2>Harika! Yanlış Sorunuz Bulunmuyor</h2>
        <p class="text-secondary" style="margin-top: 0.5rem; margin-bottom: 1.5rem;">
          ${activeTopicFilter ? `"${activeTopicFilter}" konusunda yanlış yaptığınız soru kalmadı.` : "Çözdüğünüz tüm sorularda doğru cevaplar verdiniz veya henüz test çözmediniz."}
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <a href="quiz.html" class="btn btn-primary">📚 Çıkmış Soruları Çöz</a>
          <a href="ai_quiz.html" class="btn btn-primary" style="background: linear-gradient(135deg, #8b5cf6, #ec4899); border: none;">🤖 AI Özgün Testleri Çöz</a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 style="font-size: 1.1rem; color: var(--text-primary);">
        ${activeTopicFilter ? `📍 "${activeTopicFilter}" Yanlışları (${list.length})` : `📖 Tüm Yanlış Sorular (${list.length})`}
      </h3>
      ${activeTopicFilter ? `<button class="btn btn-ghost btn-sm" onclick="renderWrongQuestions(wrongQuestions)">Tüm Yanlışları Göster</button>` : ""}
    </div>

    ${list.map((q, idx) => `
      <div class="question-card animate-in" id="card-${q._globalId}" style="border-color: rgba(239, 68, 68, 0.25); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <span class="question-number" style="background: rgba(239, 68, 68, 0.12); color: #f87171;">❌ Hatalı Soru #${idx + 1}</span>
          <span class="text-muted" style="font-size: 0.8rem;">Cevaplanma: ${q.answeredDate || 'Bugün'}</span>
        </div>

        <div class="question-meta">
          <span class="question-tag tag-topic">📚 ${shortenTopic(q.konu)}</span>
          <span class="question-tag ${q.kaynak === 'ai-uretim' ? 'tag-ai' : 'tag-exam'}">
            ${q.kaynak === 'ai-uretim' ? '🤖 AI Üretimi' : `🎯 ${q.sinav || 'Çıkmış'} ${q.yil ? `(${q.yil})` : ''}`}
          </span>
        </div>

        <div class="question-text">${escapeHtml(q.soru_koku)}</div>

        <!-- Şıklar -->
        <div class="options-list">
          ${Object.keys(q.secenekler || {}).sort().map(letter => {
            const isUserWrong = letter === q.selectedWrongAnswer;
            const isCorrect = letter === q.dogru_cevap;
            let optionClass = "";
            if (isCorrect) optionClass = "correct";
            else if (isUserWrong) optionClass = "wrong";

            return `
              <div class="option-btn disabled ${optionClass}" style="pointer-events: none;">
                <span class="option-letter">${letter}</span>
                <span class="option-text">${escapeHtml(q.secenekler[letter])}</span>
                ${isUserWrong ? `<span style="margin-left: auto; font-size: 0.8rem; color: var(--accent-danger); font-weight: 600;">(Sizin Cevabınız ❌)</span>` : ""}
                ${isCorrect ? `<span style="margin-left: auto; font-size: 0.8rem; color: var(--accent-success); font-weight: 600;">(Doğru Cevap ✅)</span>` : ""}
              </div>
            `;
          }).join("")}
        </div>

        <!-- Detaylı Çözüm Açıklaması -->
        <div class="explanation-box wrong" style="margin-top: 1rem;">
          <div class="explanation-title">💡 Çözüm Açıklaması & Doğru Cevap (${q.dogru_cevap}):</div>
          <div class="explanation-text">${escapeHtml(q.aciklama || "Bu soru için detaylı çözüm açıklaması mevcuttur.")}</div>
        </div>

        <!-- Aksiyon Butonu -->
        <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
          <button class="btn btn-success btn-sm" onclick="reSolveQuestion('${q._globalId}')">
            ✏️ Tekrar Çözdüm & Öğrendim
          </button>
        </div>
      </div>
    `).join("")}
  `;
}

function reSolveQuestion(globalId) {
  DataManager.clearWrongAnswer(globalId);
  showToast("✅ Harika! Soru öğrenildi olarak işaretlendi.", "success");
  
  const card = document.getElementById(`card-${globalId}`);
  if (card) {
    card.style.opacity = "0";
    card.style.transform = "translateY(-10px)";
    card.style.transition = "all 0.3s ease";
    setTimeout(() => {
      refreshWrongData();
    }, 300);
  } else {
    refreshWrongData();
  }
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
