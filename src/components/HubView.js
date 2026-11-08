// ==========================================================================
// HubView: Main Family Hub & Unified Match Archive
// ==========================================================================

import { store, sortHighlightsChronologically, formatTennisSetScores, getTennisPointDisplay } from '../services/store.js';
import { ReplayPlayer } from './ReplayPlayer.js';
import { HighlightReelPlayer } from './HighlightReelPlayer.js';
import { authService } from '../services/auth.js';
import { shareHighlightVideo } from '../services/share.js';
import { getBroadcastIcon, getLockIcon, getUnlockIcon, getMoreIcon, getPlayIcon, getShareIcon, getTrashIcon, getFolderIcon, getBugIcon, getCloudIcon } from './icons.js';
import { extractDriveFolderId, requestDriveAccessToken, uploadClipToGoogleDrive, uploadHighlightViaMailSlot, downloadClipLocally } from '../services/drive.js';
import { getLocalClipBlob, deleteLocalMatchBlobs, isClipSyncedToDrive, getMatchSyncStatus, syncPendingClipsForMatch, onSyncStatusChanged, triggerAutoSyncSweep } from '../services/mediaStorage.js';

export function renderHubView(container, navigate) {
  function update() {
    const state = store.getState();
    const active = state.activeMatch;
    const stats = store.getServerStorageStats();
    const isAdmin = authService.isBroadcaster();

    // Summary calculation for Match Archive header
    let totalArchiveClips = 0;
    let totalArchiveBytes = 0;
    let totalArchiveUnsynced = 0;
    for (const m of (state.matches || [])) {
      for (const h of (m.highlights || [])) {
        totalArchiveClips++;
        totalArchiveBytes += (h.fileSizeBytes || 3400000);
        if (!isClipSyncedToDrive(h)) {
          totalArchiveUnsynced++;
        }
      }
    }
    const totalArchiveMB = Math.round(totalArchiveBytes / (1024 * 1024));

    container.innerHTML = `
      <div class="hub-container">
        <!-- Header -->
        <header class="hub-header">
          <div class="hub-brand">
            <span style="font-size: 20px; display: inline-flex; align-items: center; gap: 3px;">
              <span>🏐</span><span>🎾</span>
            </span>
            <h1>Game Streamer</h1>
          </div>
          <div class="hub-header-actions" style="display: flex; align-items: center; gap: 8px;">
            <div id="hub-sync-status-badge" class="sync-unsynced-badge idle" title="0 unsynced" style="cursor: pointer;">0</div>
            ${isAdmin ? `
              <button class="apple-btn apple-btn-sm apple-btn-primary" id="btn-go-live-header" title="Start Live Match Broadcast">
                ${getBroadcastIcon(13, 'currentColor')}
                <span>Go Live</span>
              </button>
              <button class="apple-btn apple-btn-sm" id="btn-admin-lock" title="Admin Active — Tap to Lock" style="border-color: rgba(255, 214, 10, 0.45); color: var(--accent-gold);">
                ${getUnlockIcon(14, 'currentColor')}
                <span>Admin</span>
              </button>
            ` : `
              <button class="apple-btn apple-btn-sm" id="btn-admin-lock" title="Broadcaster Admin Access">
                ${getLockIcon(14, 'currentColor')}
                <span>Admin</span>
              </button>
            `}
          </div>
        </header>

        <!-- Live Hero Section -->
        ${active && active.isLive ? `
          <div class="live-hero-card frosted-glass">
            <div class="live-hero-header">
              <span class="live-badge" style="display: inline-flex; align-items: center; gap: 6px;">
                ${getBroadcastIcon(13, 'var(--accent-red)')}
                <span>Live Now</span>
              </span>
              <span class="sport-badge-card ${active.sport === 'tennis' ? 'tennis' : 'volleyball'}">
                ${active.sport === 'tennis' ? '🎾 Tennis' : '🏐 Volleyball'}
              </span>
              <span class="tabular-nums" style="font-size: 13px; color: var(--text-secondary); margin-left: auto;">${active.viewers || 0} watching</span>
            </div>

            <div class="live-matchup-title">vs. ${active.opponent}</div>

            ${active.sport === 'tennis' ? (() => {
              const ptDisplay = getTennisPointDisplay(active.pointsUs, active.pointsThem, active.isTiebreak, active.tennisScoringType);
              return `
                <div style="margin: 8px 0 12px 0;">
                  <div class="tennis-tv-scoreboard" style="max-width: 320px;">
                    <div class="tennis-row">
                      <div class="tennis-row-team">
                        <span class="tennis-server-indicator ${active.server === 'us' ? 'active' : ''}">🎾</span>
                        <span class="tennis-team-name" title="${active.teamName || 'US'}">${active.teamName || 'US'}</span>
                      </div>
                      <div class="tennis-sets-wrap">
                        ${(active.setScores || []).map(set => `
                          <div class="tennis-set-cell">${set.us !== undefined ? set.us : (set.score ? set.score.split('-')[0] : '?')}</div>
                        `).join('')}
                        ${active.currentSetFormat !== 'tiebreak-10' && active.currentSetFormat !== 'tiebreak-7' ? `<div class="tennis-set-cell current">${active.gamesUs || 0}</div>` : ''}
                      </div>
                      <div class="tennis-point-cell tabular-nums">${ptDisplay.us}</div>
                    </div>
                    <div class="tennis-row">
                      <div class="tennis-row-team">
                        <span class="tennis-server-indicator ${active.server === 'them' ? 'active' : ''}">🎾</span>
                        <span class="tennis-team-name" title="${active.opponent || 'OPPONENT'}">${active.opponent || 'OPPONENT'}</span>
                      </div>
                      <div class="tennis-sets-wrap">
                        ${(active.setScores || []).map(set => `
                          <div class="tennis-set-cell">${set.them !== undefined ? set.them : (set.score ? set.score.split('-')[1] : '?')}</div>
                        `).join('')}
                        ${active.currentSetFormat !== 'tiebreak-10' && active.currentSetFormat !== 'tiebreak-7' ? `<div class="tennis-set-cell current">${active.gamesThem || 0}</div>` : ''}
                      </div>
                      <div class="tennis-point-cell tabular-nums">${ptDisplay.them}</div>
                    </div>
                  </div>
                </div>
              `;
            })() : `
              <div class="live-score-strip tabular-nums">
                <span>${active.scoreUs}</span>
                <span style="color: var(--text-tertiary); font-weight: 300;">-</span>
                <span>${active.scoreThem}</span>
                <span class="live-score-sets">(Set ${active.currentSet} • Sets: ${active.setsUs}-${active.setsThem})</span>
              </div>
            `}

            <button class="apple-btn apple-btn-primary btn-watch-live" id="btn-watch-live">
              ▶ Tap to Watch Live Game
            </button>
          </div>
        ` : `
          <div class="live-hero-card frosted-glass" style="text-align: center; padding: 18px 16px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span class="live-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-tertiary); border-color: rgba(255, 255, 255, 0.08); font-size: 11px; padding: 3px 10px;">
                ⚪ No Live Match Right Now
              </span>
            </div>
          </div>
        `}

        <!-- Unified Match Archive -->
        <section class="archive-section">
          <div class="archive-header">
            <h2 class="archive-summary-title">Match Archive: ${totalArchiveClips} Files, ${totalArchiveMB} MB, ${totalArchiveUnsynced} Sync${totalArchiveUnsynced === 1 ? '' : 's'} Pending</h2>
          </div>

          <div class="match-list" id="match-archive-list">
            ${state.matches.map(m => {
              const matchHighlights = Array.isArray(m.highlights) ? m.highlights : [];
              const matchSetScores = Array.isArray(m.setScores) ? m.setScores : [];
              const syncStatus = getMatchSyncStatus(m);
              return `
              <div class="match-card frosted-glass">
                <div class="match-card-header" data-id="${m.id}">
                  <div class="match-info-main">
                    <div class="match-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="sport-badge-card ${m.sport === 'tennis' ? 'tennis' : 'volleyball'}">
                        ${m.sport === 'tennis' ? '🎾 Tennis' : '🏐 Volleyball'}
                      </span>
                      <span>${m.date} vs. ${m.opponent}</span>
                    </div>
                    <div class="match-meta tabular-nums">
                      ${matchHighlights.length} Highlight${matchHighlights.length === 1 ? '' : 's'} • ${
                        m.sport === 'tennis'
                          ? `Sets: ${formatTennisSetScores(matchSetScores) || `${m.setsUs || 0}-${m.setsThem || 0}`}`
                          : `Sets: ${m.setsUs || 0}-${m.setsThem || 0}`
                      }
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    ${(matchHighlights.length > 0) ? `
                      <button class="btn-play-reel" data-match-id="${m.id}" title="Watch continuous highlight reel">
                        <span>▶</span> <span>Reel (${matchHighlights.length})</span>
                      </button>
                    ` : ''}

                    ${isAdmin ? `
                      <button class="btn-resume-match" data-match-id="${m.id}" title="${m.isLive ? 'Resume Live Broadcast on this device' : 'Resume Match Broadcast on this device'}">
                        ${getBroadcastIcon(13, 'currentColor')}
                        <span>${m.isLive ? 'Resume Live' : 'Resume'}</span>
                      </button>
                    ` : ''}

                    ${m.isLive ? `
                      <span class="match-result-badge live">🔴 Live</span>
                    ` : (m.isFinished ? (
                      (m.winner === 'us' || (!m.winner && m.setsUs > m.setsThem)) ? `
                        <span class="match-result-badge win">Won ${m.sport === 'tennis' ? (formatTennisSetScores(matchSetScores) || `${m.setsUs}-${m.setsThem}`) : `${m.setsUs}-${m.setsThem}`}</span>
                      ` : `
                        <span class="match-result-badge">Final ${m.sport === 'tennis' ? (formatTennisSetScores(matchSetScores) || `${m.setsUs}-${m.setsThem}`) : `${m.setsUs}-${m.setsThem}`}</span>
                      `
                    ) : '')}

                    ${isAdmin ? `
                      <button class="apple-icon-btn btn-match-menu" data-match-id="${m.id}" title="Match Management Options" aria-label="Manage Match">
                        ${getMoreIcon(16, 'currentColor')}
                      </button>
                    ` : ''}
                  </div>
                </div>

                <!-- Chronological Flat List of Highlights -->
                <div class="highlight-sublist" id="sublist-${m.id}">
                  ${matchHighlights.length === 0 ? `
                    <div style="font-size: 13px; color: var(--text-tertiary); padding: 8px;">No highlights clipped yet.</div>
                  ` : sortHighlightsChronologically(matchHighlights).map(h => {
                    const isSynced = isClipSyncedToDrive(h);
                    const isDriveOnly = h.storageTier === 'drive' || m.isArchived || !h.videoUrl;
                    return `
                    <div class="highlight-row">
                      <div class="highlight-left">
                        <button class="btn-star-clip ${h.type || 'player'} ${h.isStarred ? 'starred' : ''}" data-clip-id="${h.id}" data-match-id="${m.id}" data-type="${h.type || 'player'}" title="${h.type === 'team' ? (h.isStarred ? 'Starred Team Highlight' : 'Star Team Highlight') : (h.isStarred ? 'Starred Player Highlight' : 'Star Player Highlight')}" aria-label="Star highlight">
                          ${h.isStarred ? '★' : '☆'}
                        </button>
                        <span class="highlight-badge tabular-nums">Set ${h.set} (${h.score})</span>
                        <span class="highlight-label">${h.label || 'Highlight'}</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${isAdmin ? `
                          <span class="clip-storage-dot ${isDriveOnly ? 'drive' : (isSynced ? 'synced' : 'unsynced')}" title="${isDriveOnly ? 'Archived in Google Drive' : (isSynced ? 'Synced (App + Google Drive)' : '⚠️ Stored locally on phone camera master — Not synced to Google Drive (tap to sync)')}"></span>
                        ` : ''}
                        <button class="apple-icon-btn btn-play-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="Play Highlight Replay">
                          ${getPlayIcon(12, 'currentColor')}
                        </button>
                        <button class="apple-icon-btn btn-share-clip" data-clip-id="${h.id}" data-match-id="${m.id}" title="Share Highlight (AirDrop, Text, or Save)">
                          ${getShareIcon(14, 'currentColor')}
                        </button>
                        ${isAdmin ? `
                          <button class="apple-icon-btn btn-trash-clip" data-clip-id="${h.id}" data-match-id="${m.id}" data-label="${h.label || 'Highlight'}" data-score="${h.score || ''}" data-set="${h.set || 1}" title="Delete Highlight (Admin only)" style="color: var(--text-tertiary);">
                            ${getTrashIcon(13, 'currentColor')}
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  `;
                  }).join('')}
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
            `;
            }).join('')}
          </div>
        </section>
      </div>
    `;

    // Setup action listeners
    const openWatcher = () => {
      navigate('/watch');
    };

    const btnWatchLive = container.querySelector('#btn-watch-live');
    if (btnWatchLive) btnWatchLive.onclick = openWatcher;

    const btnAdminLock = container.querySelector('#btn-admin-lock');
    if (btnAdminLock) {
      btnAdminLock.onclick = async () => {
        if (!authService.isBroadcaster()) {
          const user = await authService.requestBroadcasterAccess();
          if (user) {
            update();
          }
        } else {
          // Instant lock back to pure Watcher view
          authService.lock();
          update();
        }
      };
    }

    const btnGoLive = container.querySelector('#btn-go-live-header');
    if (btnGoLive) {
      btnGoLive.onclick = async () => {
        const user = await authService.requestBroadcasterAccess();
        if (user) {
          showMatchSetupModal(navigate, user);
        }
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

    // Highlight Star / Favorite button
    container.querySelectorAll('.btn-star-clip').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const res = store.toggleStarHighlight(matchId, clipId);
        const isStarred = (typeof res === 'object') ? res.isStarred : res;
        const type = (typeof res === 'object') ? res.type : (btn.dataset.type || 'player');
        btn.classList.toggle('starred', isStarred);
        btn.innerHTML = isStarred ? '★' : '☆';
        btn.title = isStarred
          ? (type === 'team' ? 'Starred Team Highlight' : 'Starred Player Highlight')
          : (type === 'team' ? 'Star Team Highlight' : 'Star Player Highlight');
      };
    });

    // Play full match highlight reel
    container.querySelectorAll('.btn-play-reel').forEach(btn => {
      const matchId = btn.dataset.matchId;
      const match = state.matches.find(m => m.id === matchId);

      btn.onclick = (e) => {
        e.stopPropagation();
        if (match && match.highlights && match.highlights.length > 0) {
          new HighlightReelPlayer(match);
        }
      };
    });

    // Resume match broadcast button
    container.querySelectorAll('.btn-resume-match').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        let broadcaster = authService.getUser();
        if (!broadcaster) {
          try {
            broadcaster = await authService.requestBroadcasterAccess();
          } catch (err) {
            return;
          }
        }
        if (!broadcaster) return;

        const matchId = btn.dataset.matchId;
        store.resumeMatch(matchId);
        navigate('/stream');
      };
    });

    // Match Manage Menu (•••) button
    container.querySelectorAll('.btn-match-menu').forEach(btn => {
      const handleMenuClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        openMatchOptionsMenu(btn, matchId);
      };
      btn.onclick = handleMenuClick;
      btn.ontouchend = handleMenuClick;
    });


    // Tap unsynced dot to trigger repair / sync
    container.querySelectorAll('.clip-storage-dot.unsynced').forEach(dot => {
      dot.style.cursor = 'pointer';
      dot.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const card = dot.closest('.match-card');
        const header = card?.querySelector('.match-card-header');
        const matchId = header?.dataset.id;
        if (matchId) repairAndSyncMatchHighlights(matchId);
      };
    });

    // Clip share buttons
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

    // Highlight Delete button (Admin only)
    container.querySelectorAll('.btn-trash-clip').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const matchId = btn.dataset.matchId;
        const clipId = btn.dataset.clipId;
        const label = btn.dataset.label || 'Highlight';
        const score = btn.dataset.score || '';
        const setNum = btn.dataset.set || '1';

        showConfirmActionModal({
          title: 'Delete Highlight Clip?',
          message: 'Are you sure you want to permanently delete this highlight from the archive?',
          details: [
            `• Clip: <b>${label}</b> (Set ${setNum}, ${score})`
          ],
          confirmText: 'Delete Clip',
          isDanger: true,
          onConfirm: () => {
            store.deleteHighlight(matchId, clipId);
          }
        });
      };
    });
  }

  let latestSyncStatus = null;
  function updateSyncBadgeUI() {
    const badge = container.querySelector('#hub-sync-status-badge');
    if (!badge) return;
    const unsynced = latestSyncStatus ? (latestSyncStatus.unsyncedCount || 0) : 0;
    const isSyncing = latestSyncStatus ? Boolean(latestSyncStatus.isUploading) : false;

    badge.textContent = String(unsynced);
    if (isSyncing) {
      badge.className = 'sync-unsynced-badge syncing';
      badge.title = `${unsynced} unsynced (syncing...)`;
    } else if (unsynced > 0) {
      badge.className = 'sync-unsynced-badge pending';
      badge.title = `${unsynced} unsynced`;
    } else {
      badge.className = 'sync-unsynced-badge idle';
      badge.title = '0 unsynced';
    }

    if (!badge.dataset.bound) {
      badge.dataset.bound = 'true';
      badge.onclick = () => {
        triggerAutoSyncSweep();
      };
    }
  }

  function handleStateChange() {
    update();
    updateSyncBadgeUI();
  }

  update();
  const unsubStore = store.subscribe(handleStateChange);
  const unsubAuth = authService.subscribe(handleStateChange);
  const unsubSync = onSyncStatusChanged((status) => {
    latestSyncStatus = status;
    updateSyncBadgeUI();
  });

  // Automatically trigger auto-sync sweep upon entering Hub View
  triggerAutoSyncSweep();

  return () => {
    unsubSync();
    unsubStore();
    unsubAuth();
  };
}

function showHubToast(message, duration = 3000) {
  const existing = document.querySelector('#hub-sync-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'hub-sync-toast';
  toast.className = 'frosted-glass';
  toast.style.cssText = 'position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 980px; background: rgba(15, 23, 42, 0.94); color: #fff; z-index: 99999; font-size: 13px; font-weight: 500; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); text-align: center; pointer-events: none; max-width: 90vw; animation: fadeIn 0.2s ease-out;';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

async function repairAndSyncMatchHighlights(matchId) {
  const state = store.getState();
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const syncStatus = getMatchSyncStatus(match);
  if (syncStatus.unsyncedCount === 0) {
    showHubToast(`✓ All highlights for "${match.opponent}" are already synced to Google Drive!`);
    return;
  }

  showHubToast(`Syncing ${syncStatus.unsyncedCount} pending highlight(s) to Google Drive...`, 5000);

  const res = await syncPendingClipsForMatch(matchId, (statusText) => {
    showHubToast(statusText, 3500);
  });

  if (res.needsPhone) {
    showConfirmActionModal({
      title: '📱 Highlights Stored on Recording Phone',
      message: `The ${syncStatus.unsyncedCount} highlight(s) for "${match.opponent}" were recorded on your camera phone and are preserved safely in that phone's camera storage.\n\nTo extract them or push them to Google Drive, tap Launch Recovery Tool below.`,
      confirmText: '🛠️ Launch Recovery Tool',
      isDanger: false,
      onConfirm: () => {
        window.location.hash = '#/recover';
      }
    });
  } else if (res.success) {
    showHubToast(`✓ Successfully synced ${res.syncedCount} highlight(s) to Google Drive!`, 4000);
  }
}

