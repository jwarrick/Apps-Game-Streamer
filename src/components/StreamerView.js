// ==========================================================================
// StreamerView: iPhone Camera Experience with Split Gestures, Corner Scores,
// Highlight Pill Picker, and Slide-Out Comment Drawer
// ==========================================================================

import { store } from '../services/store.js';
import { getBroadcastIcon } from './icons.js';

export function renderStreamerView(container, navigate) {
  let mediaStream = null;
  let wakeLock = null;
  let isListeningVoice = false;
  let speechRecognition = null;
  let lastSeenMessageCount = store.getState().chat.length;

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
            ${getBroadcastIcon(13, 'var(--accent-red)')}
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

      <!-- Bottom Score Row (No Boxes, Clean Text, Scores in Outer Corners) -->
      <footer class="streamer-bottom-bar">
        <!-- Left Corner: <score> <name> -->
        <div class="score-side-left" id="side-left">
          <span class="score-digit tabular-nums" id="digit-left">0</span>
          <span class="score-team-label" id="lbl-team-left">US</span>
        </div>

        <!-- Midline Swap Sides Button -->
        <button class="apple-btn frosted-glass btn-swap-sides" id="btn-swap-sides" title="Swap Court Sides">
          ⇄
        </button>

        <!-- Right Corner: <name> <score> -->
        <div class="score-side-right" id="side-right">
          <span class="score-team-label" id="lbl-team-right">LINCOLN</span>
          <span class="score-digit tabular-nums" id="digit-right">0</span>
        </div>
      </footer>

      <!-- Broadcaster Comments Edge Tab (Pulsing when unread) -->
      <div class="streamer-chat-tab" id="chat-edge-tab" title="View Viewer Comments">
        <span>💬</span>
        <span id="chat-tab-count"></span>
      </div>

      <!-- Slide-Out Semi-Transparent Comments Drawer -->
      <div class="streamer-chat-drawer" id="streamer-chat-drawer">
        <div class="streamer-drawer-header">
          <h3>Viewer Comments</h3>
          <button class="btn-drawer-close" id="btn-close-drawer" title="Close Drawer (Slide right)" aria-label="Close Drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        <div class="streamer-drawer-messages" id="drawer-chat-list">
          <!-- Comments stream here -->
        </div>

        <div class="dictation-status" id="dictation-status" style="display: none; padding: 6px 14px; font-size: 13px; color: var(--accent-gold); background: rgba(0,0,0,0.35); text-align: center;"></div>

        <div class="streamer-drawer-input-row">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Dictation">
            🎙️
          </button>
          <input type="text" class="simple-input" id="input-drawer-msg" placeholder="Speak or type a comment..." style="padding: 10px 14px; font-size: 15px;" />
          <button class="apple-btn apple-btn-primary" id="btn-send-drawer-msg" style="padding: 10px 16px; font-size: 14px; font-weight: 600;">Send</button>
        </div>
      </div>

      <!-- Highlight Pill Picker Modal (Appears when ⚡ HIGHLIGHT is pressed) -->
      <div class="highlight-pill-backdrop" id="highlight-pill-modal" style="display: none;">
        <div class="highlight-pill-dialog">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 16px; font-weight: 700;">Select Highlight Type</h3>
            <button class="apple-btn" id="btn-cancel-highlight" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary);">Choose a highlight tag to save and label the rally:</p>

          <div class="highlight-pill-grid">
            <button class="apple-btn btn-highlight-select" data-label="⛏️ Amazing Dig">⛏️ Amazing Dig</button>
            <button class="apple-btn btn-highlight-select" data-label="💣 Crazy Kill">💣 Crazy Kill</button>
            <button class="apple-btn btn-highlight-select" data-label="🔥 Ace!">🔥 Ace!</button>
            <button class="apple-btn btn-highlight-select" data-label="💪 Big Block!">💪 Big Block!</button>
            <button class="apple-btn btn-highlight-select" data-label="🎯 Cool Set">🎯 Cool Set</button>
            <button class="apple-btn btn-highlight-select" data-label="⏱️ Long Point">⏱️ Long Point</button>
          </div>
        </div>
      </div>

      <!-- Set Action Modal (Next Set, Match Finished, Cancel, Reset) -->
      <div class="highlight-pill-backdrop" id="set-action-modal" style="display: none;">
        <div class="highlight-pill-dialog" style="max-width: 320px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 16px; font-weight: 700;" id="set-modal-title">Set 1 Options</h3>
            <button class="apple-btn" id="btn-cancel-set-modal" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary);" id="set-modal-score">Current Score: US 0 - 0 LINCOLN</p>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
            <button class="apple-btn apple-btn-primary" id="btn-modal-next-set" style="padding: 12px; font-size: 14px; font-weight: 600;">
              ▶ Next Set
            </button>
            <button class="apple-btn apple-btn-danger" id="btn-modal-finish-match" style="padding: 12px; font-size: 14px; font-weight: 600;">
              🏆 Match Finished
            </button>
            <button class="apple-btn" id="btn-modal-reset-set" style="padding: 10px; font-size: 13px; color: var(--accent-gold);">
              🔄 Reset Set Score to 0 - 0
            </button>
            <button class="apple-btn" id="btn-modal-close-set" style="padding: 10px; font-size: 13px;">
              Cancel
            </button>
          </div>
        </div>
      </div>
      <!-- Exit Broadcast Modal (Pause Broadcast vs Finish Match) -->
      <div class="highlight-pill-backdrop" id="exit-broadcast-modal" style="display: none;">
        <div class="highlight-pill-dialog" style="max-width: 330px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 16px; font-weight: 700;">Leave Broadcast</h3>
            <button class="apple-btn" id="btn-cancel-exit-modal" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 6px 0 14px 0;">
            Would you like to pause and keep this match in progress, or finalize the match score?
          </p>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="apple-btn apple-btn-primary" id="btn-pause-stream" style="padding: 12px; font-size: 14px; font-weight: 600; text-align: left; display: flex; flex-direction: column; gap: 2px;">
              <span>⏸ Pause Broadcast</span>
              <span style="font-size: 11px; font-weight: 400; opacity: 0.85;">Keeps match in progress. You can resume and append highlights later today.</span>
            </button>
            <button class="apple-btn apple-btn-danger" id="btn-finish-stream" style="padding: 12px; font-size: 14px; font-weight: 600; text-align: left; display: flex; flex-direction: column; gap: 2px;">
              <span>🏆 Finish Match</span>
              <span style="font-size: 11px; font-weight: 400; opacity: 0.85;">Awards current set, finalizes match score and archives transcript.</span>
            </button>
            <button class="apple-btn" id="btn-cancel-exit-action" style="padding: 10px; font-size: 13px; margin-top: 4px;">
              Cancel (Stay in Broadcast)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Elements
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

  const lblTeamLeft = container.querySelector('#lbl-team-left');
  const digitLeft = container.querySelector('#digit-left');
  const lblTeamRight = container.querySelector('#lbl-team-right');
  const digitRight = container.querySelector('#digit-right');
  const txtViewerCount = container.querySelector('#txt-viewer-count');

  // Highlight modal elements
  const highlightModal = container.querySelector('#highlight-pill-modal');
  const btnCancelHighlight = container.querySelector('#btn-cancel-highlight');

  // Set action modal elements
  const setActionModal = container.querySelector('#set-action-modal');
  const setModalTitle = container.querySelector('#set-modal-title');
  const setModalScore = container.querySelector('#set-modal-score');
  const btnModalNextSet = container.querySelector('#btn-modal-next-set');
  const btnModalFinishMatch = container.querySelector('#btn-modal-finish-match');
  const btnModalResetSet = container.querySelector('#btn-modal-reset-set');
  const btnModalCloseSet = container.querySelector('#btn-modal-close-set');
  const btnCancelSetModal = container.querySelector('#btn-cancel-set-modal');

  // Exit broadcast modal elements
  const exitModal = container.querySelector('#exit-broadcast-modal');
  const btnPauseStream = container.querySelector('#btn-pause-stream');
  const btnFinishStream = container.querySelector('#btn-finish-stream');
  const btnCancelExitModal = container.querySelector('#btn-cancel-exit-modal');
  const btnCancelExitAction = container.querySelector('#btn-cancel-exit-action');

  // Chat drawer elements
  const chatEdgeTab = container.querySelector('#chat-edge-tab');
  const chatTabCount = container.querySelector('#chat-tab-count');
  const chatDrawer = container.querySelector('#streamer-chat-drawer');
  const btnCloseDrawer = container.querySelector('#btn-close-drawer');
  const drawerChatList = container.querySelector('#drawer-chat-list');
  const inputDrawerMsg = container.querySelector('#input-drawer-msg');
  const btnSendDrawerMsg = container.querySelector('#btn-send-drawer-msg');
  const btnVoiceMic = container.querySelector('#btn-voice-mic');
  const dictationStatus = container.querySelector('#dictation-status');

  // --- 1. Camera Initialization & Wake Lock ---
  async function initCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false // audio: false allows SpeechRecognition to access the mic exclusively without iOS Safari audio session contention
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

    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      console.log('Wake Lock ignored or unsupported:', e);
    }
  }

  // --- 2. Update UI from Store ---
  function updateUI() {
    const s = store.getState().activeMatch;
    const isVictory = store.checkSetVictory();

    if (isVictory) {
      btnSet.classList.add('pulse-victory');
    } else {
      btnSet.classList.remove('pulse-victory');
    }
    btnSet.textContent = `SET ${s.currentSet}`;
    txtViewerCount.textContent = `(${s.viewers})`;

    // Score layout:
    // Left side: <score> <name>
    // Right side: <name> <score>
    // Team name "US" for our team, uppercase opponent for their team
    const teamUs = 'US';
    const teamThem = (s.opponent || 'THEM').toUpperCase();

    if (s.courtSideUs === 'left') {
      digitLeft.textContent = s.scoreUs;
      lblTeamLeft.textContent = teamUs;
      lblTeamRight.textContent = teamThem;
      digitRight.textContent = s.scoreThem;
    } else {
      digitLeft.textContent = s.scoreThem;
      lblTeamLeft.textContent = teamThem;
      lblTeamRight.textContent = teamUs;
      digitRight.textContent = s.scoreUs;
    }

    // Update Drawer Comments and Edge Tab
    const chatList = store.getState().chat;
    const isDrawerOpen = chatDrawer.classList.contains('open');

    drawerChatList.innerHTML = chatList.map(msg => `
      <div class="chat-bubble">
        <div class="sender">${msg.sender} ${msg.score ? `(Set ${msg.set} • ${msg.score})` : ''}</div>
        <div style="font-weight: ${msg.isCheer ? '700' : '400'}; color: ${msg.isCheer ? 'var(--accent-gold)' : 'inherit'};">
          ${msg.text}
        </div>
      </div>
    `).join('');

    if (isDrawerOpen) {
      lastSeenMessageCount = chatList.length;
      chatEdgeTab.classList.remove('pulsing');
      chatTabCount.textContent = '';
      drawerChatList.scrollTop = drawerChatList.scrollHeight;
    } else {
      const unread = Math.max(0, chatList.length - lastSeenMessageCount);
      if (unread > 0) {
        chatEdgeTab.classList.add('pulsing');
        chatTabCount.textContent = `${unread}`;
      } else {
        chatEdgeTab.classList.remove('pulsing');
        chatTabCount.textContent = '';
      }
    }
  }

  // --- 3. Split-Screen Touch Gestures (Tap = +1, Swipe Down = -1) ---
  function setupGestures(zoneElem, side, hintElem) {
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
      if (diffY > 45 && !isSwiping) {
        isSwiping = true;
        store.adjustScore(side, -1);
        flashHint(hintElem, '-1 POINT', 'red');
      }
    }, { passive: true });

    zoneElem.addEventListener('touchend', (e) => {
      const elapsed = Date.now() - startTime;
      if (!isSwiping && elapsed < 350) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
      }
    });

    zoneElem.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
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

  setupGestures(zoneLeft, 'left', hintLeft);
  setupGestures(zoneRight, 'right', hintRight);

  // --- 4. Controls Listeners ---
  btnSwap.onclick = (e) => {
    e.stopPropagation();
    store.swapSides();
  };

  btnSet.onclick = (e) => {
    e.stopPropagation();
    const cur = store.getState().activeMatch;
    const teamThem = (cur.opponent || 'THEM').toUpperCase();
    setModalTitle.textContent = `Set ${cur.currentSet} Options`;
    setModalScore.textContent = `Current Score: US ${cur.scoreUs} - ${cur.scoreThem} ${teamThem}`;
    setActionModal.style.display = 'flex';
  };

  btnModalNextSet.onclick = (e) => {
    e.stopPropagation();
    store.advanceSet();
    setActionModal.style.display = 'none';
  };

  btnModalResetSet.onclick = (e) => {
    e.stopPropagation();
    store.resetScores();
    setActionModal.style.display = 'none';
  };

  btnModalFinishMatch.onclick = (e) => {
    e.stopPropagation();
    store.finishMatch();
    setActionModal.style.display = 'none';
    cleanup();
    navigate('/');
  };

  btnModalCloseSet.onclick = (e) => {
    e.stopPropagation();
    setActionModal.style.display = 'none';
  };

  btnCancelSetModal.onclick = (e) => {
    e.stopPropagation();
    setActionModal.style.display = 'none';
  };

  setActionModal.onclick = (e) => {
    if (e.target === setActionModal) {
      setActionModal.style.display = 'none';
    }
  };

  btnEnd.onclick = (e) => {
    e.stopPropagation();
    exitModal.style.display = 'flex';
  };

  btnPauseStream.onclick = (e) => {
    e.stopPropagation();
    store.pauseBroadcast();
    exitModal.style.display = 'none';
    cleanup();
    navigate('/');
  };

  btnFinishStream.onclick = (e) => {
    e.stopPropagation();
    store.finishMatch();
    exitModal.style.display = 'none';
    cleanup();
    navigate('/');
  };

  const closeExitModal = () => { exitModal.style.display = 'none'; };
  btnCancelExitModal.onclick = closeExitModal;
  btnCancelExitAction.onclick = closeExitModal;
  exitModal.onclick = (e) => {
    if (e.target === exitModal) closeExitModal();
  };

  // --- 5. Highlight Pill Picker Trigger ---
  btnHighlight.onclick = (e) => {
    e.stopPropagation();
    highlightModal.style.display = 'flex';
  };

  btnCancelHighlight.onclick = (e) => {
    e.stopPropagation();
    highlightModal.style.display = 'none';
  };

  highlightModal.onclick = (e) => {
    if (e.target === highlightModal) {
      highlightModal.style.display = 'none';
    }
  };

  container.querySelectorAll('.btn-highlight-select').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const label = btn.dataset.label;
      store.triggerHighlight(label);
      highlightModal.style.display = 'none';

      btnHighlight.style.transform = 'scale(1.15)';
      btnHighlight.textContent = '✓ SAVED!';
      flashHint(hintLeft, label, 'gold');
      setTimeout(() => {
        btnHighlight.style.transform = 'scale(1)';
        btnHighlight.textContent = '⚡ HIGHLIGHT';
      }, 1200);
    };
  });

  // --- 6. Broadcaster Chat Drawer & Voice-to-Text ---
  function openDrawer() {
    chatDrawer.classList.add('open');
    lastSeenMessageCount = store.getState().chat.length;
    chatEdgeTab.classList.remove('pulsing');
    chatTabCount.textContent = '';
    drawerChatList.scrollTop = drawerChatList.scrollHeight;
  }

  function closeDrawer() {
    chatDrawer.classList.remove('open');
    lastSeenMessageCount = store.getState().chat.length;
  }

  chatEdgeTab.onclick = (e) => {
    e.stopPropagation();
    if (chatDrawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  btnCloseDrawer.onclick = (e) => {
    e.stopPropagation();
    closeDrawer();
  };

  function sendBroadcasterMessage() {
    const text = inputDrawerMsg.value.trim();
    if (!text) return;
    store.postChatMessage('Broadcaster', text);
    inputDrawerMsg.value = '';
    drawerChatList.scrollTop = drawerChatList.scrollHeight;
  }

  btnSendDrawerMsg.onclick = sendBroadcasterMessage;
  inputDrawerMsg.onkeydown = (e) => {
    if (e.key === 'Enter') sendBroadcasterMessage();
  };

  // Web Speech API Voice-to-Text
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isListeningVoice = true;
      btnVoiceMic.classList.add('listening');
      dictationStatus.style.display = 'block';
      dictationStatus.textContent = '🎙️ Listening... speak into microphone';
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = (finalTranscript || interimTranscript).trim();
      if (text) {
        inputDrawerMsg.value = text;
        dictationStatus.style.display = 'block';
        dictationStatus.textContent = `🗣️ "${text}"`;
      }
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error event:', event.error);
      isListeningVoice = false;
      btnVoiceMic.classList.remove('listening');
      dictationStatus.style.display = 'block';

      if (event.error === 'network') {
        dictationStatus.textContent = '⚠️ Voice server unreachable. (Apple restricts speech recognition on local debug IP / self-signed SSL. Please type directly)';
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        dictationStatus.textContent = '⚠️ Mic access denied or Siri/Dictation disabled in iOS Settings.';
      } else if (event.error === 'no-speech') {
        dictationStatus.textContent = 'No speech detected. Tap mic to try again or type directly.';
      } else if (event.error === 'audio-capture') {
        dictationStatus.textContent = '⚠️ Microphone capture failed. Ensure mic is enabled in Safari.';
      } else {
        dictationStatus.textContent = `⚠️ Voice status: ${event.error}. You can type directly.`;
      }
    };

    speechRecognition.onend = () => {
      isListeningVoice = false;
      btnVoiceMic.classList.remove('listening');
      if (inputDrawerMsg.value.trim()) {
        dictationStatus.style.display = 'block';
        dictationStatus.textContent = '✓ Speech captured! Tap Send or edit text below.';
      } else {
        setTimeout(() => {
          if (!isListeningVoice && !inputDrawerMsg.value.trim()) {
            dictationStatus.style.display = 'none';
          }
        }, 3500);
      }
    };

    btnVoiceMic.onclick = (e) => {
      e.stopPropagation();
      if (!isListeningVoice) {
        try {
          dictationStatus.style.display = 'block';
          dictationStatus.textContent = '🎙️ Initializing microphone...';
          speechRecognition.start();
        } catch (err) {
          console.warn('Speech recognition start failed:', err);
          isListeningVoice = false;
          btnVoiceMic.classList.remove('listening');
          dictationStatus.style.display = 'block';
          dictationStatus.textContent = '⚠️ Could not start voice recognition. Please type below.';
        }
      } else {
        try {
          speechRecognition.stop();
        } catch (err) {
          try { speechRecognition.abort(); } catch (e2) {}
        }
        isListeningVoice = false;
        btnVoiceMic.classList.remove('listening');
      }
    };
  } else {
    btnVoiceMic.style.display = 'none';
  }

  // --- 7. Cleanup ---
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
