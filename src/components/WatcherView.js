// ==========================================================================
// WatcherView: Family Live Video Player with Overlay Comments Drawer
// Identical in structure, styling, pulsing tab, and voice mic to Broadcaster
// ==========================================================================

import { store } from '../services/store.js';

export function renderWatcherView(container, navigate) {
  let isListeningVoice = false;
  let speechRecognition = null;
  let lastSeenMessageCount = store.getState().chat.length;

  container.innerHTML = `
    <div class="watcher-container">
      <!-- Fullscreen Live Video Area -->
      <div class="watcher-main" id="watcher-main">
        <div class="watcher-video-wrapper">
          <video class="watcher-video" id="live-player" autoplay playsinline muted loop>
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
          </video>

          <!-- Top-Left Live Score Overlay -->
          <div class="watcher-score-overlay frosted-glass">
            <span class="live-badge"><span class="pulse-dot"></span> LIVE</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;" id="w-opponent">vs. Opponent</span>
              <span class="tabular-nums" style="font-size: 20px; font-weight: 800;" id="w-score-line">0 - 0</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);" id="w-set-info">
              Set 1 • Sets: 0-0
            </div>
          </div>

          <!-- Top-Right Actions -->
          <div class="watcher-top-actions">
            <button class="apple-btn frosted-glass" id="btn-simulate-cheer" style="font-size: 12px; padding: 6px 12px;" title="Simulate a new comment to test the pulsing drawer tab">
              🔔 Test Incoming Cheer
            </button>
            <button class="apple-btn frosted-glass" id="btn-back-hub" style="font-size: 12px; padding: 6px 12px;">
              ✕ Exit
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
          <button class="apple-btn" id="btn-close-drawer" style="padding: 4px 10px; font-size: 12px;">✕</button>
        </div>

        <div class="streamer-drawer-messages" id="drawer-chat-list">
          <!-- Comments stream here -->
        </div>

        <!-- Dictation Status Indicator -->
        <div class="dictation-status" id="dictation-status" style="display: none; padding: 4px 12px; font-size: 11px; color: var(--accent-gold); background: rgba(0,0,0,0.3); text-align: center;"></div>

        <!-- Viewer Name Setting Tool (The only difference from Broadcaster) -->
        <div class="watcher-name-bar" style="padding: 8px 14px; font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); background: rgba(255, 255, 255, 0.03);">
          <span>Posting as: <b id="lbl-viewer-name" style="color: var(--accent-gold);">Family Member</b></span>
          <button class="apple-btn" id="btn-edit-viewer-name" style="padding: 3px 8px; font-size: 11px;">Change</button>
        </div>

        <!-- Drawer Input Row with Voice Dictation Microphone -->
        <div class="streamer-drawer-input-row">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Dictation">
            🎙️
          </button>
          <input type="text" class="simple-input" id="input-drawer-msg" placeholder="Cheer or speak a comment..." style="padding: 8px 12px; font-size: 13px;" />
          <button class="apple-btn apple-btn-primary" id="btn-send-drawer-msg" style="padding: 8px 12px; font-size: 13px;">Send</button>
        </div>
      </div>
    </div>
  `;

  // Elements
  const btnBackHub = container.querySelector('#btn-back-hub');
  const wOpponent = container.querySelector('#w-opponent');
  const wScoreLine = container.querySelector('#w-score-line');
  const wSetInfo = container.querySelector('#w-set-info');

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

  // Viewer Name Storage
  function getViewerName() {
    return localStorage.getItem('gamestreamer_viewer_name') || '';
  }

  function setViewerName(name) {
    if (name && name.trim()) {
      localStorage.setItem('gamestreamer_viewer_name', name.trim());
      lblViewerName.textContent = name.trim();
    }
  }

  function ensureViewerName() {
    let name = getViewerName();
    if (!name) {
      const chosen = prompt('What is your name for the chat? (e.g. Grandma, Uncle Dave, Mom)', 'Grandma');
      if (chosen && chosen.trim()) {
        setViewerName(chosen.trim());
        name = chosen.trim();
      } else {
        name = 'Family Member';
        setViewerName(name);
      }
    }
    return name;
  }

  const initialName = getViewerName();
  if (initialName) {
    lblViewerName.textContent = initialName;
  }

  btnEditViewerName.onclick = (e) => {
    e.stopPropagation();
    const current = getViewerName() || 'Grandma';
    const chosen = prompt('What is your name for the chat? (e.g. Grandma, Uncle Dave, Mom)', current);
    if (chosen !== null && chosen.trim()) {
      setViewerName(chosen.trim());
    }
  };

  const btnSimulateCheer = container.querySelector('#btn-simulate-cheer');
  btnBackHub.onclick = () => navigate('/');

  const sampleCheers = [
    { sender: 'Uncle Dave', text: 'What an awesome spike! 🔥' },
    { sender: 'Grandma', text: 'Cheering from home! Let\'s go Wildcats! 🏐' },
    { sender: 'Aunt Sarah', text: 'Incredible dig! Keep it up! 💪' },
    { sender: 'Cousin Mike', text: 'Ace! That serve was untouchable! 🎯' }
  ];
  let cheerIndex = 0;
  if (btnSimulateCheer) {
    btnSimulateCheer.onclick = (e) => {
      e.stopPropagation();
      const cheer = sampleCheers[cheerIndex % sampleCheers.length];
      cheerIndex++;
      store.postChatMessage(cheer.sender, cheer.text);
    };
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
    const s = store.getState().activeMatch;
    wOpponent.textContent = `vs. ${s.opponent}`;
    wScoreLine.textContent = `${s.scoreUs} - ${s.scoreThem}`;
    wSetInfo.textContent = `Set ${s.currentSet} • Sets: ${s.setsUs}-${s.setsThem}`;

    // Render Drawer Comments and Edge Tab
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

  update();
  const unsubscribe = store.subscribe(update);

  return () => {
    if (speechRecognition) {
      try { speechRecognition.abort(); } catch (e) {}
    }
    unsubscribe();
  };
}