// Unified Match Manage Menu (•••)
function openMatchOptionsMenu(anchorBtn, matchId) {
  if (!authService.isBroadcaster()) return;
  const existing = document.querySelector('.admin-menu-dropdown');
  const existingOverlay = document.querySelector('.admin-menu-overlay');
  if (existing) existing.remove();
  if (existingOverlay) existingOverlay.remove();

  const state = store.getState();
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const overlay = document.createElement('div');
  overlay.className = 'admin-menu-overlay';

  const menu = document.createElement('div');
  menu.className = 'admin-menu-dropdown';

  const rect = anchorBtn.getBoundingClientRect();
  const menuWidth = Math.min(220, window.innerWidth - 20);
  let left = rect.right - menuWidth;
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  let top = rect.bottom + 6;
  if (top + 220 > window.innerHeight) {
    top = Math.max(10, rect.top - 210);
  }

  menu.style.position = 'fixed';
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const syncStatus = getMatchSyncStatus(match);
  const isDrive = match.storageTier === 'drive' || match.isArchived;
  const isFullySynced = syncStatus.isFullySynced;
  const hasUnsynced = syncStatus.unsyncedCount > 0;
  const hasClips = (match.highlights || []).length > 0;

  menu.innerHTML = `
    ${isDrive ? `
      <button class="admin-menu-item" data-action="restore">
        ${getCloudIcon(14, 'var(--accent-blue)')}
        <span>Restore to Server</span>
      </button>
    ` : hasUnsynced ? `
      <button class="admin-menu-item warning" data-action="sync-pending" style="color: #ff9f0a;">
        ${getCloudIcon(14, '#ff9f0a')}
        <span>Sync ${syncStatus.unsyncedCount} Pending to Drive</span>
      </button>
    ` : isFullySynced ? `
      <button class="admin-menu-item" data-action="purge">
        ${getTrashIcon(14, 'var(--text-secondary)')}
        <span>Free Server Space</span>
      </button>
    ` : !match.isLive ? `
      <button class="admin-menu-item" data-action="backup">
        ${getCloudIcon(14, 'var(--accent-green)')}
        <span>Backup to Drive</span>
      </button>
    ` : ''}

    ${hasClips ? `
      <button class="admin-menu-item" data-action="diagnostics">
        ${getBugIcon(14, '#64d2ff')}
        <span>Diagnostics</span>
      </button>
      <button class="admin-menu-item" data-action="recovery" style="color: #ffd60a;">
        <span style="font-size: 14px;">🛠️</span>
        <span>Phone Video Recovery</span>
      </button>
    ` : ''}

    <div class="admin-menu-divider"></div>

    <button class="admin-menu-item danger" data-action="delete">
      ${getTrashIcon(14, 'var(--accent-red)')}
      <span>Delete Match</span>
    </button>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(menu);

  const closeMenu = () => {
    overlay.remove();
    menu.remove();
  };

  overlay.onclick = closeMenu;

  menu.querySelectorAll('.admin-menu-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      closeMenu();

      if (action === 'sync-pending') {
        repairAndSyncMatchHighlights(matchId);
      } else if (action === 'restore') {
        store.restoreMatchToServer(matchId);
      } else if (action === 'purge') {
        showConfirmActionModal({
          title: 'Free App Server Storage?',
          message: `Reclaim cloud space for "${match.opponent}" match?\n\n• Video files will be deleted from the app server to save hosting quota.\n• All highlights and scores remain permanently preserved in your Google Drive archive folder.\n• Highlights will be played via Google Drive.`,
          confirmText: 'Free Server Space',
          isDanger: false,
          onConfirm: () => {
            store.purgeServerMatchStorage(matchId);
            if (match.highlights) {
              deleteLocalMatchBlobs(match.highlights);
            }
          }
        });
      } else if (action === 'backup') {
        showDriveBackupModal(matchId);
      } else if (action === 'diagnostics') {
        showMatchDiagnosticsModal(matchId);
      } else if (action === 'recovery') {
        window.location.hash = '#/recover';
      } else if (action === 'delete') {
        showConfirmActionModal({
          title: 'Delete Match from Database?',
          message: 'This will permanently remove this entire match and its clips from the database archive.',
          details: [
            `• Opponent: <b>${match.opponent}</b>`,
            `• Date: ${match.date}`,
            `• Saved Clips: ${(match.highlights || []).length}`
          ],
          confirmText: 'Delete Match',
          isDanger: true,
          onConfirm: () => {
            store.deleteMatch(matchId);
          }
        });
      }
    };
  });
}

// Dedicated Highlights & Storage Diagnostics Modal
async function showMatchDiagnosticsModal(matchId) {
  if (!authService.isBroadcaster()) return;
  const state = store.getState();
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const existing = document.querySelector('#match-diagnostics-modal');
  if (existing) existing.remove();

  const clips = match.highlights || [];
  const driveUrl = store.getDriveLocation();

  const modal = document.createElement('div');
  modal.id = 'match-diagnostics-modal';
  modal.className = 'apple-modal-overlay';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;';

  modal.innerHTML = `
    <div class="apple-modal frosted-glass" style="max-width: 520px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; padding: 22px; border-radius: 20px; text-align: left; box-shadow: 0 24px 60px rgba(0,0,0,0.7); background: rgba(22,24,30,0.97); border: 1px solid rgba(100,210,255,0.35);">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">🐞</span>
          <div>
            <h3 style="font-size: 17px; font-weight: 700; margin: 0; color: #fff;">Highlights & Storage Diagnostics</h3>
            <span style="font-size: 12px; color: #64d2ff; font-family: monospace;">Match: ${match.opponent} (${match.id})</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="apple-btn" id="btn-copy-match-diag" style="padding: 4px 10px; font-size: 11px; background: rgba(10,132,255,0.3); color: #fff;">📋 Copy</button>
          <button class="btn-exit-circle" id="btn-close-match-diag" style="width: 28px; height: 28px; font-size: 13px;">✕</button>
        </div>
      </div>

      <div style="overflow-y: auto; flex: 1; padding-right: 4px;" id="diag-modal-body">
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">Inspecting storage status for ${clips.length} highlight clip${clips.length === 1 ? '' : 's'}...</div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btnClose = modal.querySelector('#btn-close-match-diag');
  const btnCopy = modal.querySelector('#btn-copy-match-diag');
  const body = modal.querySelector('#diag-modal-body');

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  btnClose.onclick = () => modal.remove();

  // Async inspect each clip
  const clipReports = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    let localBlob = null;
    try {
      localBlob = await getLocalClipBlob(c.id);
    } catch (e) {}

    const isBlobUrl = c.videoUrl && c.videoUrl.startsWith('blob:');
    const isSampleFallback = !c.videoUrl || c.videoUrl.includes('sample-highlight.mp4');
    const isCloudStorage = c.videoUrl && c.videoUrl.includes('firebasestorage.googleapis.com');

    clipReports.push({
      index: i + 1,
      id: c.id,
      label: c.label,
      set: c.set,
      score: c.score,
      configuredVideoUrl: c.videoUrl || 'None',
      storageTier: c.storageTier || 'server',
      hasLocalIndexedDBBlob: !!localBlob,
      localBlobSizeBytes: localBlob ? localBlob.size : 0,
      isBlobUrl,
      isSampleFallback,
      isCloudStorage,
      statusSummary: localBlob
        ? 'Real camera video preserved in this device IndexedDB'
        : (isCloudStorage ? 'Synced to Cloud Storage' : 'Sample fallback on this device (phone has camera clip)')
    });
  }

  const fullReport = {
    appVersion: 'v1.3.1',
    timestamp: new Date().toISOString(),
    matchId: match.id,
    matchOpponent: match.opponent,
    isFinished: match.isFinished,
    cloudStorageBucket: 'gamestreamer-live.firebasestorage.app',
    cloudStorageStatus: 'Pending Activation in Firebase Console (https://console.firebase.google.com/project/gamestreamer-live/storage)',
    driveFolderUrl: driveUrl,
    highlightsCount: clips.length,
    clips: clipReports
  };

  btnCopy.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(fullReport, null, 2)).then(() => {
      btnCopy.textContent = '✓ Copied!';
      setTimeout(() => { btnCopy.textContent = '📋 Copy'; }, 2000);
    }).catch(() => {});
  };

  body.innerHTML = `
    <!-- Cloud Storage Status Banner -->
    <div style="background: rgba(255,149,0,0.14); border: 1px solid rgba(255,149,0,0.4); border-radius: 12px; padding: 12px; margin-bottom: 14px; font-size: 12px; line-height: 1.45;">
      <div style="font-weight: 700; color: #ffb340; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <span>☁️ Cloud Video Storage</span>
        <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,149,0,0.3); color: #fff;">Setup Required</span>
      </div>
      <div style="color: #cbd5e1; font-size: 11.5px;">
        To stream full camera highlights from your phone across to your computer and watchers, activate Firebase Cloud Storage in the Firebase Console:
      </div>
      <a href="https://console.firebase.google.com/project/gamestreamer-live/storage" target="_blank" rel="noopener noreferrer" class="apple-btn" style="display: inline-block; margin-top: 8px; font-size: 11px; padding: 5px 10px; background: rgba(255,149,0,0.25); color: #fff; text-decoration: none; border: 1px solid rgba(255,149,0,0.5);">
        ▶ Open Firebase Console & Click 'Get Started' ↗
      </a>
    </div>

    <!-- Highlights Storage Table -->
    <div style="font-weight: 700; color: #fff; font-size: 13px; margin-bottom: 8px;">Highlight Clips (${clips.length}):</div>
    ${clipReports.length === 0 ? `
      <div style="color: #64748b; font-size: 12px;">No highlights recorded for this match yet.</div>
    ` : clipReports.map(c => `
      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-size: 11.5px; font-family: monospace;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #fff; font-size: 12px;">[${c.index}] ${c.label} (Set ${c.set}, ${c.score})</span>
          <span style="color: ${c.hasLocalIndexedDBBlob ? '#30d158' : '#ffd60a'}; font-size: 10.5px;">
            ${c.hasLocalIndexedDBBlob ? `💾 Local Camera Blob (${(c.localBlobSizeBytes / 1024 / 1024).toFixed(1)} MB)` : '☁️ Server / Remote'}
          </span>
        </div>
        <div style="color: #94a3b8; font-size: 10.5px; margin-bottom: 3px;">
          <b>ID:</b> <span style="color: #64d2ff;">${c.id}</span>
        </div>
        <div style="color: #94a3b8; font-size: 10.5px; margin-bottom: 3px; word-break: break-all;">
          <b>Server URL:</b> <span style="color: ${c.isBlobUrl ? '#ff453a' : '#ffd60a'};">${c.configuredVideoUrl}</span>
        </div>
        <div style="padding: 4px 8px; border-radius: 6px; background: ${c.hasLocalIndexedDBBlob ? 'rgba(48,209,88,0.12)' : 'rgba(255,149,0,0.12)'}; color: ${c.hasLocalIndexedDBBlob ? '#30d158' : '#ffb340'}; font-size: 10.5px; margin-top: 5px;">
          ${c.hasLocalIndexedDBBlob ? '✅ This device recorded and holds the real camera footage in IndexedDB.' : 'ℹ️ Remote device: Plays sample video until Cloud Storage is activated in Firebase Console.'}
        </div>
      </div>
    `).join('')}
  `;
}

