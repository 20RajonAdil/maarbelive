(function () {
  "use strict";

  // ---- Shared Reports Config (jstash trial bin) ----
  const SHARED_API = "https://api.jstash.app/v1/bins/qIkmJyRs5uFKBpGpTm-Z2w/content";
  const EDIT_TOKEN = "js_edit_Fin1alMxk565CdVqED_Yge1CBChknXAq1SWHmhOyxBY";

  // ---- Helpers ----
  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function getGroupId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get("group") || params.get("id") || params.get("g");
    if (!id) {
      id = "g" + Math.random().toString(36).slice(2, 8);
      const url = new URL(window.location.href);
      url.searchParams.set("group", id);
      window.history.replaceState({}, "", url.toString());
    }
    return id;
  }

  function isAdminMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("admin") === "1" || params.get("admin") === "true";
  }

  const STORAGE_KEY = "maar_believe_progress_";

  // ---- State ----
  const groupId = getGroupId();
  let viewerName = "";
  let maxWatched = 0;
  let skipAttempts = 0;
  let pauseCount = 0;
  let sessionCount = 1;
  let isSeeking = false;
  let lastSave = 0;
  let nameEntered = false;
  let lastSharedSync = 0;

  // ---- DOM ----
  const nameGate = document.getElementById("nameGate");
  const nameInput = document.getElementById("nameInput");
  const startBtn = document.getElementById("startBtn");
  const mainApp = document.getElementById("mainApp");

  const video = document.getElementById("video");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const seekBar = document.getElementById("seekBar");
  const watchedBar = document.getElementById("watchedBar");
  const currentBar = document.getElementById("currentBar");
  const timeDisplay = document.getElementById("timeDisplay");
  const muteBtn = document.getElementById("muteBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const seekWarning = document.getElementById("seekWarning");
  const controls = document.getElementById("controls");
  const percentWatchedEl = document.getElementById("percentWatched");
  const maxTimeEl = document.getElementById("maxTime");
  const skipCountEl = document.getElementById("skipCount");
  const pauseCountEl = document.getElementById("pauseCount");
  const sessionCountEl = document.getElementById("sessionCount");
  const statusEl = document.getElementById("status");
  const groupIdDisplay = document.getElementById("groupIdDisplay");
  const viewerNameDisplay = document.getElementById("viewerNameDisplay");

  groupIdDisplay.textContent = groupId;

  // ---- Name Gate ----
  function checkNameInput() {
    const val = nameInput.value.trim();
    startBtn.disabled = val.length < 1;
  }

  nameInput.addEventListener("input", checkNameInput);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !startBtn.disabled) startBtn.click();
  });

  startBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (name.length < 1) return;

    viewerName = name;
    nameEntered = true;
    viewerNameDisplay.textContent = viewerName;

    nameGate.style.display = "none";
    mainApp.style.display = "block";

    saveProgress();
    syncToShared(); // first sync
    showControls();
  });

  // ---- Load / Save local ----
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + groupId);
      if (raw) {
        const data = JSON.parse(raw);
        maxWatched = data.maxWatched || 0;
        skipAttempts = data.skipAttempts || 0;
        pauseCount = data.pauseCount || 0;
        sessionCount = (data.sessionCount || 0) + 1;
        if (data.viewerName) {
          viewerName = data.viewerName;
          nameInput.value = viewerName;
          checkNameInput();
        }
      }
    } catch (e) {
      console.warn("Could not load progress", e);
    }
  }

  function saveProgress() {
    if (!nameEntered && !viewerName) return;
    const now = Date.now();
    if (now - lastSave < 800) return;
    lastSave = now;
    try {
      const data = {
        viewerName,
        maxWatched,
        skipAttempts,
        pauseCount,
        sessionCount,
        lastUpdated: now,
        duration: video.duration || 0
      };
      localStorage.setItem(STORAGE_KEY + groupId, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save progress", e);
    }
  }

  // ---- Shared Reports ----
  async function syncToShared() {
    if (!viewerName || !nameEntered) return;
    const now = Date.now();
    if (now - lastSharedSync < 4000) return; // throttle shared writes
    lastSharedSync = now;

    try {
      // Get current data
      const res = await fetch(SHARED_API);
      let data = { viewers: {} };
      if (res.ok) {
        data = await res.json();
        if (!data.viewers) data.viewers = {};
      }

      const key = groupId + "_" + viewerName.toLowerCase().replace(/\s+/g, "_");
      data.viewers[key] = {
        name: viewerName,
        groupId,
        maxWatched,
        percent: video.duration ? Math.min(100, (maxWatched / video.duration) * 100) : 0,
        skipAttempts,
        pauseCount,
        sessionCount,
        lastUpdated: now,
        duration: video.duration || 0
      };

      await fetch(SHARED_API, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + EDIT_TOKEN
        },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn("Shared sync failed", e);
    }
  }

  async function loadAllReports() {
    try {
      const res = await fetch(SHARED_API + "?t=" + Date.now());
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      return data.viewers || {};
    } catch (e) {
      console.warn("Could not load reports", e);
      return {};
    }
  }

  function updateStatsUI() {
    const dur = video.duration || 1;
    const pct = Math.min(100, (maxWatched / dur) * 100);
    percentWatchedEl.textContent = pct.toFixed(1) + "%";
    maxTimeEl.textContent = formatTime(maxWatched);
    skipCountEl.textContent = skipAttempts;
    pauseCountEl.textContent = pauseCount;
    sessionCountEl.textContent = sessionCount;

    if (pct >= 99.5) {
      statusEl.textContent = "Completed";
      statusEl.style.color = "var(--success)";
    } else if (video.paused) {
      statusEl.textContent = "Paused";
    } else {
      statusEl.textContent = "Watching";
    }
  }

  function showSeekWarning() {
    seekWarning.classList.add("show");
    clearTimeout(showSeekWarning._t);
    showSeekWarning._t = setTimeout(() => seekWarning.classList.remove("show"), 2200);
  }

  // ---- Core restriction ----
  function clampToMax() {
    if (video.currentTime > maxWatched + 0.35) {
      video.currentTime = maxWatched;
      skipAttempts += 1;
      updateStatsUI();
      saveProgress();
      syncToShared();
      showSeekWarning();
      return true;
    }
    return false;
  }

  video.addEventListener("timeupdate", () => {
    if (!nameEntered) return;
    if (!isSeeking && !video.paused) {
      if (video.currentTime > maxWatched) {
        maxWatched = video.currentTime;
        if (maxWatched > (video.duration || 0)) maxWatched = video.duration;
      }
    }
    clampToMax();

    const dur = video.duration || 1;
    const curPct = (video.currentTime / dur) * 100;
    const maxPct = (maxWatched / dur) * 100;
    currentBar.style.width = curPct + "%";
    watchedBar.style.width = maxPct + "%";
    seekBar.value = curPct;
    timeDisplay.textContent = formatTime(video.currentTime) + " / " + formatTime(dur);
    updateStatsUI();
    saveProgress();
    syncToShared();
  });

  seekBar.addEventListener("input", () => {
    if (!nameEntered) return;
    isSeeking = true;
    const dur = video.duration || 1;
    const target = (seekBar.value / 100) * dur;
    if (target > maxWatched + 0.2) {
      seekBar.value = (maxWatched / dur) * 100;
      skipAttempts += 1;
      updateStatsUI();
      saveProgress();
      showSeekWarning();
    } else {
      video.currentTime = target;
    }
  });

  seekBar.addEventListener("change", () => { isSeeking = false; });

  video.addEventListener("seeking", () => {
    if (!nameEntered) return;
    if (video.currentTime > maxWatched + 0.4) {
      video.currentTime = maxWatched;
      skipAttempts += 1;
      updateStatsUI();
      saveProgress();
      showSeekWarning();
    }
  });

  video.addEventListener("seeked", () => {
    clampToMax();
    isSeeking = false;
  });

  playPauseBtn.addEventListener("click", () => {
    if (!nameEntered) return;
    if (video.paused) video.play();
    else video.pause();
  });

  video.addEventListener("play", () => {
    if (!nameEntered) {
      video.pause();
      return;
    }
    playPauseBtn.textContent = "❚❚";
    statusEl.textContent = "Watching";
  });

  video.addEventListener("pause", () => {
    playPauseBtn.textContent = "▶";
    if (!video.ended && nameEntered) {
      pauseCount += 1;
      updateStatsUI();
      saveProgress();
      syncToShared();
    }
  });

  video.addEventListener("ended", () => {
    maxWatched = video.duration;
    playPauseBtn.textContent = "▶";
    updateStatsUI();
    saveProgress();
    syncToShared();
    statusEl.textContent = "Completed";
    statusEl.style.color = "var(--success)";
  });

  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
  });

  fullscreenBtn.addEventListener("click", () => {
    const container = document.querySelector(".video-container");
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  let hideControlsTimer;
  function showControls() {
    controls.classList.add("visible");
    clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => {
      if (!video.paused) controls.classList.remove("visible");
    }, 3000);
  }
  const videoContainer = document.querySelector(".video-container");
  if (videoContainer) {
    videoContainer.addEventListener("mousemove", showControls);
    videoContainer.addEventListener("touchstart", showControls);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      statusEl.textContent = "Tab hidden";
      saveProgress();
      syncToShared();
    } else if (nameEntered) {
      statusEl.textContent = video.paused ? "Paused" : "Watching";
    }
  });

  window.addEventListener("beforeunload", () => {
    saveProgress();
    syncToShared();
  });

  document.addEventListener("keydown", (e) => {
    if (!nameEntered) return;
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      playPauseBtn.click();
    } else if (e.code === "ArrowLeft") {
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.code === "ArrowRight") {
      const target = video.currentTime + 5;
      if (target <= maxWatched + 0.3) {
        video.currentTime = target;
      } else {
        skipAttempts += 1;
        updateStatsUI();
        saveProgress();
        showSeekWarning();
      }
    } else if (e.code === "KeyM") {
      muteBtn.click();
    } else if (e.code === "KeyF") {
      fullscreenBtn.click();
    }
  });

  video.addEventListener("loadedmetadata", () => {
    if (maxWatched > 5 && maxWatched < video.duration - 2) {
      video.currentTime = Math.max(0, maxWatched - 1.5);
    }
    updateStatsUI();
  });

  video.addEventListener("play", function blockPlay(e) {
    if (!nameEntered) {
      e.preventDefault();
      video.pause();
    }
  }, true);

  // ---- Admin Reports UI ----
  function createAdminPanel() {
    if (!isAdminMode()) return;

    const panel = document.createElement("div");
    panel.className = "admin-panel";
    panel.innerHTML = `
      <h2>All Viewers Report</h2>
      <p class="admin-hint">This panel is only visible with <code>?admin=1</code> in the URL. Click refresh to load latest data.</p>
      <button id="refreshReportsBtn" class="refresh-btn">Refresh Reports</button>
      <div id="reportsList" class="reports-list">Loading...</div>
    `;
    mainApp.querySelector("main").appendChild(panel);

    const listEl = document.getElementById("reportsList");
    const refreshBtn = document.getElementById("refreshReportsBtn");

    async function renderReports() {
      listEl.innerHTML = "<p>Loading reports...</p>";
      const viewers = await loadAllReports();
      const entries = Object.values(viewers);

      if (entries.length === 0) {
        listEl.innerHTML = "<p class='no-reports'>No viewers yet. Share the link (without admin=1) so people can watch.</p>";
        return;
      }

      // Sort by lastUpdated descending
      entries.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

      listEl.innerHTML = entries.map(v => {
        const pct = (v.percent || 0).toFixed(1);
        const time = formatTime(v.maxWatched || 0);
        const status = pct >= 99 ? "✅ Completed" : pct > 0 ? "▶ In progress" : "— Not started";
        const updated = v.lastUpdated ? new Date(v.lastUpdated).toLocaleString() : "—";
        return `
          <div class="report-card">
            <div class="report-name">${escapeHtml(v.name || "Unknown")}</div>
            <div class="report-meta">
              <span>${pct}% watched</span>
              <span>${time}</span>
              <span>${status}</span>
            </div>
            <div class="report-details">
              Skips blocked: ${v.skipAttempts || 0} · Pauses: ${v.pauseCount || 0} · Sessions: ${v.sessionCount || 1}<br>
              Last update: ${updated}<br>
              Group: ${v.groupId || "—"}
            </div>
          </div>
        `;
      }).join("");
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    refreshBtn.addEventListener("click", renderReports);
    renderReports();
  }

  // Init
  loadProgress();
  setTimeout(() => nameInput.focus(), 100);

  // Create admin panel after a short delay so mainApp exists
  if (isAdminMode()) {
    // Show main app immediately in admin mode so we can see reports
    nameGate.style.display = "none";
    mainApp.style.display = "block";
    createAdminPanel();
  }
})();
