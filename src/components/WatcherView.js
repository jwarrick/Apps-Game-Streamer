// ==========================================================================
// WatcherView: Family Live Video Player with Auto-Resizing Chat Sidebar
// ==========================================================================

import { store } from '../services/store.js';
import { ReplayPlayer } from './ReplayPlayer.js';

export function renderWatcherView(container, navigate) {
  let isChatOpen = true;

  container.innerHTML = `
    <div class="watcher-container">
      <!-- Main Video Area (Automatically resizes when sidebar opens) -->
      <div class="watcher-main" id="watcher-main">
        <div class="watcher-video-wrapper">
          <video class="watcher-video" id="live-player" autoplay playsinline muted loop>
            <!-- Sample high quality volleyball loop for demo testing -->
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
          </video>

          <!-- Top-Left Live Score Overlay -->
          <div class="watcher-score-overlay frosted-glass">
            <span class="live-badge"><span class="pulse-dot"></span> LIVE</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;" id="w-opponent">vs. Lincoln High</span>
              <span class="tabular-nums" style="font-size: 20px; font-weight: 800;" id="w-score-line">18 - 16</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);" id="w-set-info">
              Set 2 • Sets: 1-0
            </div>
          </div>

          <!-- Top-Right Actions -->
          <div class="watcher-top-actions">
            <button class="apple-btn frosted-glass" id="btn-toggle-chat">
              💬 Chat
            </button>
            <button class="apple-btn frosted-glass" id="btn-back-hub">
              ✕ Exit
            </button>
          </div>
        </div>
      </div>

      <!-- Resizing Chat Sidebar (Shrinks video rather than overlaying) -->
      <aside class="watcher-sidebar" id="watcher-sidebar">
        <div class="chat-header">
          <h3>Family Cheering</h3>
          <button class="apple-btn" id="btn-close-sidebar" style="padding: 4px 10px; font-size: 12px;">✕</button>
        </div>

        <div class="chat-message-list" id="chat-messages">
          <!-- Chat bubbles populated dynamically -->
        </div>

        <div class="chat-input-row">
          <input type="text" class="chat-input" id="input-chat-msg" placeholder="Cheer for the team..." />
          <button class="apple-btn apple-btn-primary" id="btn-send-chat" style="padding: 8px 14px;">Send</button>
        </div>
      </aside>
    </div>
  `;

  // Elements
  const sidebar = container.querySelector('#watcher-sidebar');
  const btnToggleChat = container.querySelector('#btn-toggle-chat');
  const btnCloseSidebar = container.querySelector('#btn-close-sidebar');
  const btnBackHub = container.querySelector('#btn-back-hub');
  const chatMessages = container.querySelector('#chat-messages');
  const inputChatMsg = container.querySelector('#input-chat-msg');
  const btnSendChat = container.querySelector('#btn-send-chat');

  const wOpponent = container.querySelector('#w-opponent');
  const wScoreLine = container.querySelector('#w-score-line');
  const wSetInfo = container.querySelector('#w-set-info');

  function update() {
    const s = store.getState().activeMatch;
    wOpponent.textContent = `vs. ${s.opponent}`;
    wScoreLine.textContent = `${s.scoreUs} - ${s.scoreThem}`;
    wSetInfo.textContent = `Set ${s.currentSet} • Sets: ${s.setsUs}-${s.setsThem}`;

    // Render chat
    const chatList = store.getState().chat;
    chatMessages.innerHTML = chatList.map(msg => `
      <div class="chat-bubble">
        <div class="sender">${msg.sender} ${msg.score ? `(Set ${msg.set} • ${msg.score})` : ''}</div>
        <div style="font-weight: ${msg.isCheer ? '700' : '400'}; color: ${msg.isCheer ? 'var(--accent-gold)' : 'inherit'};">
          ${msg.text}
        </div>
      </div>
    `).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Toggle chat sidebar (smoothly resizes video container)
  function toggleSidebar(open) {
    isChatOpen = open;
    if (isChatOpen) {
      sidebar.classList.remove('collapsed');
      btnToggleChat.style.display = 'none';
    } else {
      sidebar.classList.add('collapsed');
      btnToggleChat.style.display = 'flex';
    }
  }

  btnToggleChat.onclick = () => toggleSidebar(true);
  btnCloseSidebar.onclick = () => toggleSidebar(false);
  btnBackHub.onclick = () => navigate('/');

  // Send message
  function sendMessage() {
    const text = inputChatMsg.value.trim();
    if (!text) return;
    store.postChatMessage('Family Viewer', text);
    inputChatMsg.value = '';
  }

  btnSendChat.onclick = sendMessage;
  inputChatMsg.onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  update();
  const unsubscribe = store.subscribe(update);

  return () => {
    unsubscribe();
  };
}
