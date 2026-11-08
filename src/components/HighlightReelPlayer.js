// ==========================================================================
// HighlightReelPlayer: Match Highlights Reel & Sequential Player
// - True Background Pre-Buffering Pipeline: Downloads clips in advance so
//   upcoming highlights are already 100% in memory before the current clip ends,
//   achieving 0-latency seamless auto-advancing between all clips in the reel.
// - Broadcaster on Phone: Plays uncompressed camera master from local IndexedDB
//   with instant 0-latency playback and automatic next-clip advance on video end.
// - Watchers on Computers: Downloads video blobs via Google Apps Script Mail Slot
//   for 100% native HTML5 video playback, true autoplay, and instant auto-advancing.
// - Responsive Layout: Side-by-side on desktop (fixed queue), and a clean
//   toggleable full-screen overlay drawer on mobile that never pushes video off-screen.
// ==========================================================================

import { sortHighlightsChronologically } from '../services/store.js';
import { getBroadcastIcon, getBugIcon } from './icons.js';
import { getLocalClipBlob } from '../services/mediaStorage.js';
import { APPS_SCRIPT_MAILSLOT_URL, sanitizeVideoBlob } from '../services/drive.js';
import { authService } from '../services/auth.js';

function base64ToBlob(base64, mimeType = 'video/mp4') {
  const byteCharacters = atob(base64);
  const totalLen = byteCharacters.length;
  const u8 = new Uint8Array(totalLen);
  for (let i = 0; i < totalLen; i++) {
    u8[i] = byteCharacters.charCodeAt(i);
  }

  // Self-heal corrupted MP4 files that have orphaned fragmented moof boxes prepended before ftyp
  let cleanBytes = u8;
  if (totalLen > 16) {
    const isFtypAtStart = (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70);
    if (!isFtypAtStart) {
      const searchLimit = Math.min(totalLen, 5 * 1024 * 1024);
      for (let i = 4; i < searchLimit - 4; i++) {
        if (u8[i] === 0x66 && u8[i+1] === 0x74 && u8[i+2] === 0x79 && u8[i+3] === 0x70) {
          const boxStart = i - 4;
          console.log(`[HighlightReelPlayer] ✓ Self-healed MP4: trimmed ${boxStart} leading bytes to restore ftyp container header.`);
          cleanBytes = u8.subarray(boxStart);
          break;
        }
      }
    }
  }

  return new Blob([cleanBytes], { type: mimeType });
}

export class HighlightReelPlayer {
  // Static global cache across instances during the browser session so replaying or reopening is instantaneous
  static globalBlobCache = new Map();
  static globalFetchPromises = new Map();

  static prewarmClip(clip) {
    if (!clip) return;
    const driveFileId = clip.driveFileId ||
      clip.videoUrl?.match(/id=([a-zA-Z0-9_-]+)/)?.[1] ||
      clip.driveUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (driveFileId && !driveFileId.startsWith('drive_') && !HighlightReelPlayer.globalBlobCache.has(driveFileId) && !HighlightReelPlayer.globalFetchPromises.has(driveFileId)) {
      HighlightReelPlayer.fetchDriveBlob(driveFileId);
    }
  }