// Dedicated Google Drive Archiving Modal (Direct Google API Upload & Download/Open Folder Fallback)
function showDriveBackupModal(matchId) {
  const state = store.getState();
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const existing = document.querySelector('#drive-backup-modal');
  if (existing) existing.remove();

  const driveUrl = store.getDriveLocation();
  const folderId = extractDriveFolderId(driveUrl);
  const clips = match.highlights || [];

  const modal = document.createElement('div');
  modal.id = 'drive-backup-modal';
  modal.className = 'apple-modal-overlay';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';

  modal.innerHTML = `
    <div class="apple-modal frosted-glass" style="max-width: 440px; width: 100%; padding: 26px; border-radius: 20px; text-align: left; box-shadow: 0 24px 60px rgba(0,0,0,0.6); background: rgba(28,28,32,0.96); border: 1px solid rgba(255,255,255,0.16);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 32px;">📁</span>
          <div>
            <h3 style="font-size: 19px; font-weight: 700; margin: 0; color: #fff;">Archive to Google Drive</h3>
            <span style="font-size: 13px; color: var(--text-secondary);">${match.opponent ? `vs. ${match.opponent}` : 'Match'} (${clips.length} clip${clips.length === 1 ? '' : 's'})</span>
          </div>
        </div>
        <button class="btn-exit-circle" id="btn-close-drive-modal" style="width: 28px; height: 28px; font-size: 14px;">✕</button>
      </div>

      <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 14px; margin: 16px 0; font-size: 13px; color: #ccc;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: var(--text-tertiary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Target Google Drive Folder</span>
          <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" style="color: #64d2ff; text-decoration: none; font-size: 12px; font-weight: 600;">Open Folder ↗</a>
        </div>
        <div style="font-family: monospace; font-size: 11px; word-break: break-all; color: #fff; line-height: 1.4;">
          ${driveUrl}
        </div>
      </div>

      <div id="drive-upload-status" style="display: none; margin-bottom: 16px; padding: 10px 14px; border-radius: 10px; background: rgba(10, 132, 255, 0.15); border: 1px solid rgba(10, 132, 255, 0.3); font-size: 13px; color: #64d2ff;">
        <span id="drive-upload-status-text">Uploading to Google Drive...</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="apple-btn apple-btn-primary" id="btn-drive-direct-upload" style="padding: 12px 16px; font-size: 14px; font-weight: 600; justify-content: center; display: flex; align-items: center; gap: 8px;">
          <span>⚡ Auto-Upload to Google Drive Folder</span>
        </button>

        <button class="apple-btn frosted-glass" id="btn-drive-download-open" style="padding: 12px 16px; font-size: 14px; justify-content: center; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.18);">
          <span>📥 Download ${clips.length} MP4 File${clips.length === 1 ? '' : 's'} & Open Folder</span>
        </button>
      </div>

      <p style="font-size: 11px; color: var(--text-tertiary); margin: 14px 0 0 0; line-height: 1.4; text-align: center;">
        Clips stay immediately playable from the server while permanently preserved in your Drive archive.
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  const btnClose = modal.querySelector('#btn-close-drive-modal');
  const btnDirectUpload = modal.querySelector('#btn-drive-direct-upload');
  const btnDownloadOpen = modal.querySelector('#btn-drive-download-open');
  const statusBox = modal.querySelector('#drive-upload-status');
  const statusText = modal.querySelector('#drive-upload-status-text');

  const close = () => modal.remove();
  btnClose.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // 1. Direct Google Drive API Upload via Private Mail Slot
  btnDirectUpload.onclick = async () => {
    statusBox.style.display = 'block';
    statusText.textContent = 'Pushing highlights to your Google Drive folder...';
    btnDirectUpload.disabled = true;

    try {
      let uploadedCount = 0;
      let missingPhoneBlobCount = 0;

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        if (isClipSyncedToDrive(clip)) {
          uploadedCount++;
          continue;
        }

        statusText.textContent = `Uploading ${i + 1} of ${clips.length}: ${clip.label || 'Highlight'} to Google Drive...`;

        let blob = null;
        try {
          blob = await getLocalClipBlob(clip.id);
        } catch (e) {}

        if ((!blob || blob.size === 0) && clip.videoUrl && !clip.videoUrl.startsWith('blob:')) {
          try {
            const res = await fetch(clip.videoUrl);
            if (res.ok) blob = await res.blob();
          } catch (e) {}
        }

        if (!blob || blob.size === 0) {
          missingPhoneBlobCount++;
          continue;
        }

        try {
          const res = await uploadHighlightViaMailSlot({
            ...clip,
            matchDate: match.date,
            opponent: match.opponent,
            comment: clip.comment || clip.label
          }, blob);
          if (res && res.fileId) {
            clip.driveFileId = res.fileId;
            clip.driveUrl = res.webViewLink;
            clip.videoUrl = res.downloadUrl;
            clip.cloudUploaded = true;
            clip.storageTier = 'synced';
            uploadedCount++;
            store.updateClipCloudDetails(matchId, clip.id, {
              driveFileId: res.fileId,
              driveUrl: res.webViewLink,
              videoUrl: res.downloadUrl,
              storageTier: 'synced',
              cloudUploaded: true
            });
          }
        } catch (err) {
          console.warn('[DriveModal] Mail slot clip upload failed:', err);
        }
      }

      if (missingPhoneBlobCount > 0 && uploadedCount < clips.length) {
        statusText.textContent = `⚠️ ${missingPhoneBlobCount} clip(s) are stored on the camera phone that recorded them. Open GameStreamer on that phone to complete sync!`;
        btnDirectUpload.disabled = false;
      } else {
        statusText.textContent = `✓ Successfully saved ${uploadedCount} of ${clips.length} highlights directly to your Google Drive!`;
        store.backupMatchToDrive(matchId);
        store.saveState();
        setTimeout(close, 2200);
      }
    } catch (err) {
      statusText.textContent = `Upload issue: ${err.message}. You can use "Download & Open Folder" below.`;
      btnDirectUpload.disabled = false;
    }
  };

  // 2. Download files & Open Drive Folder
  btnDownloadOpen.onclick = async () => {
    btnDownloadOpen.disabled = true;
    statusBox.style.display = 'block';
    statusText.textContent = 'Preparing video files for download...';

    for (let i = 0; i < clips.length; i++) {
      statusText.textContent = `Downloading ${i + 1} of ${clips.length}...`;
      await downloadClipLocally(clips[i], match.opponent);
    }

    statusText.textContent = 'Opening Google Drive folder... Drag & drop the downloaded files into it!';
    window.open(driveUrl, '_blank');
    setTimeout(close, 2500);
  };
}

// Clean In-App Action Confirmation Modal (Replaces browser window.confirm to avoid iOS Safari popup issues)
function showConfirmActionModal({ title, message, details = [], confirmText = 'Delete', isDanger = true, onConfirm }) {
  const existing = document.querySelector('#confirm-action-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirm-action-modal';
  modal.className = 'apple-modal-overlay';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';

  modal.innerHTML = `
    <div class="apple-modal frosted-glass" style="max-width: 380px; width: 100%; padding: 24px; border-radius: 20px; text-align: left; box-shadow: 0 20px 40px rgba(0,0,0,0.5); background: rgba(28,28,30,0.95); border: 1px solid rgba(255,255,255,0.14);">
      <div style="font-size: 28px; margin-bottom: 8px;">🗑️</div>
      <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 6px 0; color: #fff;">${title}</h3>
      <p style="font-size: 13px; color: var(--text-secondary, #999); margin: 0 0 14px 0; line-height: 1.45;">
        ${message}
      </p>

      ${details.length > 0 ? `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #ddd; display: flex; flex-direction: column; gap: 4px;">
          ${details.map(d => `<div>${d}</div>`).join('')}
        </div>
      ` : ''}

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="apple-btn" id="btn-cancel-confirm" style="flex: 1; padding: 10px 14px; font-size: 14px; border-radius: 10px;">Cancel</button>
        <button class="apple-btn ${isDanger ? 'apple-btn-danger' : 'apple-btn-primary'}" id="btn-execute-confirm" style="flex: 1; padding: 10px 14px; font-size: 14px; font-weight: 600; border-radius: 10px;">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btnCancel = modal.querySelector('#btn-cancel-confirm');
  const btnExecute = modal.querySelector('#btn-execute-confirm');

  const close = () => modal.remove();

  btnCancel.onclick = close;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };

  btnExecute.onclick = () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  };
}

