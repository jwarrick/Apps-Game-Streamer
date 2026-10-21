// ==========================================================================
// HubView: Main Family Hub & Unified Match Archive
// ==========================================================================

import { store, sortHighlightsChronologically } from '../services/store.js';
import { ReplayPlayer } from './ReplayPlayer.js';
import { HighlightReelPlayer } from './HighlightReelPlayer.js';
import { authService } from '../services/auth.js';
import { shareHighlightVideo } from '../services/share.js';
import { getBroadcastIcon } from './icons.js';

export function renderHubView(container, navigate) {
  function update() {
    const state = store.getState();
    const active = state.activeMatch;
    const stats = store.getServerStorageStats();

    container.innerHTML = `
      <div class="hub-container">
        <!-- Header -->
        <header class="hub-header">
          <div class="hub-brand">
            <span style="font-size: 24px;">🏐</span>
            <h1>Game Streamer</h1>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="apple-btn" id="btn-drive-header" title="Open Google Drive Match Clips Folder">📁 Drive</button>
            <button class="apple-btn" id="btn-watch-header" title="Open Viewer Experience">👀 Watch</button>
            <button class="apple-btn apple-btn-primary" id="btn-go-live-header" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getBroadcastIcon(16, '#ffffff')}
              <span>Go Live</span>
            </button>
          </div>
        </header>

        <!-- Live Hero Section (Displayed only when active) -->
        ${active.isLive ? `
          <div class="live-hero-card frosted-glass">
            <div class="live-hero-header">
              <span class="live-badge" style="display: inline-flex; align-items: center; gap: 6px;">
                ${getBroadcastIcon(14, 'var(--accent-red)')}
                <span>Live Now</span>
              </span>
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

        <!-- Server Cloud Storage Usage Card -->
        <div class="storage-card frosted-glass">
          <div class="storage-card-header">
            <div class="storage-title-wrap">
              <span style="font-size: 16px;">☁️</span>
              <span class="storage-title">App Server Storage</span>
              <span class="storage-plan-badge">5.0 GB Free Tier</span>
            </div>
            <div class="storage-stats-text tabular-nums">
              <strong>${stats.usedMB} MB</strong> / ${stats.maxGB} (${stats.percentUsed}%)
            </div>
          </div>

          <div class="storage-bar-track">
            <div class="storage-bar-fill" style="width: ${Math.max(1.5, Math.min(100, Number(stats.percentUsed)))}%;"></div>
          </div>

          <div class="storage-card-footer">
            <span>${stats.activeMatchesCount} active match${stats.activeMatchesCount === 1 ? '' : 'es'} (${stats.activeClipsCount} fast clips) • ${stats.archivedMatchesCount} archived to Drive</span>
            <span style="color: var(--text-tertiary);">Archive older matches anytime to trim space</span>
          </div>
        </div>

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
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${(m.highlights && m.highlights.length > 0) ? `
                      <button class="apple-btn btn-play-reel" data-match-id="${m.id}" title="Watch continuous YouTube-style highlight reel with live score overlay">
                        <span>▶</span> <span>Reel (${m.highlights.length})</span>
                      </button>
                    ` : ''}

                    ${m.isArchived ? `
                      <span class="match-archive-badge" title="Server copies deleted; playing via Google Drive">📦 Drive Archived</span>
                    ` : (!m.isLive ? `
                      <button class="apple-btn btn-archive-match" data-match-id="${m.id}" data-opponent="${m.opponent}" title="Delete server video files and rely on Google Drive to free up space" style="padding: 3px 8px; font-size: 11px;">
                        📦 Archive to Drive
                      </button>
                    ` : '')}

                    ${m.isLive ? `
                      <span class="match-result-badge live">🔴 In Progress</span>
                    ` : (m.setsUs > m.setsThem ? `
                      <span class="match-result-badge win">Won ${m.setsUs}-${m.setsThem}</span>
                    ` : `
                      <span class="match-result-badge">${m.setsUs}-${m.setsThem}</span>
                    `)}
                  </div>
                </div>

                <!-- Chronological Flat List of Highlights (Ordered by Set & Total Score) -->
                <div class="highlight-sublist" id="sublist-${m.id}">
                  ${m.highlights.length === 0 ? `
                    <div style="font-size: 13px; color: var(--text-tertiary); padding: 8px;">No highlights clipped yet.</div>
                  ` : sortHighlightsChronologically(m.highlights).map(h => `
                    <div class="highlight-row">
                      <div class="highlight-left">
                        <button class="btn-star-clip ${h.isStarred ? 'starred' : ''}" data-clip-id="${h.id}" data-match-id="${m.id}" title="${h.isStarred ? 'Starred highlight (Click to unstar)' : 'Star this highlight'}" aria-label="Star highlight">
                          ${h.isStarred ? '★' : '☆'}
                        </button>
                        <span class="highlight-badge tabular-nums">Set ${h.set} (${h.score})</span>
                        <span class="highlight-label">${h.label || 'Highlight'}</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${h.isUploading ? `
                          <span class="highlight-uploading">⏳ Uploading...</span>
                        ` : `
                          ${(m.isArchived || !h.videoUrl) ? `
                            <span class="drive-clip-tag" title="Saved in Google Drive">📁 Drive</span>
                          ` : ''}
                          <button class="apple-btn btn-play-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="${(m.isArchived || !h.videoUrl) ? 'Watch Highlight via Google Drive' : 'Watch Highlight Replay'}">▶</button>
                          <button class="btn-share-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="Share Highlight (Text, AirDrop, or Save to Photos)" aria-label="Share Highlight">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                              <polyline points="16 6 12 2 8 6"></polyline>
                              <line x1="12" y1="2" x2="12" y2="15"></line>
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

    const btnDrive = container.querySelector('#btn-drive-header');
    if (btnDrive) {
      btnDrive.onclick = () => {
        const savedUrl = localStorage.getItem('gamestreamer_drive_folder_url');
        if (savedUrl) {
          window.open(savedUrl, '_blank');
        } else {
          const chosen = prompt('Open your Google Drive Match Clips folder:\n(Enter your Google Drive folder link, or click OK to open Google Drive)', 'https://drive.google.com/drive/my-drive');
          if (chosen && chosen.trim()) {
            localStorage.setItem('gamestreamer_drive_folder_url', chosen.trim());
            window.open(chosen.trim(), '_blank');
          }
        }
      };
    }

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

    // Highlight Star / Favorite button (on the very left of each highlight row)
    container.querySelectorAll('.btn-star-clip').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const isStarred = store.toggleStarHighlight(matchId, clipId);
        btn.classList.toggle('starred', isStarred);
        btn.innerHTML = isStarred ? '★' : '☆';
        btn.title = isStarred ? 'Starred highlight (Click to unstar)' : 'Star this highlight';
      };
    });

    // Play full match highlight reel (YouTube-style continuous highlights with live score overlay)
    container.querySelectorAll('.btn-play-reel').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const match = state.matches.find(m => m.id === matchId);
        if (match && match.highlights && match.highlights.length > 0) {
          new HighlightReelPlayer(match);
        }
      };
    });

    // Clip share buttons (Opens iOS Share sheet with Save Video / Text / AirDrop on iPhone, Downloads folder on PC)
    container.querySelectorAll('.btn-share-clip, .btn-download-clip').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
          const clip = match.highlights.find(c => c.id === clipId);
          if (clip) {
            shareHighlightVideo(clip, btn);
          }
        }
      };
    });

    // Match Archive button (Delete server video copies to free space, rely on Google Drive)
    container.querySelectorAll('.btn-archive-match').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const opponent = btn.dataset.opponent || 'this';
        const confirmed = confirm(
          `Archive "${opponent}" match to Google Drive?\n\n` +
          `• Server video copies will be deleted to free up cloud storage.\n` +
          `• All highlights and scores remain permanently preserved in your Google Drive archive.\n` +
          `• Highlights will be played via Google Drive.`
        );
        if (confirmed) {
          store.archiveMatch(matchId);
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
        <button class="apple-btn apple-btn-primary" id="btn-confirm-go-live" style="display: inline-flex; align-items: center; gap: 6px;">
          ${getBroadcastIcon(16, '#ffffff')}
          <span>Start Stream</span>
        </button>
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
