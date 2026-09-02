/**
 * KPSS Tarama Botu — Veri Yönetimi & Tema & Yanlış Defteri & Hata Raporlama
 */

const DataManager = {
  _pastQuestions: null,
  _aiQuestions: null,
  _hardQuestions: null,

  async loadPastQuestions() {
    if (this._pastQuestions) return this._pastQuestions;
    try {
      const resp = await fetch("sorular.json");
      const data = await resp.json();
      this._pastQuestions = data.map((q, i) => ({
        ...q,
        _globalId: `past_${q.id || i + 1}`,
        kaynak: "cikmis"
      }));
      return this._pastQuestions;
    } catch (err) {
      console.error("Çıkmış soru yükleme hatası:", err);
      return [];
    }
  },

  async loadAIQuestions() {
    if (this._aiQuestions) return this._aiQuestions;
    try {
      const resp = await fetch("uretilen_sorular.json");
      if (!resp.ok) return [];
      const data = await resp.json();
      this._aiQuestions = data.map((q, i) => ({
        ...q,
        _globalId: `ai_${q.id || i + 1}`,
        kaynak: "ai-uretim"
      }));
      return this._aiQuestions;
    } catch (err) {
      console.error("AI soru yükleme hatası:", err);
      return [];
    }
  },

  async loadHardQuestions() {
    if (this._hardQuestions) return this._hardQuestions;
    try {
      const resp = await fetch("avlanan_zor_sorular.json");
      if (!resp.ok) return [];
      const data = await resp.json();
      this._hardQuestions = data.map((q, i) => ({
        ...q,
        _globalId: `hard_${q.id || i + 1}`,
        kaynak: "zor-soru-avcisi"
      }));
      return this._hardQuestions;
    } catch (err) {
      console.error("Zor soru yükleme hatası:", err);
      return [];
    }
  },

  async loadAllQuestions() {
    const past = await this.loadPastQuestions();
    const ai = await this.loadAIQuestions();
    const hard = await this.loadHardQuestions();
    return [...past, ...ai, ...hard];
  },

  filterQuestions(sorular, filters) {
    return sorular.filter(q => {
      if (filters.konu && q.konu !== filters.konu) return false;
      if (filters.sinav && q.sinav !== filters.sinav) return false;
      if (filters.yil && q.yil !== parseInt(filters.yil)) return false;
      if (filters.zorluk && q.zorluk && q.zorluk !== filters.zorluk) return false;
      return true;
    });
  },

  getUniqueValues(sorular, field) {
    const values = [...new Set(sorular.map(q => q[field]).filter(Boolean))];
    return values.sort();
  },

  getKonular(sorular) {
    const konuMap = {};
    sorular.forEach(q => {
      if (!konuMap[q.konu]) konuMap[q.konu] = 0;
      konuMap[q.konu]++;
    });
    return Object.entries(konuMap)
      .sort((a, b) => b[1] - a[1])
      .map(([konu, count]) => ({ konu, count }));
  },

  STORAGE_KEY: "kpss_progress",
  REPORTED_KEY: "kpss_reported_questions",

  getProgress() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : this._defaultProgress();
    } catch {
      return this._defaultProgress();
    }
  },

  _defaultProgress() {
    return {
      answers: {},
      bookmarks: [],
      stats: {
        totalAnswered: 0,
        totalCorrect: 0,
        totalWrong: 0,
        streak: 0,
        bestStreak: 0,
        dailyGoal: 10,
        lastStudyDate: null,
      },
      history: [],
    };
  },

  saveProgress(progress) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.error("İlerleme kaydedilemedi:", e);
    }
  },

  recordAnswer(globalId, selectedAnswer, correctAnswer) {
    const progress = this.getProgress();
    const isCorrect = selectedAnswer === correctAnswer;
    const today = new Date().toISOString().split("T")[0];

    if (!progress.answers[globalId]) {
      progress.stats.totalAnswered++;
      if (isCorrect) {
        progress.stats.totalCorrect++;
        progress.stats.streak++;
        if (progress.stats.streak > progress.stats.bestStreak) {
          progress.stats.bestStreak = progress.stats.streak;
        }
      } else {
        progress.stats.totalWrong++;
        progress.stats.streak = 0;
      }
    } else {
      const prev = progress.answers[globalId];
      if (!prev.correct && isCorrect) {
        progress.stats.totalWrong = Math.max(0, progress.stats.totalWrong - 1);
        progress.stats.totalCorrect++;
      }
    }

    progress.answers[globalId] = {
      selected: selectedAnswer,
      correct: isCorrect,
      date: today,
    };

    progress.stats.lastStudyDate = today;

    let todayHistory = progress.history.find(h => h.date === today);
    if (!todayHistory) {
      todayHistory = { date: today, answered: 0, correct: 0 };
      progress.history.push(todayHistory);
    }
    todayHistory.answered++;
    if (isCorrect) todayHistory.correct++;

    progress.history = progress.history
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    this.saveProgress(progress);
    return isCorrect;
  },

  // ─── SORU HATALI BİLDİR (REPORT QUESTION) ────────────────
  getReportedQuestions() {
    try {
      const data = localStorage.getItem(this.REPORTED_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  reportQuestion(globalId, reason, comment = "") {
    const reports = this.getReportedQuestions();
    const existing = reports.find(r => r.globalId === globalId);

    const reportData = {
      globalId,
      reason,
      comment,
      reportedAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, reportData);
    } else {
      reports.push(reportData);
    }

    try {
      localStorage.setItem(this.REPORTED_KEY, JSON.stringify(reports));
    } catch (e) {
      console.error("Hata bildirimi kaydedilemedi:", e);
    }

    return true;
  },

  isReported(globalId) {
    const reports = this.getReportedQuestions();
    return reports.some(r => r.globalId === globalId);
  },

  // ─── YANLIŞ SORULAR DEFTERİ METOTLARI ──────────────────────
  getWrongQuestionsDetailed(allQuestions) {
    const progress = this.getProgress();
    const wrongList = [];

    allQuestions.forEach(q => {
      const ans = progress.answers[q._globalId];
      if (ans && !ans.correct) {
        wrongList.push({
          ...q,
          selectedWrongAnswer: ans.selected,
          answeredDate: ans.date
        });
      }
    });

    return wrongList;
  },

  getWrongStatsByTopic(allQuestions) {
    const wrongQuestions = this.getWrongQuestionsDetailed(allQuestions);
    const topicMap = {};

    wrongQuestions.forEach(q => {
      const topic = q.konu || "Genel Tarih";
      if (!topicMap[topic]) topicMap[topic] = [];
      topicMap[topic].push(q);
    });

    return Object.entries(topicMap)
      .map(([konu, list]) => ({ konu, count: list.length, list }))
      .sort((a, b) => b.count - a.count);
  },

  clearWrongAnswer(globalId) {
    const progress = this.getProgress();
    if (progress.answers[globalId]) {
      delete progress.answers[globalId];
      progress.stats.totalWrong = Math.max(0, progress.stats.totalWrong - 1);
      this.saveProgress(progress);
    }
  },

  toggleBookmark(globalId) {
    const progress = this.getProgress();
    const idx = progress.bookmarks.indexOf(globalId);
    if (idx >= 0) {
      progress.bookmarks.splice(idx, 1);
    } else {
      progress.bookmarks.push(globalId);
    }
    this.saveProgress(progress);
    return progress.bookmarks.includes(globalId);
  },

  isBookmarked(globalId) {
    return this.getProgress().bookmarks.includes(globalId);
  },

  getAnswer(globalId) {
    return this.getProgress().answers[globalId] || null;
  },

  getTopicStats(sorular) {
    const progress = this.getProgress();
    const konular = this.getKonular(sorular);

    return konular.map(({ konu, count }) => {
      const konuSorulari = sorular.filter(q => q.konu === konu);
      let answered = 0, correct = 0;

      konuSorulari.forEach(q => {
        const ans = progress.answers[q._globalId];
        if (ans) {
          answered++;
          if (ans.correct) correct++;
        }
      });

      return {
        konu,
        total: count,
        answered,
        correct,
        wrong: answered - correct,
        percentage: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        progress: Math.round((answered / count) * 100),
      };
    });
  },

  getDailyStats() {
    const progress = this.getProgress();
    const today = new Date().toISOString().split("T")[0];
    const todayHistory = progress.history.find(h => h.date === today);

    return {
      answeredToday: todayHistory ? todayHistory.answered : 0,
      correctToday: todayHistory ? todayHistory.correct : 0,
      dailyGoal: progress.stats.dailyGoal,
      streak: progress.stats.streak,
      bestStreak: progress.stats.bestStreak,
      totalAnswered: progress.stats.totalAnswered,
      totalCorrect: progress.stats.totalCorrect,
      totalWrong: progress.stats.totalWrong,
      successRate: progress.stats.totalAnswered > 0
        ? Math.round((progress.stats.totalCorrect / progress.stats.totalAnswered) * 100)
        : 0,
    };
  },

  getWeeklyHistory() {
    const progress = this.getProgress();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
      const record = progress.history.find(h => h.date === dateStr);
      days.push({
        day: dayNames[date.getDay()],
        date: dateStr,
        answered: record ? record.answered : 0,
        correct: record ? record.correct : 0,
      });
    }
    return days;
  },

  getRandomQuestions(sorular, count = 10) {
    const shuffled = [...sorular].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  getUnansweredQuestions(sorular) {
    const progress = this.getProgress();
    return sorular.filter(q => !progress.answers[q._globalId]);
  },

  getWrongQuestions(sorular) {
    const progress = this.getProgress();
    return sorular.filter(q => {
      const ans = progress.answers[q._globalId];
      return ans && !ans.correct;
    });
  },

  resetProgress() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.REPORTED_KEY);
  },
};

