// ==========================================================================
// HubView: Main Family Hub & Unified Match Archive
// ==========================================================================

import { store } from '../services/store.js';
import { ReplayPlayer } from './ReplayPlayer.js';
import { authService } from '../services/auth.js';
import { downloadHighlightVideo } from '../services/download.js';

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
          <div style="display: flex; gap: 8px;">
            <button class="apple-btn" id="btn-watch-header" title="Open Viewer Experience">👀 Watch</button>
            <button class="apple-btn apple-btn-primary" id="btn-go-live-header">🎥 Go Live</button>
          </div>
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
          <div class="live-hero-card frosted-glass" style="border-style: dashed; border-color: rgba(255, 255, 255, 0.16);">
            <div class="live-hero-header">
              <span class="live-badge" style="background: rgba(255, 255, 255, 0.08); color: var(--text-secondary);">⚪ No Live Game Streaming</span>
            </div>

            <div class="live-matchup-title" style="font-size: 16px; margin: 4px 0 6px 0;">
              Preview Family Viewer Experience
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 14px 0;">
              Test the full-screen live stream video player, overlay comments drawer, voice-to-text dictation, and viewer name tools.
            </p>

            <button class="apple-btn apple-btn-primary btn-watch-live" id="btn-watch-demo">
              👀 Open Viewer Experience (Demo Live Stream)
            </button>
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
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${h.isUploading ? `
                          <span class="highlight-uploading">⏳ Uploading...</span>
                        ` : `
                          <button class="apple-btn btn-play-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="Watch Highlight Replay">▶</button>
                          <button class="btn-download-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="Save to Photos / Download" aria-label="Download Highlight">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </button>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Match Comments Transcript Section -->
                <div style="padding: 6px 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end;">
                  <button class="apple-btn btn-toggle-transcript" data-match-id="${m.id}" data-count="${(m.comments || []).length}" style="padding: 4px 10px; font-size: 11px;">
                    💬 Comments (${(m.comments || []).length})
                  </button>
                </div>

                <div class="match-transcript-list" id="transcript-${m.id}" style="display: none; padding: 10px 16px; background: rgba(0, 0, 0, 0.4); border-top: 1px solid var(--border-subtle); font-size: 13px;">
                  ${(m.comments && m.comments.length > 0) ? m.comments.map(c => `
                    <div style="margin-bottom: 6px;">
                      <span style="color: var(--text-tertiary); font-size: 11px;">${c.sender}:</span>
                      <span style="color: ${c.isCheer ? 'var(--accent-gold)' : 'inherit'}; font-weight: ${c.isCheer ? '600' : '400'};"> ${c.text}</span>
                    </div>
                  `).join('') : '<div style="color: var(--text-tertiary); font-size: 12px;">No comments recorded for this match.</div>'}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    // Setup action listeners
    const openWatcher = () => {
      if (!store.getState().activeMatch.isLive) {
        store.startDemoStream();
      }
      navigate('/watch');
    };

    const btnWatchLive = container.querySelector('#btn-watch-live');
    if (btnWatchLive) btnWatchLive.onclick = openWatcher;

    const btnWatchDemo = container.querySelector('#btn-watch-demo');
    if (btnWatchDemo) btnWatchDemo.onclick = openWatcher;

    const btnWatchHeader = container.querySelector('#btn-watch-header');
    if (btnWatchHeader) btnWatchHeader.onclick = openWatcher;

    const btnGoLive = container.querySelector('#btn-go-live-header');
    if (btnGoLive) {
      btnGoLive.onclick = async () => {
        // Automatically triggers Google Sign-in / credential recognition directly
        const user = await authService.signInWithGoogle();
        showMatchSetupModal(navigate, user);
      };
    }

    // Toggle transcript buttons
    container.querySelectorAll('.btn-toggle-transcript').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.matchId;
        const box = container.querySelector(`#transcript-${id}`);
        if (box) {
          const isHidden = box.style.display === 'none';
          box.style.display = isHidden ? 'block' : 'none';
          btn.textContent = isHidden ? '✕ Hide Comments' : `💬 Comments (${btn.dataset.count || 0})`;
        }
      };
    });

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

    // Clip download buttons (Save to Camera Roll / Photos on iOS, Downloads folder on PC)
    container.querySelectorAll('.btn-download-clip').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
          const clip = match.highlights.find(c => c.id === clipId);
          if (clip) {
            downloadHighlightVideo(clip, btn);
          }
        }
      };
    });
  }

  update();
  return store.subscribe(update);
}

// Minimalist Opponent Setup Modal once Google Credential is verified
function showMatchSetupModal(navigate, user) {
  const modal = document.createElement('div');
  modal.className = 'simple-modal-backdrop';
  modal.innerHTML = `
    <div class="simple-modal">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h3>Start Match Broadcast</h3>
        <span style="font-size: 12px; color: var(--accent-green);">● Verified</span>
      </div>
      <p style="font-size: 13px; color: var(--text-secondary);">Logged in as <b>${user.name}</b>. Enter opponent to begin streaming:</p>
      
      <input type="text" class="simple-input" id="input-opponent" placeholder="Opponent (e.g. Lincoln High)" value="Lincoln High" />

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

  btnCancel.onclick = () => modal.remove();

  const start = () => {
    const opponent = inputOpponent.value.trim() || 'Opponent';
    store.startBroadcast(opponent);
    modal.remove();
    navigate('/stream');
  };

  btnConfirm.onclick = start;
  inputOpponent.onkeydown = (e) => {
    if (e.key === 'Enter') start();
  };
  inputOpponent.focus();
}
