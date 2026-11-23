/* ─── Subway Site — Session Logic ─── */

const SESSION_DURATION = 4 * 60;   // 4 minutes in seconds
const COOLDOWN_DURATION = 5 * 60;  // 5 minutes in seconds

const KEY_SESSION_START  = 'subway_session_start';
const KEY_EXPIRED_AT     = 'subway_expired_at';

const boardingScreen = document.getElementById('boarding-screen');
const sessionScreen  = document.getElementById('session-screen');
const waitingScreen  = document.getElementById('waiting-screen');

const timerDisplay   = document.getElementById('timer-display');
const timerBar       = document.getElementById('timer-bar');
const nextTrainTimer = document.getElementById('next-train-timer');
const depTime1       = document.getElementById('dep-time-1');
const stationName    = document.getElementById('station-name');

const boardBtn = document.getElementById('board-btn');

// Station names that scroll while riding
const stations = ['Uptown', 'Midtown', 'Central Station', 'Park Avenue', 'Terminal'];
let stationIndex = 2; // start at "Central"
let stationInterval = null;

/* ─── Helpers ─── */
function showScreen(id) {
  [boardingScreen, sessionScreen, waitingScreen].forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function fmt(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function now() { return Math.floor(Date.now() / 1000); }

/* ─── Session Timer ─── */
let sessionInterval = null;

function startSessionTimer(startedAt) {
  clearInterval(sessionInterval);

  // Animate station names every 50 seconds
  stationIndex = 2;
  stationName.textContent = stations[stationIndex];
  clearInterval(stationInterval);
  stationInterval = setInterval(() => {
    stationIndex = (stationIndex + 1) % stations.length;
    stationName.textContent = stations[stationIndex];
  }, 50000);

  sessionInterval = setInterval(() => {
    const elapsed  = now() - startedAt;
    const remaining = SESSION_DURATION - elapsed;

    if (remaining <= 0) {
      clearInterval(sessionInterval);
      clearInterval(stationInterval);
      // Record expiry time
      localStorage.setItem(KEY_EXPIRED_AT, String(now()));
      localStorage.removeItem(KEY_SESSION_START);
      startWaiting();
      return;
    }

    const pct = (remaining / SESSION_DURATION) * 100;
    timerDisplay.textContent = fmt(remaining);
    timerBar.style.width = pct + '%';

    if (remaining <= 60) {
      timerDisplay.classList.add('urgent');
      timerBar.classList.add('urgent');
    } else {
      timerDisplay.classList.remove('urgent');
      timerBar.classList.remove('urgent');
    }

    // Update map stops
    updateMap(elapsed);
  }, 1000);
}

function updateMap(elapsed) {
  // Progress through 5 stops over the session
  const progress = elapsed / SESSION_DURATION; // 0 → 1
  const currentStop = Math.min(4, Math.floor(progress * 5));

  for (let i = 0; i <= 4; i++) {
    const el = document.getElementById('stop-' + i);
    if (!el) continue;
    el.classList.remove('passed', 'current');
    const dot = el.querySelector('.dot');
    dot.classList.remove('current-dot', 'pulse');

    if (i < currentStop) {
      el.classList.add('passed');
    } else if (i === currentStop) {
      el.classList.add('current');
      dot.classList.add('current-dot', 'pulse');
    }
  }
}

/* ─── Waiting (Cooldown) Timer ─── */
let waitInterval = null;

function startWaiting() {
  showScreen('waiting-screen');
  clearInterval(waitInterval);

  waitInterval = setInterval(() => {
    const expiredAt = parseInt(localStorage.getItem(KEY_EXPIRED_AT) || '0', 10);
    const elapsed   = now() - expiredAt;
    const remaining = COOLDOWN_DURATION - elapsed;

    if (remaining <= 0) {
      clearInterval(waitInterval);
      localStorage.removeItem(KEY_EXPIRED_AT);
      nextTrainTimer.textContent = '0:00';
      depTime1.textContent = 'NOW';
      // Brief pause then show boarding
      setTimeout(() => showScreen('boarding-screen'), 1200);
      return;
    }

    nextTrainTimer.textContent = fmt(remaining);
    depTime1.textContent = fmt(remaining);
  }, 1000);

  // Trigger immediately
  const expiredAt = parseInt(localStorage.getItem(KEY_EXPIRED_AT) || '0', 10);
  const elapsed   = now() - expiredAt;
  const remaining = COOLDOWN_DURATION - elapsed;
  nextTrainTimer.textContent = fmt(remaining);
  depTime1.textContent = fmt(remaining);
}

/* ─── Board Button ─── */
boardBtn.addEventListener('click', () => {
  const start = now();
  localStorage.setItem(KEY_SESSION_START, String(start));
  showScreen('session-screen');
  startSessionTimer(start);
});

/* ─── Init — decide which screen to show ─── */
(function init() {
  const sessionStart = parseInt(localStorage.getItem(KEY_SESSION_START) || '0', 10);
  const expiredAt    = parseInt(localStorage.getItem(KEY_EXPIRED_AT)    || '0', 10);

  if (sessionStart) {
    // Mid-session resume
    const elapsed = now() - sessionStart;
    if (elapsed < SESSION_DURATION) {
      showScreen('session-screen');
      startSessionTimer(sessionStart);
      return;
    } else {
      // Session expired while away — start cooldown from now if none recorded
      if (!expiredAt) {
        localStorage.setItem(KEY_EXPIRED_AT, String(now()));
      }
      localStorage.removeItem(KEY_SESSION_START);
      startWaiting();
      return;
    }
  }

  if (expiredAt) {
    // Mid-cooldown resume
    const elapsed = now() - expiredAt;
    if (elapsed < COOLDOWN_DURATION) {
      startWaiting();
      return;
    } else {
      // Cooldown done
      localStorage.removeItem(KEY_EXPIRED_AT);
    }
  }

  // Fresh visitor — show boarding
  showScreen('boarding-screen');
})();