// Opponent & Sport Setup Modal once Google Credential is verified
function showMatchSetupModal(navigate, user) {
  let currentSport = localStorage.getItem('gamestreamer_last_sport') || 'volleyball';
  let tennisScoringType = 'ad'; // 'ad' | 'no-ad'
  let currentSetFormat = 'standard'; // 'standard' | 'pro8' | 'match_tiebreak_10' | 'tiebreak_7'
  let initialServer = 'us'; // 'us' | 'them'
  let startingSet = 1;
  let setsUs = 0;
  let setsThem = 0;
  let tennisPriorSets = []; // Array of { us: 6, them: 4, isUnknown: false, winner: 'us' }

  const modal = document.createElement('div');
  modal.className = 'simple-modal-backdrop';
  modal.innerHTML = `
    <div class="simple-modal" style="max-width: 420px; max-height: 90vh; overflow-y: auto;">
      <!-- Sport Selection Segmented Buttons -->
      <div class="sport-selector-row" style="margin-bottom: 14px;">
        <button class="sport-choice-btn ${currentSport === 'volleyball' ? 'active' : ''}" id="btn-sport-volleyball" type="button">
          <span class="sport-icon">🏐</span>
          <span>Volleyball</span>
        </button>
        <button class="sport-choice-btn tennis ${currentSport === 'tennis' ? 'active' : ''}" id="btn-sport-tennis" type="button">
          <span class="sport-icon">🎾</span>
          <span>Tennis</span>
        </button>
      </div>

      <!-- Opponent Name with 'vs.' in same row -->
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="font-size: 16px; font-weight: 700; color: var(--text-secondary);">vs.</span>
        <input type="text" class="simple-input" id="input-opponent" placeholder="Opponent (e.g. Lincoln High)" value="" style="flex: 1;" />
      </div>

      <!-- Cancel and Start Stream buttons placed directly below opponent name entry -->
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px;">
        <button class="apple-btn" id="btn-cancel-modal">Cancel</button>
        <button class="apple-btn apple-btn-primary" id="btn-confirm-go-live" style="display: inline-flex; align-items: center; gap: 6px;">
          ${getBroadcastIcon(16, 'currentColor')}
          <span>Start Stream</span>
        </button>
      </div>

      <!-- Tennis Rules & Format Box (Only shown if tennis is active) -->
      <div id="tennis-config-box" style="display: ${currentSport === 'tennis' ? 'block' : 'none'}; border-top: 1px solid var(--border-subtle); margin-top: 18px; padding-top: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--accent-gold); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
          <span>🎾 Tennis Rules & Server</span>
          <span style="font-size: 11px; font-weight: 500; color: var(--text-tertiary);">30s buffer auto-set</span>
        </div>

        <!-- Ad vs No-Ad -->
        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">Game Scoring Mode:</label>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button class="format-choice-chip ${tennisScoringType === 'ad' ? 'active' : ''}" id="btn-scoring-ad" type="button" style="flex: 1; text-align: center;">Advantage (Ad / Deuce)</button>
          <button class="format-choice-chip ${tennisScoringType === 'no-ad' ? 'active' : ''}" id="btn-scoring-noad" type="button" style="flex: 1; text-align: center;">No-Ad (Deciding Pt)</button>
        </div>

        <!-- Set 1 Format -->
        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">Set 1 Format:</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px;">
          <button class="format-choice-chip ${currentSetFormat === 'standard' ? 'active' : ''}" data-format="standard" id="btn-fmt-std" type="button">Standard (6 Games)</button>
          <button class="format-choice-chip ${currentSetFormat === 'pro8' ? 'active' : ''}" data-format="pro8" id="btn-fmt-pro8" type="button">8-Game Pro Set</button>
          <button class="format-choice-chip ${currentSetFormat === 'match_tiebreak_10' ? 'active' : ''}" data-format="match_tiebreak_10" id="btn-fmt-tb10" type="button">10-Pt Match TB</button>
          <button class="format-choice-chip ${currentSetFormat === 'tiebreak_7' ? 'active' : ''}" data-format="tiebreak_7" id="btn-fmt-tb7" type="button">7-Pt Tiebreak</button>
        </div>

        <!-- Server -->
        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">Initial Server:</label>
        <div style="display: flex; gap: 8px;">
          <button class="btn-server-toggle ${initialServer === 'us' ? 'serving' : ''}" id="btn-server-us" type="button">🎾 US Serving</button>
          <button class="btn-server-toggle ${initialServer === 'them' ? 'serving' : ''}" id="btn-server-them" type="button">🎾 Opponent Serving</button>
        </div>
      </div>

      <!-- Starting Set Stepper (Placed further down as it will rarely be used) -->
      <div style="border-top: 1px solid var(--border-subtle); margin-top: 18px; padding-top: 14px;">
        <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">
          Starting Set (Optional / Late Arrival):
        </label>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.04);">
            <button class="apple-btn" id="btn-dec-set" style="padding: 6px 14px; font-size: 16px; border-radius: 0;">–</button>
            <span id="txt-starting-set" class="tabular-nums" style="padding: 6px 14px; font-weight: 700; font-size: 15px; min-width: 44px; text-align: center;">1</span>
            <button class="apple-btn" id="btn-inc-set" style="padding: 6px 14px; font-size: 16px; border-radius: 0;">+</button>
          </div>
          <span style="font-size: 12px; color: var(--text-tertiary);" id="txt-set-hint">First set of match</span>
        </div>
      </div>

      <!-- Volleyball Prior Sets Won Stepper (Visible if Starting Set > 1 and sport is volleyball) -->
      <div id="volleyball-sets-won-row" style="display: none; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid var(--border-subtle);">
        <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">
          Prior Sets Won So Far:
        </label>
        <div style="display: flex; gap: 20px; align-items: center;">
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 4px;">US Sets Won:</div>
            <div style="display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
              <button class="apple-btn" id="btn-dec-us-sets" style="padding: 4px 10px; font-size: 14px; border-radius: 0;">–</button>
              <span id="txt-sets-us" class="tabular-nums" style="padding: 4px 10px; font-weight: 700; min-width: 32px; text-align: center;">0</span>
              <button class="apple-btn" id="btn-inc-us-sets" style="padding: 4px 10px; font-size: 14px; border-radius: 0;">+</button>
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 4px;">Opponent Sets Won:</div>
            <div style="display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
              <button class="apple-btn" id="btn-dec-them-sets" style="padding: 4px 10px; font-size: 14px; border-radius: 0;">–</button>
              <span id="txt-sets-them" class="tabular-nums" style="padding: 4px 10px; font-weight: 700; min-width: 32px; text-align: center;">0</span>
              <button class="apple-btn" id="btn-inc-them-sets" style="padding: 4px 10px; font-size: 14px; border-radius: 0;">+</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tennis Prior Sets List (Visible if Starting Set > 1 and sport is tennis) -->
      <div id="tennis-prior-sets-row" style="display: none; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid var(--border-subtle);">
        <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">
          Prior Set Scores (Tap ? if score unknown):
        </label>
        <div id="tennis-prior-sets-list" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- dynamically rendered -->
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btnCancel = modal.querySelector('#btn-cancel-modal');
  const btnConfirm = modal.querySelector('#btn-confirm-go-live');
  const inputOpponent = modal.querySelector('#input-opponent');

  const btnSportVolleyball = modal.querySelector('#btn-sport-volleyball');
  const btnSportTennis = modal.querySelector('#btn-sport-tennis');
  const tennisConfigBox = modal.querySelector('#tennis-config-box');

  const btnScoringAd = modal.querySelector('#btn-scoring-ad');
  const btnScoringNoAd = modal.querySelector('#btn-scoring-noad');
  const formatButtons = modal.querySelectorAll('.format-choice-chip[data-format]');
  const btnServerUs = modal.querySelector('#btn-server-us');
  const btnServerThem = modal.querySelector('#btn-server-them');

  const btnDecSet = modal.querySelector('#btn-dec-set');
  const btnIncSet = modal.querySelector('#btn-inc-set');
  const txtStartingSet = modal.querySelector('#txt-starting-set');
  const txtSetHint = modal.querySelector('#txt-set-hint');

  const volleyballSetsWonRow = modal.querySelector('#volleyball-sets-won-row');
  const btnDecUsSets = modal.querySelector('#btn-dec-us-sets');
  const btnIncUsSets = modal.querySelector('#btn-inc-us-sets');
  const txtSetsUs = modal.querySelector('#txt-sets-us');
  const btnDecThemSets = modal.querySelector('#btn-dec-them-sets');
  const btnIncThemSets = modal.querySelector('#btn-inc-them-sets');
  const txtSetsThem = modal.querySelector('#txt-sets-them');

  const tennisPriorSetsRow = modal.querySelector('#tennis-prior-sets-row');
  const tennisPriorSetsList = modal.querySelector('#tennis-prior-sets-list');

  // Sport selection handling
  function setSport(s) {
    currentSport = s;
    localStorage.setItem('gamestreamer_last_sport', s);
    if (s === 'volleyball') {
      btnSportVolleyball.classList.add('active');
      btnSportTennis.classList.remove('active');
      tennisConfigBox.style.display = 'none';
    } else {
      btnSportVolleyball.classList.remove('active');
      btnSportTennis.classList.add('active');
      tennisConfigBox.style.display = 'block';
    }
    updateSetUI();
  }

  btnSportVolleyball.onclick = () => setSport('volleyball');
  btnSportTennis.onclick = () => setSport('tennis');

  // Tennis Scoring handling
  btnScoringAd.onclick = () => {
    tennisScoringType = 'ad';
    btnScoringAd.classList.add('active');
    btnScoringNoAd.classList.remove('active');
  };
  btnScoringNoAd.onclick = () => {
    tennisScoringType = 'no-ad';
    btnScoringNoAd.classList.add('active');
    btnScoringAd.classList.remove('active');
  };

  // Tennis Set 1 Format handling
  formatButtons.forEach(btn => {
    btn.onclick = () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSetFormat = btn.dataset.format || 'standard';
    };
  });

  // Tennis Server handling
  btnServerUs.onclick = () => {
    initialServer = 'us';
    btnServerUs.classList.add('serving');
    btnServerThem.classList.remove('serving');
  };
  btnServerThem.onclick = () => {
    initialServer = 'them';
    btnServerThem.classList.add('serving');
    btnServerUs.classList.remove('serving');
  };

  // Synchronize Prior Sets list for Tennis
  function syncTennisPriorSets() {
    const needed = startingSet - 1;
    while (tennisPriorSets.length < needed) {
      tennisPriorSets.push({ us: 6, them: 4, isUnknown: false, winner: 'us' });
    }
    while (tennisPriorSets.length > needed) {
      tennisPriorSets.pop();
    }
    renderTennisPriorSetsList();
  }

  function renderTennisPriorSetsList() {
    if (!tennisPriorSetsList) return;
    tennisPriorSetsList.innerHTML = tennisPriorSets.map((s, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); border-radius: 8px; padding: 6px 10px; border: 1px solid var(--border-subtle);">
        <span style="font-size: 13px; font-weight: 700;">Set ${idx + 1}:</span>
        ${s.isUnknown ? `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="format-choice-chip ${s.winner === 'us' ? 'active' : ''}" data-idx="${idx}" data-action="toggle-winner" type="button" style="padding: 4px 8px; font-size: 11px;">
              Winner: ${s.winner === 'us' ? 'US' : 'Opponent'}
            </button>
            <button class="tennis-unknown-btn active" data-idx="${idx}" data-action="toggle-unknown" type="button" title="Set score unknown (?)" style="padding: 4px 8px; font-size: 11px;">
              ? Unknown
            </button>
          </div>
        ` : `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: 6px; overflow: hidden;">
              <button class="tennis-stepper-btn" data-idx="${idx}" data-team="us" data-dir="-1" type="button" style="padding: 2px 7px;">–</button>
              <span class="tabular-nums" style="padding: 2px 8px; font-weight: 700; font-size: 13px;">${s.us}</span>
              <button class="tennis-stepper-btn" data-idx="${idx}" data-team="us" data-dir="1" type="button" style="padding: 2px 7px;">+</button>
            </div>
            <span style="color: var(--text-tertiary);">-</span>
            <div style="display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: 6px; overflow: hidden;">
              <button class="tennis-stepper-btn" data-idx="${idx}" data-team="them" data-dir="-1" type="button" style="padding: 2px 7px;">–</button>
              <span class="tabular-nums" style="padding: 2px 8px; font-weight: 700; font-size: 13px;">${s.them}</span>
              <button class="tennis-stepper-btn" data-idx="${idx}" data-team="them" data-dir="1" type="button" style="padding: 2px 7px;">+</button>
            </div>
            <button class="tennis-unknown-btn" data-idx="${idx}" data-action="toggle-unknown" type="button" title="Mark score as unknown (?)" style="padding: 4px 8px; font-size: 11px;">
              ?
            </button>
          </div>
        `}
      </div>
    `).join('');

    // Wire up prior sets list steppers and toggles
    tennisPriorSetsList.querySelectorAll('[data-team]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const team = btn.dataset.team;
        const dir = Number(btn.dataset.dir);
        if (tennisPriorSets[idx]) {
          tennisPriorSets[idx][team] = Math.max(0, Math.min(20, tennisPriorSets[idx][team] + dir));
          renderTennisPriorSetsList();
        }
      };
    });

    tennisPriorSetsList.querySelectorAll('[data-action="toggle-unknown"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (tennisPriorSets[idx]) {
          tennisPriorSets[idx].isUnknown = !tennisPriorSets[idx].isUnknown;
          renderTennisPriorSetsList();
        }
      };
    });

    tennisPriorSetsList.querySelectorAll('[data-action="toggle-winner"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (tennisPriorSets[idx]) {
          tennisPriorSets[idx].winner = tennisPriorSets[idx].winner === 'us' ? 'them' : 'us';
          renderTennisPriorSetsList();
        }
      };
    });
  }

  function updateSetUI() {
    txtStartingSet.textContent = startingSet;
    if (startingSet > 1) {
      txtSetHint.textContent = `Arrived late at Set ${startingSet}`;
      if (currentSport === 'volleyball') {
        volleyballSetsWonRow.style.display = 'block';
        tennisPriorSetsRow.style.display = 'none';
      } else {
        volleyballSetsWonRow.style.display = 'none';
        tennisPriorSetsRow.style.display = 'block';
        syncTennisPriorSets();
      }
    } else {
      volleyballSetsWonRow.style.display = 'none';
      tennisPriorSetsRow.style.display = 'none';
      txtSetHint.textContent = 'First set of match';
      setsUs = 0;
      setsThem = 0;
      txtSetsUs.textContent = '0';
      txtSetsThem.textContent = '0';
      tennisPriorSets = [];
    }
  }

  btnIncSet.onclick = () => {
    if (startingSet < 5) {
      startingSet++;
      updateSetUI();
    }
  };

  btnDecSet.onclick = () => {
    if (startingSet > 1) {
      startingSet--;
      updateSetUI();
    }
  };

  btnIncUsSets.onclick = () => {
    if (setsUs < 3) {
      setsUs++;
      txtSetsUs.textContent = setsUs;
    }
  };

  btnDecUsSets.onclick = () => {
    if (setsUs > 0) {
      setsUs--;
      txtSetsUs.textContent = setsUs;
    }
  };

  btnIncThemSets.onclick = () => {
    if (setsThem < 3) {
      setsThem++;
      txtSetsThem.textContent = setsThem;
    }
  };

  btnDecThemSets.onclick = () => {
    if (setsThem > 0) {
      setsThem--;
      txtSetsThem.textContent = setsThem;
    }
  };

  btnCancel.onclick = () => modal.remove();

  const startNew = () => {
    try {
      const opponent = inputOpponent.value.trim() || 'Opponent';

      // Calculate final setsUs and setsThem
      let finalSetsUs = setsUs;
      let finalSetsThem = setsThem;
      let finalSetScores = [];

      if (currentSport === 'tennis' && startingSet > 1) {
        finalSetsUs = 0;
        finalSetsThem = 0;
        finalSetScores = (tennisPriorSets || []).map((s, idx) => {
          const isUnknown = !!s.isUnknown;
          const winner = isUnknown ? s.winner : (s.us > s.them ? 'us' : 'them');
          if (winner === 'us') finalSetsUs++;
          else finalSetsThem++;
          return {
            setNumber: idx + 1,
            us: isUnknown ? '?' : s.us,
            them: isUnknown ? '?' : s.them,
            score: isUnknown ? '?' : `${s.us}-${s.them}`,
            isUnknown,
            winner
          };
        });
      }

      store.startBroadcast(opponent, {
        sport: currentSport,
        startingSet,
        setsUs: finalSetsUs,
        setsThem: finalSetsThem,
        tennisScoringType,
        currentSetFormat,
        server: initialServer,
        setScores: finalSetScores,
        ringBufferDuration: currentSport === 'tennis' ? 30 : 20
      });
    } catch (err) {
      console.error('Error starting broadcast:', err);
    } finally {
      modal.remove();
      navigate('/stream');
    }
  };

  btnConfirm.onclick = startNew;
  inputOpponent.onkeydown = (e) => {
    if (e.key === 'Enter') startNew();
  };
  inputOpponent.focus();
}

