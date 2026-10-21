// ==========================================================================
// StreamerView: iPhone Camera Experience with Split-Screen Gestures
// ==========================================================================

import { store } from '../services/store.js';

export function renderStreamerView(container, navigate) {
  let mediaStream = null;
  let wakeLock = null;
  let isListeningVoice = false;
  let speechRecognition = null;
  let cheerDrawerOpen = false;

  container.innerHTML = `
    <div class="streamer-container" id="streamer-root">
      <!-- Fullscreen Camera Preview (or simulation canvas) -->
      <video class="camera-preview" id="camera-feed" autoplay playsinline muted></video>
      <canvas class="camera-preview" id="simulated-canvas" style="display: none;"></canvas>

      <!-- Invisible Split Screen Gesture Zones -->
      <div class="split-gesture-overlay" id="split-overlay">
        <div class="gesture-zone" id="zone-left">
          <div class="gesture-zone-hint" id="hint-left">+1 POINT</div>
        </div>
        <div class="gesture-zone" id="zone-right">
          <div class="gesture-zone-hint" id="hint-right">+1 POINT</div>
        </div>
      </div>

      <!-- Top Row Controls -->
      <header class="streamer-top-bar">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="streamer-pill frosted-glass tabular-nums" style="display: flex; align-items: center; gap: 6px;">
            <span class="pulse-dot"></span>
            <span>LIVE</span>
            <span id="txt-viewer-count" style="color: var(--text-secondary);">(3)</span>
          </div>
          <button class="apple-btn" id="btn-end-stream" style="padding: 6px 12px; font-size: 12px;">✕ End</button>
        </div>

        <button class="apple-btn frosted-glass tabular-nums" id="btn-set-counter" style="font-weight: 700; font-size: 14px;">
          SET 1
        </button>

        <button class="apple-btn btn-highlight" id="btn-trigger-highlight">
          ⚡ HIGHLIGHT
        </button>
      </header>

      <!-- Bottom Score Row with Midline Swap Button -->
      <footer class="streamer-bottom-bar">
        <!-- Left Team Card -->
        <div class="streamer-score-card frosted-glass" id="card-left">
          <div>
            <div class="score-team-label" id="lbl-team-left">US</div>
            <div class="score-digit tabular-nums" id="digit-left">18</div>
          </div>
        </div>

        <!-- Midline Swap Sides Button -->
        <button class="apple-btn frosted-glass btn-swap-sides" id="btn-swap-sides" title="Swap Court Sides">
          ⇄
        </button>

        <!-- Right Team Card -->
        <div class="streamer-score-card frosted-glass" id="card-right">
          <div style="text-align: right;">
            <div class="score-team-label" id="lbl-team-right">THEM</div>
            <div class="score-digit tabular-nums" id="digit-right">16</div>
          </div>
        </div>
      </footer>

      <!-- Expandable (+) Cheer Drawer & Voice Mic -->
      <div class="streamer-cheer-shelf">
        <div class="cheer-pill-list" id="cheer-drawer" style="display: none;">
          <button class="apple-btn btn-cheer-pill" data-cheer="⛏️ Amazing Dig">⛏️ Amazing Dig</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="💣 Crazy Kill">💣 Crazy Kill</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="🔥 Ace!">🔥 Ace!</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="💪 Big Block!">💪 Big Block!</button>
          <button class="apple-btn btn-cheer-pill" data-cheer="🎯 Cool Set">🎯 Cool Set</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Comment">
            🎙️
          </button>
          <button class="apple-btn frosted-glass btn-plus-cheer" id="btn-toggle-cheer" title="Cheer Pills">
            +
          </button>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const videoElem = container.querySelector('#camera-feed');
  const canvasElem = container.querySelector('#simulated-canvas');
  const zoneLeft = container.querySelector('#zone-left');
  const zoneRight = container.querySelector('#zone-right');
  const hintLeft = container.querySelector('#hint-left');
  const hintRight = container.querySelector('#hint-right');
  const btnSet = container.querySelector('#btn-set-counter');
  const btnHighlight = container.querySelector('#btn-trigger-highlight');
  const btnSwap = container.querySelector('#btn-swap-sides');
  const btnEnd = container.querySelector('#btn-end-stream');
  const btnToggleCheer = container.querySelector('#btn-toggle-cheer');
  const cheerDrawer = container.querySelector('#cheer-drawer');
  const btnVoiceMic = container.querySelector('#btn-voice-mic');

  const lblTeamLeft = container.querySelector('#lbl-team-left');
  const digitLeft = container.querySelector('#digit-left');
  const lblTeamRight = container.querySelector('#lbl-team-right');
  const digitRight = container.querySelector('#digit-right');
  const cardLeft = container.querySelector('#card-left');
  const cardRight = container.querySelector('#card-right');
  const txtViewerCount = container.querySelector('#txt-viewer-count');

  // --- 1. Camera Initialization & Wake Lock ---
  async function initCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      videoElem.srcObject = mediaStream;
      videoElem.style.display = 'block';
      canvasElem.style.display = 'none';
    } catch (err) {
      console.warn('Real camera not available, falling back to simulated volleyball court:', err);
      startSimulatedVolleyballCourt(canvasElem);
      videoElem.style.display = 'none';
      canvasElem.style.display = 'block';
    }

    // Keep screen awake on iPhone
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      console.log('Wake Lock request ignored or unsupported:', e);
    }
  }

  // --- 2. Update UI from Store ---
  function updateUI() {
    const s = store.getState().activeMatch;
    btnSet.textContent = `SET ${s.currentSet}`;
    txtViewerCount.textContent = `(${s.viewers})`;

    if (s.courtSideUs === 'left') {
      lblTeamLeft.textContent = s.teamUs;
      digitLeft.textContent = s.scoreUs;
      lblTeamRight.textContent = s.teamThem;
      digitRight.textContent = s.scoreThem;
    } else {
      lblTeamLeft.textContent = s.teamThem;
      digitLeft.textContent = s.scoreThem;
      lblTeamRight.textContent = s.teamUs;
      digitRight.textContent = s.scoreUs;
    }
  }

  // --- 3. Invisible Split Screen Gestures (Tap = +1, Swipe Down = -1) ---
  function setupGestures(zoneElem, side, hintElem, cardElem) {
    let startY = 0;
    let startTime = 0;
    let isSwiping = false;

    zoneElem.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
      isSwiping = false;
    }, { passive: true });

    zoneElem.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;
      // If dragged down by 45px or more, consider it a deliberate swipe down (-1)
      if (diffY > 45 && !isSwiping) {
        isSwiping = true;
        store.adjustScore(side, -1);
        flashHint(hintElem, '-1 POINT', 'red');
        animateScoreCard(cardElem, 'down');
      }
    }, { passive: true });

    zoneElem.addEventListener('touchend', (e) => {
      const elapsed = Date.now() - startTime;
      // If it wasn't a swipe and was a quick tap (< 300ms)
      if (!isSwiping && elapsed < 350) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
        animateScoreCard(cardElem, 'up');
      }
    });

    // Also handle desktop mouse click for local browser testing
    zoneElem.addEventListener('click', (e) => {
      // If on desktop without touch
      if (!('ontouchstart' in window)) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
        animateScoreCard(cardElem, 'up');
      }
    });
  }

  function flashHint(elem, text, color) {
    elem.textContent = text;
    elem.style.color = color === 'red' ? 'var(--accent-red)' : 'var(--text-primary)';
    elem.style.opacity = '1';
    setTimeout(() => {
      elem.style.opacity = '0';
    }, 450);
  }

  function animateScoreCard(card, dir) {
    card.style.transform = dir === 'up' ? 'scale(1.08)' : 'translateY(6px) scale(0.96)';
    setTimeout(() => {
      card.style.transform = 'scale(1)';
    }, 150);
  }

  setupGestures(zoneLeft, 'left', hintLeft, cardLeft);
  setupGestures(zoneRight, 'right', hintRight, cardRight);

  // --- 4. Controls Listeners ---
  btnSwap.onclick = (e) => {
    e.stopPropagation();
    store.swapSides();
  };

  btnSet.onclick = (e) => {
    e.stopPropagation();
    const cur = store.getState().activeMatch;
    if (confirm(`Finish Set ${cur.currentSet} and advance to Set ${cur.currentSet + 1}? Current points will reset to 0-0.`)) {
      store.advanceSet();
    }
  };

  btnHighlight.onclick = (e) => {
    e.stopPropagation();
    const clip = store.triggerHighlight();
    btnHighlight.style.transform = 'scale(1.2)';
    btnHighlight.textContent = '✓ SAVED!';
    setTimeout(() => {
      btnHighlight.style.transform = 'scale(1)';
      btnHighlight.textContent = '⚡ HIGHLIGHT';
    }, 1200);
  };

  btnEnd.onclick = (e) => {
    e.stopPropagation();
    if (confirm('End the live broadcast and return to Home Hub?')) {
      store.stopBroadcast();
      cleanup();
      navigate('/');
    }
  };

  // --- 5. Cheer Drawer & Voice Dictation ---
  btnToggleCheer.onclick = (e) => {
    e.stopPropagation();
    cheerDrawerOpen = !cheerDrawerOpen;
    cheerDrawer.style.display = cheerDrawerOpen ? 'flex' : 'none';
    btnToggleCheer.textContent = cheerDrawerOpen ? '✕' : '+';
  };

  container.querySelectorAll('.btn-cheer-pill').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const text = btn.dataset.cheer;
      store.postCheerPill(text);
      cheerDrawerOpen = false;
      cheerDrawer.style.display = 'none';
      btnToggleCheer.textContent = '+';
      flashHint(hintLeft, text, 'gold');
    };
  });

  // Web Speech API Voice-to-Text
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        store.postChatMessage('Broadcaster', transcript);
        flashHint(hintLeft, `"${transcript}"`, 'white');
      }
    };

    speechRecognition.onend = () => {
      isListeningVoice = false;
      btnVoiceMic.classList.remove('listening');
    };

    btnVoiceMic.onclick = (e) => {
      e.stopPropagation();
      if (!isListeningVoice) {
        try {
          speechRecognition.start();
          isListeningVoice = true;
          btnVoiceMic.classList.add('listening');
        } catch (err) {
          console.warn('Speech recognition error:', err);
        }
      } else {
        speechRecognition.stop();
      }
    };
  } else {
    btnVoiceMic.style.display = 'none'; // Not supported in this browser
  }

  // --- 6. Cleanup on route exit ---
  function cleanup() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    if (wakeLock) {
      wakeLock.release().catch(() => {});
    }
  }

  initCamera();
  updateUI();
  const unsubscribe = store.subscribe(updateUI);

  return () => {
    cleanup();
    unsubscribe();
  };
}

// Simulated dynamic volleyball court background for desktop testing
function startSimulatedVolleyballCourt(canvas) {
  const ctx = canvas.getContext('2d');
  let frame = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    frame++;
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Court floor
    const courtY = canvas.height * 0.25;
    const courtH = canvas.height * 0.65;
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(40, courtY, canvas.width - 80, courtH);

    // Court boundary lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, courtY, canvas.width - 80, courtH);

    // Net line (midline)
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, courtY);
    ctx.lineTo(canvas.width / 2, courtY + courtH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated volleyball
    const ballX = canvas.width / 2 + Math.sin(frame * 0.04) * (canvas.width * 0.35);
    const ballY = courtY + courtH * 0.5 - Math.abs(Math.cos(frame * 0.04)) * (courtH * 0.3);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();
}