// ─── TEMA YÖNETİMİ ──────────────────────────────────────────
const ThemeManager = {
  THEME_KEY: "kpss_theme",

  getTheme() {
    return localStorage.getItem(this.THEME_KEY) || "dark";
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.updateToggleButtons(theme);
  },

  toggleTheme() {
    const current = this.getTheme();
    const next = current === "dark" ? "light" : "dark";
    this.setTheme(next);
  },

  initTheme() {
    const theme = this.getTheme();
    document.documentElement.setAttribute("data-theme", theme);
    this.renderThemeToggleButton();
  },

  renderThemeToggleButton() {
    const container = document.querySelector(".navbar .container");
    if (!container || document.getElementById("theme-toggle-btn")) return;

    let rightGroup = container.querySelector(".navbar-right");
    if (!rightGroup) {
      rightGroup = document.createElement("div");
      rightGroup.className = "navbar-right";
      const links = container.querySelector(".navbar-links");
      if (links) rightGroup.appendChild(links);
      container.appendChild(rightGroup);
    }

    const btn = document.createElement("button");
    btn.id = "theme-toggle-btn";
    btn.className = "theme-toggle-btn";
    btn.onclick = () => ThemeManager.toggleTheme();
    rightGroup.appendChild(btn);

    this.updateToggleButtons(this.getTheme());
  },

  updateToggleButtons(theme) {
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.innerHTML = theme === "dark" 
        ? "☀️ <span>Aydınlık</span>" 
        : "🌙 <span>Karanlık</span>";
    }
  }
};