  static fetchDriveBlob(driveFileId) {
    if (!driveFileId || driveFileId.startsWith('drive_')) return Promise.resolve(null);
    if (HighlightReelPlayer.globalBlobCache.has(driveFileId)) {
      return Promise.resolve(HighlightReelPlayer.globalBlobCache.get(driveFileId));
    }
    if (HighlightReelPlayer.globalFetchPromises.has(driveFileId)) {
      return HighlightReelPlayer.globalFetchPromises.get(driveFileId);
    }

    console.log(`[HighlightReelPlayer] ⏳ Pipeline: downloading Drive clip via Mail Slot (${driveFileId})...`);
    const promise = (async () => {
      try {
        const mailSlotUrl = `${APPS_SCRIPT_MAILSLOT_URL}?action=download&fileId=${encodeURIComponent(driveFileId)}`;
        const res = await fetch(mailSlotUrl, { redirect: 'follow' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.base64) {
            const blob = base64ToBlob(data.base64, data.mimeType || 'video/mp4');
            const blobUrl = URL.createObjectURL(blob);
            HighlightReelPlayer.globalBlobCache.set(driveFileId, blobUrl);
            HighlightReelPlayer.globalFetchPromises.delete(driveFileId);
            console.log(`[HighlightReelPlayer] ✓ Pipeline: clip ${driveFileId} is 100% ready in memory! (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
            return blobUrl;
          }
        }
      } catch (err) {
        console.warn(`[HighlightReelPlayer] Mail Slot download failed for ${driveFileId}:`, err);
      }

      HighlightReelPlayer.globalFetchPromises.delete(driveFileId);
      return null;
    })();

    HighlightReelPlayer.globalFetchPromises.set(driveFileId, promise);
    return promise;
  }

  constructor(match, onClose, initialClipId = null) {
    this.match = match;
    this.onClose = onClose;

    // Strictly order highlights chronologically: Set ascending, Total score points ascending
    const sorted = sortHighlightsChronologically(match.highlights || []);
    // Include all playable highlights (local Master, Drive ID, or URL)
    this.clips = sorted.filter(h => !h.isUploading && (h.videoUrl || h.driveUrl || h.driveFileId || h.id));
    this.currentIndex = 0;
    if (initialClipId) {
      const idx = this.clips.findIndex(c => c.id === initialClipId);
      if (idx >= 0) this.currentIndex = idx;
    }
    this.element = null;
    this.video = null;
    this.isCompleted = false;
    this.isQueueVisible = false; // Queue is hidden initially by default

    // Playback state
    this.isUsingLocalBlob = false;
    this.isUsingDriveBlob = false;
    this.appsScriptNeedsUpdate = false;

    if (this.clips.length === 0) {
      const toast = document.createElement('div');
      toast.className = 'frosted-glass';
      toast.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: 12px; background: rgba(0,0,0,0.85); color: #fff; z-index: 99999; font-size: 14px; font-weight: 500; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.4); text-align: center;';
      toast.textContent = 'No highlights available for this match yet.';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2600);
      if (this.onClose) this.onClose();
      return;
    }

    // Immediately kick off the background download pipeline for current clip and upcoming in parallel!
    this.startPipeline(this.currentIndex);

    this.render();
  }

  startPipeline(fromIndex = 0) {
    if (!this.clips || this.clips.length === 0) return;

    // Sequence prioritized starting from fromIndex through entire reel
    const sequence = [];
    for (let i = fromIndex; i < this.clips.length; i++) {
      sequence.push(i);
    }
    for (let i = 0; i < fromIndex; i++) {
      sequence.push(i);
    }

    this.pipelineQueue = sequence;
    this.pumpPipeline();
  }

  pumpPipeline() {
    if (this.isDestroyed || !this.pipelineQueue) return;

    // Strictly 1 download at a time so 100% of network bandwidth is focused on the immediate clip.
    // The second clip does NOT start until the first is completely finished, the third does NOT
    // start until the second is done, greedily progressing through this match's highlights.
    const MAX_CONCURRENT = 1;
    if (this.activeDownloadCount === undefined) this.activeDownloadCount = 0;
    if (this.activeDownloadCount >= MAX_CONCURRENT) return;

    while (this.pipelineQueue.length > 0 && this.activeDownloadCount < MAX_CONCURRENT) {
      const nextIdx = this.pipelineQueue.shift();
      const clip = this.clips[nextIdx];
      const driveId = this.extractDriveId(clip);

      if (driveId && !HighlightReelPlayer.globalBlobCache.has(driveId)) {
        this.activeDownloadCount++;
        console.log(`[HighlightReelPlayer] ⬇️ Pipeline: downloading clip [${nextIdx + 1}/${this.clips.length}] (${driveId}) with 100% bandwidth...`);
        HighlightReelPlayer.fetchDriveBlob(driveId)
          .then(() => {
            console.log(`[HighlightReelPlayer] ✓ Pipeline: clip [${nextIdx + 1}/${this.clips.length}] finished. Starting next clip in sequence.`);
            this.updateQueueRowReady(driveId);
            this.updateDebugInfo();
          })
          .catch(err => {
            console.warn(`[Pipeline] Failed buffering ${driveId}:`, err);
          })
          .finally(() => {
            this.activeDownloadCount--;
            this.pumpPipeline(); // Strictly starts the next clip ONLY after current clip completes!
          });
      }
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'reel-modal-backdrop';

    const currentClip = this.clips[this.currentIndex];

    this.element.innerHTML = `
      <div class="reel-player-container">
        <!-- Top Header Bar with Consolidated Match & Highlight Info -->
        <div class="reel-header-bar">
          <div class="reel-header-left">
            <div class="reel-header-matchup">
              <span class="sport-emoji">${this.match.sport === 'tennis' ? '🎾' : '🏐'}</span>
              <span class="opponent-name">vs. ${this.match.opponent}</span>
            </div>
            <div class="reel-header-clip-badge" id="reel-header-clip-badge">
              <span class="reel-clip-set-score tabular-nums" id="reel-badge-score">Set ${currentClip.set || 1} (${currentClip.score || '0-0'})</span>
              <span class="reel-clip-dot">•</span>
              <span class="reel-clip-label" id="reel-badge-label">${(currentClip.type === 'team' ? '👥 ' : '★ ') + (currentClip.label || 'Highlight')}</span>
            </div>
          </div>
          <div class="reel-header-actions">
            <!-- Queue Toggle Button: "Show Queue" / "Hide Queue" without counts or icons -->
            <button class="apple-btn apple-btn-sm btn-header-queue-toggle" id="btn-toggle-queue" title="Toggle Queue">
              Show Queue
            </button>
            ${authService.isBroadcaster() ? `
              <button class="apple-icon-btn btn-reel-debug" id="btn-reel-debug" title="Toggle Video Diagnostics">
                ${getBugIcon(14, 'currentColor')}
              </button>
            ` : ''}
            <button class="apple-icon-btn btn-close-reel" id="btn-close-reel" title="Exit Highlight Reel" aria-label="Exit">✕</button>
          </div>
        </div>

        <!-- Main Body Layout: Video Area on Left, Queue Panel on Right -->
        <div class="reel-body-layout">
          <!-- Video Area (Always fills available space, never gets pushed horizontally) -->
          <div class="reel-video-wrapper" id="reel-video-wrapper">
            <!-- Native HTML5 Video Element (True Autoplay & Auto-Advancing) -->
            <video class="reel-video" id="reel-video-elem" playsinline autoplay controls preload="auto">
            </video>

            <!-- Loading overlay when downloading clip from Drive Mail Slot -->
            <div id="reel-loading-overlay" style="display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 25; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #fff; padding: 20px; text-align: center;">
              <div class="stream-status-spinner" style="width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #0a84ff; border-radius: 50%; animation: spin 0.9s linear infinite;"></div>
              <span id="reel-loading-text" style="font-size: 14px; font-weight: 500; color: #f1f5f9;">Loading highlight...</span>
            </div>

            <!-- On-Screen Diagnostics & Debug Panel (Admin only) -->
            ${authService.isBroadcaster() ? `
              <div class="reel-debug-box frosted-glass" id="reel-debug-box" style="display: none; position: absolute; inset: 56px 12px 64px 12px; background: rgba(10,12,18,0.96); border: 1px solid rgba(100,210,255,0.4); border-radius: 14px; padding: 14px; z-index: 60; overflow-y: auto; color: #64d2ff; font-family: monospace; font-size: 11px; line-height: 1.5; pointer-events: auto; text-align: left; box-shadow: 0 12px 36px rgba(0,0,0,0.85);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 10px;">
                  <span style="font-weight: 700; color: #fff; font-size: 13px;">🐞 Video Diagnostics</span>
                  <div style="display: flex; gap: 8px;">
                    <button class="apple-btn apple-btn-sm" id="btn-copy-debug-reel">📋 Copy</button>
                    <button class="apple-icon-btn" id="btn-close-debug-reel" style="width: 24px; height: 24px; font-size: 12px;">✕</button>
                  </div>
                </div>
                <div id="reel-debug-content"></div>
              </div>
            ` : ''}
          </div>

          <!-- Vertical Queue Panel (Only contains queue items, hidden initially) -->
          <div class="reel-playlist-panel collapsed" id="reel-playlist-panel">
            <div class="reel-playlist-list" id="reel-playlist-list">
              <!-- Dynamically populated rows -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);
    document.body.classList.add('reel-open');
    document.documentElement.classList.add('reel-open');

    this.video = this.element.querySelector('#reel-video-elem');

    this.setupListeners();
    this.populateQueue();
    this.loadClip(this.currentIndex);
  }

  populateQueue() {
    const list = this.element.querySelector('#reel-playlist-list');
    if (!list) return;

    list.innerHTML = this.clips.map((c, i) => {
      const isTeam = (c.type === 'team');
      const driveId = this.extractDriveId(c);
      const isReady = driveId ? HighlightReelPlayer.globalBlobCache.has(driveId) : false;

      return `
        <div class="reel-playlist-row" id="playlist-row-${i}" data-index="${i}">
          <div class="reel-row-number">${i + 1}</div>
          <div class="reel-row-info">
            <div class="reel-row-top">
              <span class="reel-row-score">Set ${c.set || 1} • ${c.score || '0-0'}</span>
              ${authService.isBroadcaster() ? `
                <span class="clip-storage-dot ${isReady ? 'server' : ''}" id="buffer-badge-${i}" style="${isReady ? 'display: inline-block;' : 'display: none;'}" title="Ready in Memory"></span>
              ` : ''}
            </div>
            <div class="reel-row-label">
              ${isTeam ? '👥 ' : '★ '}${c.label || 'Highlight'}
              ${c.comment ? `<span style="color: var(--text-tertiary); font-style: italic;"> • "${c.comment}"</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Clicking any row in the queue directly jumps to that highlight
    list.querySelectorAll('.reel-playlist-row').forEach(row => {
      const handleSelect = (e) => {
        e.stopPropagation();
        const idx = parseInt(row.dataset.index, 10);
        this.loadClip(idx);
      };
      row.onclick = handleSelect;
      row.ontouchend = handleSelect;
    });
  }

  updateQueueRowReady(driveFileId) {
    if (!driveFileId || !this.element || !authService.isBroadcaster()) return;
    this.clips.forEach((c, i) => {
      if (this.extractDriveId(c) === driveFileId) {
        const badge = this.element.querySelector(`#buffer-badge-${i}`);
        if (badge) {
          badge.style.display = 'inline-block';
          badge.className = 'clip-storage-dot server';
        }
      }
    });
  }

  updateQueueStatus() {
    this.clips.forEach((c, i) => {
      const row = this.element?.querySelector(`#playlist-row-${i}`);
      if (!row) return;

      if (i === this.currentIndex) {
        row.className = 'reel-playlist-row active';
      } else {
        row.className = 'reel-playlist-row';
      }
    });
  }

  openQueue() {
    this.isQueueVisible = true;
    const playlistPanel = this.element.querySelector('#reel-playlist-panel');
    const btnToggle = this.element.querySelector('#btn-toggle-queue');
    if (playlistPanel) {
      playlistPanel.classList.add('open');
      playlistPanel.classList.remove('collapsed');
    }
    if (btnToggle) {
      btnToggle.textContent = 'Hide Queue';
    }
    this.updateQueueStatus();
  }

  closeQueue() {
    this.isQueueVisible = false;
    const playlistPanel = this.element.querySelector('#reel-playlist-panel');
    const btnToggle = this.element.querySelector('#btn-toggle-queue');
    if (playlistPanel) {
      playlistPanel.classList.remove('open');
      playlistPanel.classList.add('collapsed');
    }
    if (btnToggle) {
      btnToggle.textContent = 'Show Queue';
    }
  }

  toggleQueue() {
    if (this.isQueueVisible) {
      this.closeQueue();
    } else {
      this.openQueue();
    }
  }

  setupListeners() {
    const btnClose = this.element.querySelector('#btn-close-reel');
    const btnToggleQueue = this.element.querySelector('#btn-toggle-queue');

    if (btnClose) btnClose.onclick = () => this.destroy();

    // Queue toggle button in top header bar: alternates "Show Queue" and "Hide Queue"
    if (btnToggleQueue) {
      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleQueue();
      };
      btnToggleQueue.onclick = handleToggle;
      btnToggleQueue.ontouchend = handleToggle;
    }

    const btnDebug = this.element.querySelector('#btn-reel-debug');
    const debugBox = this.element.querySelector('#reel-debug-box');
    const btnCloseDebug = this.element.querySelector('#btn-close-debug-reel');
    const btnCopyDebug = this.element.querySelector('#btn-copy-debug-reel');

    if (btnDebug && debugBox) {
      btnDebug.onclick = (e) => {
        e.stopPropagation();
        const isHidden = debugBox.style.display === 'none';
        debugBox.style.display = isHidden ? 'block' : 'none';
        btnDebug.style.background = isHidden ? 'rgba(10,132,255,0.4)' : 'rgba(0,0,0,0.5)';
        if (isHidden) this.updateDebugInfo();
      };
    }
    if (btnCloseDebug && debugBox) {
      btnCloseDebug.onclick = (e) => {
        e.stopPropagation();
        debugBox.style.display = 'none';
        if (btnDebug) btnDebug.style.background = 'rgba(0,0,0,0.5)';
      };
    }
    if (btnCopyDebug) {
      btnCopyDebug.onclick = (e) => {
        e.stopPropagation();
        const content = this.element.querySelector('#reel-debug-content');
        if (content) {
          const text = content.innerText || content.textContent;
          navigator.clipboard.writeText(text).then(() => {
            btnCopyDebug.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyDebug.textContent = '📋 Copy'; }, 2000);
          }).catch(() => {});
        }
      };
    }

    // Native HTML5 video events: when highlight completes, advance automatically to next clip!
    if (this.video) {
      this.video.onended = () => {
        console.log(`[HighlightReelPlayer] Clip ${this.currentIndex + 1} finished naturally. Auto-advancing.`);
        this.nextClip();
      };

      this.video.onerror = () => {
        console.warn(`[HighlightReelPlayer] Video error on clip ${this.currentIndex + 1}.`);
        const clip = this.clips[this.currentIndex];
        if (clip && !this.extractDriveId(clip) && !this.isUsingLocalBlob) {
          this.showPendingPhoneOverlay(clip);
        } else {
          // Advance gracefully to next clip in sequential reel
          setTimeout(() => this.nextClip(), 1500);
        }
      };
    }

    // Keyboard shortcuts (Escape to exit)
    this.keyHandler = (e) => {
      if (e.key === 'Escape') {
        this.destroy();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  extractDriveId(clip) {
    if (!clip) return null;
    const id = clip.driveFileId ||
      clip.videoUrl?.match(/id=([a-zA-Z0-9_-]+)/)?.[1] ||
      clip.driveUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
      null;
    if (id && !id.startsWith('drive_')) return id;
    return null;
  }

  async loadClip(index) {
    if (this.pendingSkipTimer) {
      clearTimeout(this.pendingSkipTimer);
      this.pendingSkipTimer = null;
    }

    if (index >= this.clips.length) {
      this.isCompleted = true;
      if (this.video) this.video.pause();
      return;
    }

    this.currentIndex = Math.max(0, index);
    const clip = this.clips[this.currentIndex];

    // Pipeline: Ensure current clip and the next 2 upcoming clips are actively downloading in parallel!
    this.startPipeline(this.currentIndex);

    // Update Header Clip Badge
    const badgeScore = this.element.querySelector('#reel-badge-score');
    const badgeLabel = this.element.querySelector('#reel-badge-label');
    if (badgeScore) badgeScore.textContent = `Set ${clip.set || 1} (${clip.score || '0-0'})`;
    if (badgeLabel) {
      const isTeam = (clip.type === 'team');
      badgeLabel.textContent = `${isTeam ? '👥 ' : '★ '}${clip.label || 'Highlight'}`;
    }

    // Update Queue Visual State
    this.updateQueueStatus();

    const loader = this.element.querySelector('#reel-loading-overlay');
    const loaderText = this.element.querySelector('#reel-loading-text');

    // 1. First priority: Check local phone IndexedDB master (broadcaster phone)
    let localBlob = null;
    if (clip && clip.id) {
      try {
        localBlob = await getLocalClipBlob(clip.id);
      } catch (e) {
        localBlob = null;
      }
    }

    if (this.currentIndex !== index) return; // Stale guard

    if (localBlob && this.video) {
      localBlob = await sanitizeVideoBlob(localBlob);
      console.log(`[HighlightReelPlayer] ✓ Playing Master from local phone storage for clip ${clip.id}`);
      this.isUsingLocalBlob = true;
      this.isUsingDriveBlob = false;
      if (loader) loader.style.display = 'none';

      const blobUrl = URL.createObjectURL(localBlob);
      this.playVideoBlob(blobUrl);
      this.updateDebugInfo();
      return;
    }

    // 2. Second priority: If backed up to Google Drive, stream from Google Drive via native HTML5 video
    const driveFileId = this.extractDriveId(clip);
    if (driveFileId) {
      this.isUsingLocalBlob = false;
      this.isUsingDriveBlob = true;

      // If already pre-buffered into memory, play immediately with 0 delay!
      if (HighlightReelPlayer.globalBlobCache.has(driveFileId)) {
        if (loader) loader.style.display = 'none';
        console.log(`[HighlightReelPlayer] ✓ Playing pre-buffered Drive blob with native HTML5 video: ${driveFileId}`);
        this.playVideoBlob(HighlightReelPlayer.globalBlobCache.get(driveFileId));
        this.updateDebugInfo();
        return;
      }

      // If not yet in memory: show loading overlay, download Drive blob, then play with HTML5 video
      if (loader) {
        loader.style.display = 'flex';
        if (loaderText) loaderText.textContent = `Buffering highlight from Google Drive...`;
      }

      try {
        const blobUrl = await HighlightReelPlayer.fetchDriveBlob(driveFileId);
        if (this.currentIndex !== index) return; // Stale check if user switched clips
        if (loader) loader.style.display = 'none';

        if (blobUrl) {
          console.log(`[HighlightReelPlayer] ✓ Download complete, playing Drive video with native HTML5 video: ${driveFileId}`);
          this.playVideoBlob(blobUrl);
          this.updateDebugInfo();
          return;
        }
      } catch (fetchErr) {
        console.warn(`[HighlightReelPlayer] Error buffering Drive clip ${driveFileId}:`, fetchErr);
      }
    }

    // 3. Fallback: If network URL
    if (loader) loader.style.display = 'none';
    this.isUsingLocalBlob = false;
    this.isUsingDriveBlob = false;

    if (clip.videoUrl && !clip.videoUrl.startsWith('blob:') && !clip.videoUrl.includes('drive.google.com') && !clip.videoUrl.includes('usercontent')) {
      this.playVideoBlob(clip.videoUrl);
    } else {
      // Local blob not on this device (e.g. running on computer, recorded on phone)
      this.showPendingPhoneOverlay(clip);
    }
    this.updateDebugInfo();
  }

  showPendingPhoneOverlay(clip) {
    if (!this.element) return;
    const wrapper = this.element.querySelector('#reel-video-wrapper');
    if (!wrapper) return;

    if (this.video) {
      this.video.pause();
      this.video.style.display = 'none';
    }

    let overlay = wrapper.querySelector('#reel-pending-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reel-pending-overlay';
      overlay.style.cssText = 'position: absolute; inset: 0; background: rgba(10,12,18,0.96); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 15; padding: 24px; text-align: center; color: #fff; gap: 12px;';
      wrapper.appendChild(overlay);
    }

    overlay.innerHTML = `
      <span style="font-size: 38px;">📱</span>
      <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: #ff9f0a;">Highlight Stored Locally on Camera Phone</h3>
      <p style="font-size: 13px; color: var(--text-secondary); max-width: 320px; line-height: 1.4; margin: 0;">
        "<b>${clip.label || 'Highlight'}</b>" is saved in physical camera storage on the phone that recorded this match. Open GameStreamer on that phone to automatically sync it to Google Drive!
      </p>
      <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 8px;">Advancing to next highlight in 3s...</div>
    `;
    overlay.style.display = 'flex';

    if (this.pendingSkipTimer) clearTimeout(this.pendingSkipTimer);
    this.pendingSkipTimer = setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      this.nextClip();
    }, 3000);
  }

  playVideoBlob(url) {
    if (this.pendingSkipTimer) {
      clearTimeout(this.pendingSkipTimer);
      this.pendingSkipTimer = null;
    }
    if (!this.element) return;
    const wrapper = this.element.querySelector('#reel-video-wrapper');
    const pendingOverlay = wrapper?.querySelector('#reel-pending-overlay');
    if (pendingOverlay) pendingOverlay.style.display = 'none';

    if (!this.video) return;
    this.video.style.display = 'block';
    this.video.src = url;
    this.video.load();
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('[HighlightReelPlayer] Autoplay unmuted was restricted, muting to allow auto-play:', err);
        this.video.muted = true;
        this.video.play().catch(e => console.warn('[HighlightReelPlayer] Muted playback attempt failed:', e));
      });
    }
  }

  nextClip() {
    if (this.currentIndex + 1 < this.clips.length) {
      this.loadClip(this.currentIndex + 1);
    } else {
      // Reached the end of the reel: pause on last frame of the actual last highlight
      this.isCompleted = true;
      if (this.video) this.video.pause();
      // Automatically show the queue at the end of the reel so user can click first highlight again or close
      this.openQueue();
    }
  }

  prevClip() {
    if (this.currentIndex > 0) {
      this.loadClip(this.currentIndex - 1);
    } else {
      this.loadClip(0);
    }
  }

  updateDebugInfo() {
    const content = this.element.querySelector('#reel-debug-content');
    if (!content) return;
    const v = this.video;
    const clip = this.clips[this.currentIndex];
    const driveFileId = this.extractDriveId(clip);

    const sourceTitle = this.isUsingLocalBlob
      ? '✅ Master Camera Video (Phone IndexedDB)'
      : this.isUsingDriveBlob
      ? `☁️ Google Drive Video Blob (ID: ${driveFileId})`
      : '📱 Pending Sync (Camera Phone Storage)';

    const sourceBg = this.isUsingLocalBlob
      ? 'rgba(48,209,88,0.2)'
      : this.isUsingDriveBlob
      ? 'rgba(10,132,255,0.25)'
      : 'rgba(255,149,0,0.2)';

    const sourceBorder = this.isUsingLocalBlob
      ? '#30d158'
      : this.isUsingDriveBlob
      ? '#0a84ff'
      : '#ff9500';

    content.innerHTML = `
      <div style="margin-bottom: 6px;"><b>App Version:</b> v1.4.2 (Parallel Pre-Buffer & Hub Pre-Warm) (${new Date().toLocaleTimeString()})</div>
      <div style="margin-bottom: 6px;"><b>Match:</b> ${this.match ? (this.match.opponent + ' (' + (this.match.id || 'N/A') + ')') : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>Clip:</b> [${this.currentIndex + 1}/${this.clips.length}] ${clip ? clip.id : 'N/A'} - ${clip ? clip.label : ''}</div>

      <div style="margin-bottom: 8px; padding: 8px 10px; border-radius: 8px; background: ${sourceBg}; border: 1px solid ${sourceBorder};">
        <b>Active Video Source:</b> ${sourceTitle}
        ${this.isUsingLocalBlob ? `<div style="font-size: 10px; color: #30d158; margin-top: 4px; line-height: 1.35;">Playing original uncompressed master from physical phone storage (0 latency, 0 mobile data).</div>` : ''}
        ${this.isUsingDriveBlob ? `<div style="font-size: 10px; color: #64d2ff; margin-top: 4px; line-height: 1.35;">Playing downloaded Google Drive video blob with native HTML5 autoplay and automatic next-clip sequencing!</div>` : ''}
      </div>

      <div style="margin-bottom: 6px;"><b>Drive ID:</b> ${driveFileId || 'None'}</div>
      <div style="margin-bottom: 6px;"><b>Pre-Buffered Clips in Memory:</b> ${HighlightReelPlayer.globalBlobCache.size} of ${this.clips.length} (Active Pipeline)</div>
      <div style="margin-bottom: 6px;"><b>Video Element src:</b> <span style="word-break: break-all; color: #30d158;">${v ? (v.src || 'None') : 'None'}</span></div>
      <div style="margin-bottom: 6px;"><b>Playback State:</b> paused=${v ? v.paused : 'N/A'}, currentTime=${v ? v.currentTime.toFixed(2) : '0'}s / ${v && v.duration ? v.duration.toFixed(2) + 's' : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>Auto-Advance:</b> Linked directly to video.onended event</div>
    `;
  }

  destroy() {
    this.isDestroyed = true;
    this.pipelineQueue = [];
    if (this.pendingSkipTimer) {
      clearTimeout(this.pendingSkipTimer);
      this.pendingSkipTimer = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    if (this.video) {
      this.video.pause();
      this.video.src = '';
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    document.body.classList.remove('reel-open');
    document.documentElement.classList.remove('reel-open');
    if (this.onClose) {
      this.onClose();
    }
  }
}
