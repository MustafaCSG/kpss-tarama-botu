/**
 * KPSS Tarama Botu — İstatistik Sayfası
 */

document.addEventListener("DOMContentLoaded", async () => {
  const pastQuestions = await DataManager.loadPastQuestions();
  const allQuestions = await DataManager.loadAllQuestions();
  
  const dailyStats = DataManager.getDailyStats();
  const topicStats = DataManager.getTopicStats(pastQuestions);
  const weeklyHistory = DataManager.getWeeklyHistory();

  renderGeneralStats(allQuestions, dailyStats);
  renderTopicChart(topicStats);
  renderSuccessCircle(dailyStats);
  renderWeeklyActivity(weeklyHistory);
  renderExamChart(pastQuestions);
});

function renderGeneralStats(sorular, stats) {
  const container = document.getElementById("general-stats");
  const remaining = sorular.length - stats.totalAnswered;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon purple">📝</div>
      <div class="stat-info">
        <div class="stat-label">Toplam Çözülen</div>
        <div class="stat-value">${stats.totalAnswered}</div>
        <div class="stat-change text-muted">${sorular.length} soruda</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">✅</div>
      <div class="stat-info">
        <div class="stat-label">Doğru</div>
        <div class="stat-value">${stats.totalCorrect}</div>
        <div class="stat-change text-success">%${stats.successRate}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon red">❌</div>
      <div class="stat-info">
        <div class="stat-label">Yanlış</div>
        <div class="stat-value">${stats.totalWrong}</div>
        <div class="stat-change text-danger">${stats.totalAnswered > 0 ? Math.round((stats.totalWrong / stats.totalAnswered) * 100) : 0}%</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue">📋</div>
      <div class="stat-info">
        <div class="stat-label">Kalan</div>
        <div class="stat-value">${remaining}</div>
        <div class="stat-change text-muted">${Math.round((stats.totalAnswered / sorular.length) * 100)}% tamamlandı</div>
      </div>
    </div>
  `;
}

function renderTopicChart(topicStats) {
  const container = document.getElementById("topic-chart");
  const maxTotal = Math.max(...topicStats.map(t => t.total), 1);

  container.innerHTML = topicStats.map(topic => {
    const correctWidth = topic.total > 0 ? (topic.correct / maxTotal) * 100 : 0;
    const wrongWidth = topic.total > 0 ? (topic.wrong / maxTotal) * 100 : 0;

    return `
      <div class="bar-item">
        <div class="bar-label">${topic.konu.length > 25 ? topic.konu.substring(0, 25) + "..." : topic.konu}</div>
        <div class="bar-track">
          <div style="display: flex; height: 100%;">
            <div class="bar-fill success" style="width: ${correctWidth}%">
              ${topic.correct > 0 ? `<span>${topic.correct}✓</span>` : ""}
            </div>
            <div class="bar-fill danger" style="width: ${wrongWidth}%">
              ${topic.wrong > 0 ? `<span>${topic.wrong}✗</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderSuccessCircle(stats) {
  const container = document.getElementById("success-circle-area");
  const pct = stats.successRate;
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  container.innerHTML = `
    <div style="position: relative; width: 140px; height: 140px;">
      <svg viewBox="0 0 140 140" width="140" height="140">
        <defs>
          <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${color}" />
            <stop offset="100%" stop-color="${color}88" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="10" />
        <circle cx="70" cy="70" r="60" fill="none" stroke="url(#circleGrad)" stroke-width="10" 
                stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                transform="rotate(-90 70 70)" style="transition: stroke-dashoffset 1.5s ease;" />
      </svg>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
        <div style="font-size: 2rem; font-weight: 800; color: ${color};">%${pct}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Başarı</div>
      </div>
    </div>
  `;
}

function renderWeeklyActivity(weeklyHistory) {
  const container = document.getElementById("weekly-activity");
  const maxVal = Math.max(...weeklyHistory.map(d => d.answered), 1);

  container.innerHTML = weeklyHistory.map(day => {
    const height = Math.max((day.answered / maxVal) * 100, 5);
    const correctPct = day.answered > 0 ? Math.round((day.correct / day.answered) * 100) : 0;
    const color = day.answered === 0 ? "rgba(255,255,255,0.05)"
      : correctPct >= 70 ? "var(--accent-success)"
      : correctPct >= 40 ? "var(--accent-warning)"
      : "var(--accent-danger)";

    return `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; flex: 1;">
        <div style="font-size: 0.7rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
          ${day.answered}
        </div>
        <div style="width: 100%; height: ${height}%; min-height: 4px; background: ${color}; border-radius: 4px; transition: height 0.8s ease;"></div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">${day.day}</div>
      </div>
    `;
  }).join("");
}

function renderExamChart(sorular) {
  const container = document.getElementById("exam-chart");
  const progress = DataManager.getProgress();
  
  const examGroups = {};
  sorular.forEach(q => {
    if (!q.sinav) return;
    if (!examGroups[q.sinav]) examGroups[q.sinav] = { total: 0, answered: 0, correct: 0 };
    examGroups[q.sinav].total++;
    const ans = progress.answers[q._globalId];
    if (ans) {
      examGroups[q.sinav].answered++;
      if (ans.correct) examGroups[q.sinav].correct++;
    }
  });

  const sorted = Object.entries(examGroups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);
  
  const maxTotal = Math.max(...sorted.map(([, v]) => v.total), 1);

  container.innerHTML = sorted.map(([sinav, data]) => {
    const width = (data.total / maxTotal) * 100;
    return `
      <div class="bar-item">
        <div class="bar-label">${sinav.length > 22 ? sinav.substring(0, 22) + "..." : sinav}</div>
        <div class="bar-track">
          <div class="bar-fill primary" style="width: ${width}%">
            <span>${data.total}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function resetAll() {
  if (confirm("Tüm ilerlemeniz silinecek. Emin misiniz?")) {
    DataManager.resetProgress();
    location.reload();
  }
}