// ─── UTILITY FOR REPORT MODAL ──────────────────────────────
function openReportModal(globalId) {
  let modal = document.getElementById("report-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "report-modal";
    modal.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); padding:1rem;";
    document.body.appendChild(modal);
  }

  const isAlreadyReported = DataManager.isReported(globalId);

  modal.innerHTML = `
    <div class="card animate-in" style="max-width: 450px; width: 100%; border-color: rgba(239, 68, 68, 0.4);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="display:flex; align-items:center; gap:0.4rem; color:var(--text-primary);">
          <span>🚩 Soru Hatalı Bildir</span>
        </h3>
        <button class="btn btn-ghost btn-sm" onclick="closeReportModal()">✕</button>
      </div>

      ${isAlreadyReported ? `
        <div class="explanation-box wrong" style="margin-bottom: 1rem;">
          ⚠️ Bu soru için daha önce hatalı bildirimi yapılmıştır. İnceleme sürecindedir.
        </div>
      ` : ''}

      <div style="margin-bottom: 1rem;">
        <label class="filter-label" style="margin-bottom: 0.4rem; display:block;">Hata Türü</label>
        <select class="filter-select" id="report-reason" style="width: 100%;">
          <option value="Yanlış Cevap Şıkkı">Yanlış Cevap Şıkkı</option>
          <option value="Tarihsel Bilgi Hatası">Tarihsel Bilgi Hatası</option>
          <option value="Yazım / İmla Hatası">Yazım / İmla Hatası</option>
          <option value="Şık Eksikliği veya Çelişki">Şık Eksikliği veya Çelişki</option>
          <option value="Diğer">Diğer</option>
        </select>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <label class="filter-label" style="margin-bottom: 0.4rem; display:block;">Açıklama (Opsiyonel)</label>
        <textarea id="report-comment" rows="3" class="filter-select" style="width: 100%; resize: vertical;" placeholder="Hatayı veya doğru cevabı kısaca açıklayabilirsiniz..."></textarea>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button class="btn btn-ghost" onclick="closeReportModal()">İptal</button>
        <button class="btn btn-primary" onclick="submitReport('${globalId}')" style="background: var(--gradient-danger); border: none;">
          🚩 Bildirimi Gönder
        </button>
      </div>
    </div>
  `;
}

function closeReportModal() {
  const modal = document.getElementById("report-modal");
  if (modal) modal.remove();
}

function submitReport(globalId) {
  const reason = document.getElementById("report-reason").value;
  const comment = document.getElementById("report-comment").value;

  DataManager.reportQuestion(globalId, reason, comment);
  closeReportModal();

  const reportBtn = document.getElementById(`report-btn-${globalId}`);
  if (reportBtn) {
    reportBtn.innerHTML = "🚩 Bildirildi";
    reportBtn.style.color = "var(--accent-danger)";
    reportBtn.disabled = true;
  }

  const container = document.getElementById("toast-container");
  if (container) {
    const toast = document.createElement("div");
    toast.className = "toast success";
    toast.textContent = "🚩 Soru bildirimi kaydedildi. Teşekkür ederiz!";
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.initTheme();
});

window.DataManager = DataManager;
window.ThemeManager = ThemeManager;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.submitReport = submitReport;
