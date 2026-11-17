(function () {
  "use strict";

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

  // ---- Name Gate Logic ----
  function checkNameInput() {
    const val = nameInput.value.trim();
    startBtn.disabled = val.length < 1;
  }

  nameInput.addEventListener("input", checkNameInput);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !startBtn.disabled) {
      startBtn.click();
    }
  });

  startBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (name.length < 1) return;

    viewerName = name;
    nameEntered = true;
    viewerNameDisplay.textContent = viewerName;

    // Hide gate, show app
    nameGate.style.display = "none";
    mainApp.style.display = "block";

    // Save name with progress
    saveProgress();

    // Focus video area
    showControls();
  });

  // ---- Load / Save ----
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
        viewerName: viewerName,
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
    showSeekWarning._t = setTimeout(() => {
      seekWarning.classList.remove("show");
    }, 2200);
  }

  // ---- Core restriction logic ----
  function clampToMax() {
    if (video.currentTime > maxWatched + 0.35) {
      video.currentTime = maxWatched;
      skipAttempts += 1;
      updateStatsUI();
      saveProgress();
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

  seekBar.addEventListener("change", () => {
    isSeeking = false;
  });

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

  // Play / Pause
  playPauseBtn.addEventListener("click", () => {
    if (!nameEntered) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
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
    }
  });

  video.addEventListener("ended", () => {
    maxWatched = video.duration;
    playPauseBtn.textContent = "▶";
    updateStatsUI();
    saveProgress();
    statusEl.textContent = "Completed";
    statusEl.style.color = "var(--success)";
  });

  // Mute
  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
  });

  // Fullscreen
  fullscreenBtn.addEventListener("click", () => {
    const container = document.querySelector(".video-container");
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // Show controls
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

  // Visibility / close
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      statusEl.textContent = "Tab hidden";
      saveProgress();
    } else if (nameEntered) {
      statusEl.textContent = video.paused ? "Paused" : "Watching";
    }
  });

  window.addEventListener("beforeunload", () => {
    saveProgress();
  });

  // Keyboard
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

  // Init
  video.addEventListener("loadedmetadata", () => {
    if (maxWatched > 5 && maxWatched < video.duration - 2) {
      video.currentTime = Math.max(0, maxWatched - 1.5);
    }
    updateStatsUI();
  });

  // Prevent play before name
  video.addEventListener("play", function blockPlay(e) {
    if (!nameEntered) {
      e.preventDefault();
      video.pause();
    }
  }, true);

  // Load any previous name/progress
  loadProgress();

  // Auto-focus the name input
  setTimeout(() => nameInput.focus(), 100);
})();
