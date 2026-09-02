/**
 * KPSS Tarama Botu — Dashboard (Ana Sayfa) Mantığı
 */

document.addEventListener("DOMContentLoaded", async () => {
  const pastQuestions = await DataManager.loadPastQuestions();
  const aiQuestions = await DataManager.loadAIQuestions();
  const allQuestions = [...pastQuestions, ...aiQuestions];

  const dailyStats = DataManager.getDailyStats();
  const topicStats = DataManager.getTopicStats(pastQuestions);
  const weeklyHistory = DataManager.getWeeklyHistory();

  renderStatsOverview(pastQuestions.length, aiQuestions.length, dailyStats);
  renderDailyProgress(dailyStats);
  renderWeeklyChart(weeklyHistory);
  renderTopicProgress(topicStats);
  setTodayDate();

  const wrongCount = DataManager.getWrongQuestionsDetailed(allQuestions).length;
  const wrongBadge = document.getElementById("dashboard-wrong-count");
  if (wrongBadge) wrongBadge.textContent = `${wrongCount} Hata`;
});

function renderStatsOverview(pastCount, aiCount, stats) {
  const container = document.getElementById("stats-overview");

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon purple">📚</div>
      <div class="stat-info">
        <div class="stat-label">Çıkmış Sorular</div>
        <div class="stat-value">${pastCount}</div>
        <div class="stat-change text-muted">ÖSYM Gerçek Sınav</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple" style="background: rgba(139, 92, 246, 0.15);">🤖</div>
      <div class="stat-info">
        <div class="stat-label">AI Özgün Sorular</div>
        <div class="stat-value">${aiCount}</div>
        <div class="stat-change text-muted">Çözümlü Soru Deposu</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">✅</div>
      <div class="stat-info">
        <div class="stat-label">Çözülen</div>
        <div class="stat-value">${stats.totalAnswered}</div>
        <div class="stat-change text-success">%${stats.successRate} başarı</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">🔥</div>
      <div class="stat-info">
        <div class="stat-label">Seri</div>
        <div class="stat-value">${stats.streak}</div>
        <div class="stat-change text-muted">En iyi: ${stats.bestStreak}</div>
      </div>
    </div>
  `;
}

function renderDailyProgress(stats) {
  const label = document.getElementById("daily-label");
  const count = document.getElementById("daily-count");
  const bar = document.getElementById("daily-progress");

  const pct = Math.min((stats.answeredToday / stats.dailyGoal) * 100, 100);
  label.textContent = `Bugün ${stats.answeredToday} soru çözüldü`;
  count.textContent = `${stats.answeredToday}/${stats.dailyGoal}`;
  
  setTimeout(() => {
    bar.style.width = pct + "%";
    if (pct >= 100) bar.classList.add("success");
    else if (pct >= 50) bar.classList.add("warning");
  }, 200);
}

function renderWeeklyChart(weeklyHistory) {
  const container = document.getElementById("weekly-chart");
  const maxVal = Math.max(...weeklyHistory.map(d => d.answered), 1);

  container.innerHTML = weeklyHistory.map(day => {
    const height = Math.max((day.answered / maxVal) * 60, 4);
    const correctPct = day.answered > 0 ? Math.round((day.correct / day.answered) * 100) : 0;
    const color = day.answered === 0 
      ? "rgba(148,163,184,0.15)" 
      : correctPct >= 70 
        ? "var(--accent-success)" 
        : correctPct >= 40 
          ? "var(--accent-warning)" 
          : "var(--accent-danger)";
    
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem; flex:1;">
        <div style="font-size:0.7rem; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">
          ${day.answered}
        </div>
        <div style="width:100%; height:${height}px; background:${color}; border-radius:4px; transition: height 0.5s ease;"></div>
        <div style="font-size:0.7rem; color:var(--text-muted);">${day.day}</div>
      </div>
    `;
  }).join("");
}

function renderTopicProgress(topicStats) {
  const container = document.getElementById("topic-progress");
  
  const topicEmojis = {
    "İslam Öncesi Türk Tarihi": "🏹",
    "İlk Türk İslam Devletleri": "☪️",
    "Beylikler Dönemi ve Türkiye Selçuklu Devleti": "🏰",
    "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri": "⚔️",
    "Osmanlı Kültür ve Medeniyeti": "🕌",
  };

  container.innerHTML = topicStats.map(topic => {
    const emoji = topicEmojis[topic.konu] || "📖";
    const fillClass = topic.percentage >= 70 ? "success" : topic.percentage >= 40 ? "warning" : "";

    return `
      <div class="progress-item">
        <div class="progress-header">
          <span class="progress-title">${emoji} ${topic.konu}</span>
          <span class="progress-count">${topic.answered}/${topic.total} (${topic.percentage}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${fillClass}" style="width: ${topic.progress}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function setTodayDate() {
  const el = document.getElementById("today-date");
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  el.textContent = now.toLocaleDateString("tr-TR", options);
}
