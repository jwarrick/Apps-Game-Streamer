// ==========================================================================
// WatcherView: Family Live Video Player with Overlay Comments Drawer
// Identical in structure, styling, pulsing tab, and voice mic to Broadcaster
// ==========================================================================

import { store, getTennisPointDisplay } from '../services/store.js';
import { getBroadcastIcon, getTennisNetIcon } from './icons.js';
import { webrtcService } from '../services/webrtc.js';

export function renderWatcherView(container, navigate) {
  let isListeningVoice = false;
  let speechRecognition = null;
  let lastSeenMessageCount = store.getState().chat.length;

  container.innerHTML = `
    <div class="watcher-container">
      <!-- Fullscreen Live Video Area -->
      <div class="watcher-main" id="watcher-main">
        <div class="watcher-video-wrapper">
          <video class="watcher-video" id="live-player" autoplay playsinline muted></video>

          <!-- Live WebRTC Stream Connection Indicator & End State Screen -->
          <div class="watcher-stream-status frosted-glass" id="stream-status-badge" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(0,0,0,0.8); z-index: 2; padding: 24px; text-align: center;">
            <div id="stream-status-icon" style="font-size: 38px; display: none;">🏆</div>
            <div id="stream-status-spinner" class="stream-status-spinner" style="width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--accent-gold); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px; max-width: 340px;">
              <span id="stream-status-text" style="font-size: 16px; font-weight: 600; color: #fff;">Connecting to live court camera...</span>
              <span id="stream-status-subtext" style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;"></span>
            </div>
            <button class="apple-btn apple-btn-primary" id="btn-stream-ended-hub" style="display: none; padding: 10px 22px; font-size: 14px; font-weight: 600; margin-top: 6px;">
              Return to Hub
            </button>
          </div>

          <!-- Top-Left Live Score Overlay Container (Dual-Sport: Volleyball vs Tennis) -->
          <div id="watcher-score-container"></div>

          <!-- Top-Right Actions -->
          <div class="watcher-top-actions">
            <button class="btn-exit-circle" id="btn-back-hub" title="Exit to Home" aria-label="Exit">
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Family Comments Edge Tab (Pulsing when unread, identical to broadcaster) -->
      <div class="streamer-chat-tab" id="chat-edge-tab" title="View Comments">
        <span>💬</span>
        <span id="chat-tab-count"></span>
      </div>

      <!-- Slide-Out Semi-Transparent Comments Drawer (Overlays directly on video) -->
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

        <!-- Dictation Status Indicator -->
        <div class="dictation-status" id="dictation-status" style="display: none; padding: 6px 14px; font-size: 13px; color: var(--accent-gold); background: rgba(0,0,0,0.35); text-align: center;"></div>

        <!-- Viewer Name Setting Tool (The only difference from Broadcaster) -->
        <div class="watcher-name-bar">
          <span>Posting as: <b id="lbl-viewer-name" style="color: var(--accent-gold); font-size: 14px;">Family Member</b></span>
          <button class="apple-btn" id="btn-edit-viewer-name" style="padding: 4px 10px; font-size: 12px;">Change</button>
        </div>

        <!-- Drawer Input Row with Voice Dictation Microphone -->
        <div class="streamer-drawer-input-row">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Dictation">
            🎙️
          </button>
          <input type="text" class="simple-input" id="input-drawer-msg" placeholder="Cheer or speak a comment..." style="padding: 10px 14px; font-size: 15px;" />
          <button class="apple-btn apple-btn-primary" id="btn-send-drawer-msg" style="padding: 10px 16px; font-size: 14px; font-weight: 600;">Send</button>
        </div>
      </div>
    </div>
  `;

  // Elements
  const btnBackHub = container.querySelector('#btn-back-hub');
  const watcherScoreContainer = container.querySelector('#watcher-score-container');

  const chatEdgeTab = container.querySelector('#chat-edge-tab');
  const chatTabCount = container.querySelector('#chat-tab-count');
  const chatDrawer = container.querySelector('#streamer-chat-drawer');
  const btnCloseDrawer = container.querySelector('#btn-close-drawer');
  const drawerChatList = container.querySelector('#drawer-chat-list');
  const dictationStatus = container.querySelector('#dictation-status');
  const lblViewerName = container.querySelector('#lbl-viewer-name');
  const btnEditViewerName = container.querySelector('#btn-edit-viewer-name');
  const inputDrawerMsg = container.querySelector('#input-drawer-msg');
  const btnSendDrawerMsg = container.querySelector('#btn-send-drawer-msg');
  const btnVoiceMic = container.querySelector('#btn-voice-mic');

  function renderTennisPastSetScores(team, s) {
    if (!s.setScores || s.setScores.length === 0) return '';
    return s.setScores.map(set => {
      let val = '?';
      if (set.us !== undefined && team === 'us') val = set.us;
      else if (set.them !== undefined && team === 'them') val = set.them;
      else if (set.score) {
        const parts = set.score.split('-');
        val = team === 'us' ? (parts[0] || '?') : (parts[1] || '?');
      }
      return `<div class="tennis-set-cell">${val}</div>`;
    }).join('');
  }

  // Viewer Name Storage
  function getViewerName() {
    return localStorage.getItem('gamestreamer_viewer_name') || 'Family Fan';
  }

  function setViewerName(name) {
    if (name && name.trim()) {
      localStorage.setItem('gamestreamer_viewer_name', name.trim());
      lblViewerName.textContent = name.trim();
    }
  }

  function ensureViewerName() {
    return getViewerName();
  }

  function showNamePromptModal() {
    const existing = document.getElementById('name-prompt-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'name-prompt-modal';
    backdrop.className = 'highlight-pill-backdrop';
    backdrop.style.display = 'flex';
    backdrop.style.zIndex = '9999';

    const currentName = getViewerName();
    backdrop.innerHTML = `
      <div class="highlight-pill-dialog frosted-glass" style="max-width: 340px; padding: 22px;">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Your Chat Name</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Choose the name that appears when you post comments (e.g. Grandma, Uncle Dave, Mom):
        </p>
        <input type="text" id="input-custom-viewer-name" class="simple-input" value="${currentName}" style="padding: 10px 14px; font-size: 14px; margin-bottom: 16px;" />
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button class="apple-btn" id="btn-cancel-name" style="padding: 6px 14px;">Cancel</button>
          <button class="apple-btn apple-btn-primary" id="btn-save-name" style="padding: 6px 16px;">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#input-custom-viewer-name');
    input.focus();
    input.select();

    const close = () => backdrop.remove();
    backdrop.querySelector('#btn-cancel-name').onclick = close;
    backdrop.querySelector('#btn-save-name').onclick = () => {
      const val = input.value.trim();
      if (val) setViewerName(val);
      close();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (val) setViewerName(val);
        close();
      }
    };
  }

  lblViewerName.textContent = getViewerName();
  btnEditViewerName.onclick = (e) => {
    e.stopPropagation();
    showNamePromptModal();
  };

  const livePlayer = container.querySelector('#live-player');
  const streamStatusBadge = container.querySelector('#stream-status-badge');
  const streamStatusIcon = container.querySelector('#stream-status-icon');
  const streamStatusSpinner = container.querySelector('#stream-status-spinner');
  const streamStatusText = container.querySelector('#stream-status-text');
  const streamStatusSubtext = container.querySelector('#stream-status-subtext');
  const btnStreamEndedHub = container.querySelector('#btn-stream-ended-hub');

  if (btnStreamEndedHub) {
    btnStreamEndedHub.onclick = () => {
      webrtcService.leaveStream();
      navigate('/');
    };
  }

  function setOverlayConnecting() {
    if (!streamStatusBadge) return;
    streamStatusBadge.style.display = 'flex';
    if (streamStatusSpinner) streamStatusSpinner.style.display = 'block';
    if (streamStatusIcon) streamStatusIcon.style.display = 'none';
    if (streamStatusText) streamStatusText.textContent = 'Connecting to court camera...';
    if (streamStatusSubtext) streamStatusSubtext.textContent = 'Waiting for live video feed from the court.';
    if (btnStreamEndedHub) btnStreamEndedHub.style.display = 'none';
  }

  function setOverlayConnected() {
    if (streamStatusBadge) streamStatusBadge.style.display = 'none';
  }

  function setOverlayReconnecting() {
    if (!streamStatusBadge) return;
    streamStatusBadge.style.display = 'flex';
    if (streamStatusSpinner) streamStatusSpinner.style.display = 'block';
    if (streamStatusIcon) streamStatusIcon.style.display = 'none';
    if (streamStatusText) streamStatusText.textContent = 'Signal Dip — Reconnecting to Court...';
    if (streamStatusSubtext) {
      streamStatusSubtext.textContent = 'Temporary cellular signal fluctuation. Re-establishing connection...';
    }
  }

  function setOverlayOfflineOrEnded(isFinished, winnerName, opponentName, isPaused = false) {
    if (!streamStatusBadge) return;
    streamStatusBadge.style.display = 'flex';
    if (streamStatusSpinner) streamStatusSpinner.style.display = 'none';
    if (streamStatusIcon) {
      streamStatusIcon.style.display = 'block';
      streamStatusIcon.textContent = isFinished ? '🏆' : (isPaused ? '⏸️' : '📹');
    }
    if (streamStatusText) {
      streamStatusText.textContent = isFinished 
        ? 'Match Broadcast Concluded' 
        : (isPaused ? 'Match Paused (Set Break / Timeout)' : 'Court Broadcast Offline');
    }
    if (streamStatusSubtext) {
      if (isFinished) {
        const opp = (opponentName || 'Opponent').toUpperCase();
        const win = winnerName === 'us' ? 'US' : (winnerName === 'them' ? opp : (winnerName || 'US'));
        streamStatusSubtext.textContent = `Final: ${win} won the match! Full comment transcript and highlights are saved in the archive.`;
      } else if (isPaused) {
        streamStatusSubtext.textContent = 'The court broadcaster has paused between sets or during a timeout. The feed will resume shortly.';
      } else {
        streamStatusSubtext.textContent = 'The court camera is currently offline. Highlights and prior sets are available in the archive.';
      }
    }
    if (btnStreamEndedHub) {
      btnStreamEndedHub.style.display = 'inline-flex';
    }
  }

  btnBackHub.onclick = () => {
    webrtcService.leaveStream();
    navigate('/');
  };

  // Reactive WebRTC connection manager
  let joinedMatchId = null;

  function ensureWebRTCConnection(m) {
    if (m && m.id && m.isLive) {
      if (joinedMatchId === m.id) return;
      joinedMatchId = m.id;
      setOverlayConnecting();
      webrtcService.joinStream(
        m.id,
        (remoteStream) => {
          console.log('[Watcher] Attaching remote stream to video element');
          livePlayer.srcObject = remoteStream;
          livePlayer.play().catch(e => {
            console.log('[Watcher] Autoplay muted fallback:', e);
            livePlayer.muted = true;
            livePlayer.play().catch(() => {});
          });
          setOverlayConnected();
        },
        (status) => {
          if (status === 'connected') {
            setOverlayConnected();
          } else if (status === 'connecting') {
            setOverlayConnecting();
          } else if (status === 'reconnecting') {
            setOverlayReconnecting();
          } else if (status === 'disconnected' || status === 'failed') {
            const currentMatch = store.getState().activeMatch;
            const isFin = !!(currentMatch && (currentMatch.isFinished || !currentMatch.isLive));
            const isPaused = !!(currentMatch && currentMatch.isPaused);
            setOverlayOfflineOrEnded(isFin, currentMatch?.winner, currentMatch?.opponent, isPaused);
          }
        }
      );
    } else {
      if (joinedMatchId) {
        webrtcService.leaveStream();
        joinedMatchId = null;
      }
      const isFin = !!(m && m.isFinished);
      const isPaused = !!(m && m.isPaused);
      setOverlayOfflineOrEnded(isFin, m?.winner, m?.opponent, isPaused);
    }
  }

  // --- Drawer Open / Close Logic ---
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

  // --- Send Message ---
  function sendMessage() {
    const text = inputDrawerMsg.value.trim();
    if (!text) return;

    const sender = ensureViewerName();
    store.postChatMessage(sender, text);
    inputDrawerMsg.value = '';
    drawerChatList.scrollTop = drawerChatList.scrollHeight;
  }

  btnSendDrawerMsg.onclick = sendMessage;
  inputDrawerMsg.onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  // --- Web Speech API Voice-to-Text (Identical to Broadcaster) ---
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
        ensureViewerName();
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

  // --- Real-time Updates from Store ---
  function update() {
    const s = store.getState().activeMatch || {};
    ensureWebRTCConnection(s);

    if (watcherScoreContainer) {
      if (!s.isLive) {
        watcherScoreContainer.innerHTML = '';
      } else if (s.sport === 'tennis') {
        const ptDisplay = getTennisPointDisplay(s.pointsUs, s.pointsThem, s.isTiebreak, s.tennisScoringType);
        const pointsUsDisplay = ptDisplay.us;
        const pointsThemDisplay = ptDisplay.them;

        let formatLabel = `Set ${s.currentSet}`;
        if (s.currentSetFormat === 'pro8') formatLabel = '8-Game Pro Set';
        else if (s.currentSetFormat === 'match_tiebreak_10') formatLabel = '10-Pt Match TB';
        else if (s.currentSetFormat === 'tiebreak_7') formatLabel = '7-Pt TB';

        watcherScoreContainer.innerHTML = `
          <div class="watcher-score-overlay frosted-glass" style="padding: 8px 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span class="live-badge" style="font-size: 11px; font-weight: 700; padding: 2px 7px; display: inline-flex; align-items: center; gap: 5px;">
                ${getBroadcastIcon(11, 'var(--accent-red)')}
                <span>LIVE</span>
              </span>
              <span class="sport-badge-card tennis" style="font-size: 10px; padding: 1px 6px;">🎾 Tennis</span>
              <span style="font-size: 12px; color: var(--text-secondary); margin-left: auto;">
                ${formatLabel} ${s.isTiebreak ? '• Tiebreak' : ''}
              </span>
            </div>

            <div class="tennis-tv-scoreboard" style="box-shadow: none; background: transparent; padding: 0; border: none; cursor: default;">
              <div class="tennis-row">
                <div class="tennis-row-team">
                  <span class="tennis-server-indicator ${s.server === 'us' ? 'active' : ''}">🎾</span>
                  <span class="tennis-team-name" title="${s.teamName || 'US'}">${s.teamName || 'US'}</span>
                </div>
                <div class="tennis-sets-wrap">
                  ${renderTennisPastSetScores('us', s)}
                  ${s.currentSetFormat !== 'tiebreak-10' && s.currentSetFormat !== 'tiebreak-7' ? `<div class="tennis-set-cell current">${s.gamesUs || 0}</div>` : ''}
                </div>
                <div class="tennis-point-cell tabular-nums">${pointsUsDisplay}</div>
              </div>
              <div class="tennis-row">
                <div class="tennis-row-team">
                  <span class="tennis-server-indicator ${s.server === 'them' ? 'active' : ''}">🎾</span>
                  <span class="tennis-team-name" title="${s.opponent || 'OPPONENT'}">${s.opponent || 'OPPONENT'}</span>
                </div>
                <div class="tennis-sets-wrap">
                  ${renderTennisPastSetScores('them', s)}
                  ${s.currentSetFormat !== 'tiebreak-10' && s.currentSetFormat !== 'tiebreak-7' ? `<div class="tennis-set-cell current">${s.gamesThem || 0}</div>` : ''}
                </div>
                <div class="tennis-point-cell tabular-nums">${pointsThemDisplay}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        watcherScoreContainer.innerHTML = `
          <div class="watcher-score-overlay frosted-glass">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="live-badge" style="font-size: 13px; font-weight: 700; padding: 3px 9px; display: inline-flex; align-items: center; gap: 6px;">
                  ${getBroadcastIcon(13, 'var(--accent-red)')}
                  <span>LIVE</span>
                </span>
                <span class="sport-badge-card volleyball" style="font-size: 10px; padding: 1px 6px;">🏐 Volleyball</span>
                <span style="font-size: 17px; font-weight: 700; color: #ffffff; letter-spacing: 0.2px;">vs. ${s.opponent}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 14px; margin-top: 2px;">
                <span class="tabular-nums" style="font-size: 30px; font-weight: 900; line-height: 1; letter-spacing: 0.5px;">${s.scoreUs} - ${s.scoreThem}</span>
                <span style="font-size: 16px; font-weight: 600; color: #f1f5f9; background: rgba(255, 255, 255, 0.12); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15);">
                  Set ${s.currentSet} • Sets: ${s.setsUs}-${s.setsThem}
                </span>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Helper to format special pill icons (e.g. isometric tennis net, shovel for dig)
    function formatCommentText(text) {
      if (!text) return '';
      if (text.includes('Net Point')) {
        text = text.replace(/(?:🎾|🥅)?\s*Net Point/, `${getTennisNetIcon(18, 'chat-tennis-net-img')} Net Point`);
      }
      if (text.includes('Amazing Dig')) {
        text = text.replace(/(?:⛏️|🪏)?\s*Amazing Dig/, '🪏 Amazing Dig');
      }
      return text;
    }

    const chatList = store.getState().chat || [];
    const isDrawerOpen = chatDrawer ? chatDrawer.classList.contains('open') : false;

    drawerChatList.innerHTML = chatList.map(msg => `
      <div class="chat-bubble">
        <div class="sender">${msg.sender} ${msg.score ? `(Set ${msg.set} • ${msg.score})` : ''}</div>
        <div style="font-weight: ${msg.isCheer ? '700' : '400'}; color: ${msg.isCheer ? 'var(--accent-gold)' : 'inherit'};">
          ${formatCommentText(msg.text)}
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

  const initialActiveMatch = store.getState().activeMatch;
  if (initialActiveMatch && initialActiveMatch.id) {
    store.initChatSync(initialActiveMatch.id);
  }

  update();
  const unsubscribe = store.subscribe(update);

  return () => {
    webrtcService.leaveStream();
    joinedMatchId = null;
    if (speechRecognition) {
      try { speechRecognition.abort(); } catch (e) {}
    }
    unsubscribe();
  };
}
