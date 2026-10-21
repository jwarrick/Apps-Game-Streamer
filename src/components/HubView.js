// ==========================================================================
// HubView: Main Family Hub & Unified Match Archive
// ==========================================================================

import { store } from '../services/store.js';
import { ReplayPlayer } from './ReplayPlayer.js';

export function renderHubView(container, navigate) {
  function update() {
    const state = store.getState();
    const active = state.activeMatch;

    container.innerHTML = `
      <div class="hub-container">
        <!-- Header -->
        <header class="hub-header">
          <div class="hub-brand">
            <span style="font-size: 24px;">🏐</span>
            <h1>Game Streamer</h1>
          </div>
          <button class="apple-btn" id="btn-go-live-header">🎥 Go Live</button>
        </header>

        <!-- Live Hero Section (Displayed only when active) -->
        ${active.isLive ? `
          <div class="live-hero-card frosted-glass">
            <div class="live-hero-header">
              <span class="live-badge"><span class="pulse-dot"></span> Live Now</span>
              <span class="tabular-nums" style="font-size: 13px; color: var(--text-secondary);">${active.viewers} watching</span>
            </div>

            <div class="live-matchup-title">vs. ${active.opponent}</div>

            <div class="live-score-strip tabular-nums">
              <span>${active.scoreUs}</span>
              <span style="color: var(--text-tertiary); font-weight: 300;">-</span>
              <span>${active.scoreThem}</span>
              <span class="live-score-sets">(Set ${active.currentSet} • Sets: ${active.setsUs}-${active.setsThem})</span>
            </div>

            <button class="apple-btn apple-btn-primary btn-watch-live" id="btn-watch-live">
              ▶ Tap to Watch Live Game
            </button>
          </div>
        ` : `
          <div class="frosted-glass" style="border-radius: 16px; padding: 18px 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">
            ⚪ No live game streaming right now. Explore past match highlights below.
          </div>
        `}

        <!-- Unified Match Archive -->
        <section class="archive-section">
          <div class="archive-header">
            <h2>Match Archive & Highlights</h2>
          </div>

          <div class="match-list" id="match-archive-list">
            ${state.matches.map(m => `
              <div class="match-card frosted-glass">
                <div class="match-card-header" data-id="${m.id}">
                  <div class="match-info-main">
                    <div class="match-title">
                      ${m.date} vs. ${m.opponent}
                    </div>
                    <div class="match-meta tabular-nums">
                      ${m.highlights.length} Highlight${m.highlights.length === 1 ? '' : 's'} • Sets: ${m.setsUs}-${m.setsThem}
                    </div>
                  </div>
                  <div>
                    ${m.isLive ? `
                      <span class="match-result-badge live">🔴 In Progress</span>
                    ` : (m.setsUs > m.setsThem ? `
                      <span class="match-result-badge win">Won ${m.setsUs}-${m.setsThem}</span>
                    ` : `
                      <span class="match-result-badge">${m.setsUs}-${m.setsThem}</span>
                    `)}
                  </div>
                </div>

                <!-- Chronological Flat List of Highlights -->
                <div class="highlight-sublist" id="sublist-${m.id}">
                  ${m.highlights.length === 0 ? `
                    <div style="font-size: 13px; color: var(--text-tertiary); padding: 8px;">No highlights clipped yet.</div>
                  ` : m.highlights.map(h => `
                    <div class="highlight-row">
                      <div class="highlight-left">
                        <span class="highlight-badge tabular-nums">Set ${h.set} (${h.score})</span>
                        <span class="highlight-label">${h.label || 'Highlight'}</span>
                      </div>
                      <div>
                        ${h.isUploading ? `
                          <span class="highlight-uploading">⏳ Uploading...</span>
                        ` : `
                          <button class="apple-btn btn-play-clip" data-clip-id="${h.id}" data-match-id="${m.id}">▶</button>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    // Setup action listeners
    const btnWatchLive = container.querySelector('#btn-watch-live');
    if (btnWatchLive) {
      btnWatchLive.onclick = () => navigate('/watch');
    }

    const btnGoLive = container.querySelector('#btn-go-live-header');
    if (btnGoLive) {
      btnGoLive.onclick = () => showGoLiveModal(navigate);
    }

    // Clip play buttons
    container.querySelectorAll('.btn-play-clip').forEach(btn => {
      btn.onclick = () => {
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
          const clip = match.highlights.find(c => c.id === clipId);
          if (clip) {
            new ReplayPlayer(clip);
          }
        }
      };
    });
  }

  update();
  return store.subscribe(update);
}

// 4-Digit PIN protection & Opponent naming modal for the broadcaster
function showGoLiveModal(navigate) {
  const modal = document.createElement('div');
  modal.className = 'simple-modal-backdrop';
  modal.innerHTML = `
    <div class="simple-modal">
      <h3>Start Live Broadcast</h3>
      <p style="font-size: 13px; color: var(--text-secondary);">Enter the opponent school/club name to begin streaming.</p>
      
      <input type="text" class="simple-input" id="input-opponent" placeholder="Opponent Name (e.g. Lincoln High)" value="Lincoln High" />
      <input type="password" class="simple-input" id="input-pin" placeholder="Broadcaster PIN (Default: 1234)" value="1234" maxlength="4" />

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;">
        <button class="apple-btn" id="btn-cancel-modal">Cancel</button>
        <button class="apple-btn apple-btn-primary" id="btn-confirm-go-live">Start Stream 🎥</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btnCancel = modal.querySelector('#btn-cancel-modal');
  const btnConfirm = modal.querySelector('#btn-confirm-go-live');
  const inputOpponent = modal.querySelector('#input-opponent');
  const inputPin = modal.querySelector('#input-pin');

  btnCancel.onclick = () => modal.remove();

  btnConfirm.onclick = () => {
    if (inputPin.value !== '1234') {
      alert('Incorrect PIN. Default is 1234.');
      return;
    }
    const opponent = inputOpponent.value.trim() || 'Opponent';
    store.startBroadcast(opponent);
    modal.remove();
    navigate('/stream');
  };
}
