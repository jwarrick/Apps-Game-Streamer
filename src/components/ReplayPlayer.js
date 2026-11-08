import { shareHighlightVideo } from '../services/share.js';
import { getLocalClipBlob } from '../services/mediaStorage.js';
import { HighlightReelPlayer } from './HighlightReelPlayer.js';
import { authService } from '../services/auth.js';
import { sanitizeVideoBlob } from '../services/drive.js';

const PLAY_ICON = `
  <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" style="margin-left: 2px;">
    <path d="M12.8 7.1C13.4 7.5 13.4 8.5 12.8 8.9L1.8 15.3C1.1 15.7 0.2 15.2 0.2 14.4L0.2 1.6C0.2 0.8 1.1 0.3 1.8 0.7L12.8 7.1Z" />
  </svg>
`;

const PAUSE_ICON = `
  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
    <rect width="3.5" height="14" rx="1.75" />
    <rect x="7.5" width="3.5" height="14" rx="1.75" />
  </svg>
`;

export class ReplayPlayer {
  constructor(clip, onClose) {
    this.clip = clip;
    this.onClose = onClose;
    this.currentSpeed = 1.0;
    this.isPlaying = true;
    this.element = null;
    this.video = null;
    this.handleKeyDown = null;
    this.isUsingLocalBlob = false;
    this.isUsingDriveBlob = false;
    this.isUsingSampleFallback = false;
    const rawDriveId = (clip && clip.driveFileId) ||
      (clip && clip.videoUrl?.match(/id=([a-zA-Z0-9_-]+)/)?.[1]) ||
      (clip && clip.driveUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]) || null;
    this.driveFileId = (rawDriveId && !rawDriveId.startsWith('drive_')) ? rawDriveId : null;
    this.render();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'replay-modal-backdrop';

    const isBroadcaster = authService.isBroadcaster();

    this.element.innerHTML = `
      <div class="replay-modal">
        <div class="replay-video-box" id="replay-video-box">
          <!-- Native HTML5 Video Element ONLY (Never an iframe) -->
          <video class="replay-video" id="replay-video-elem" playsinline autoplay loop preload="auto">
          </video>

          <!-- Buffering spinner overlay for Drive downloads -->
          <div id="replay-loading-overlay" style="display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 25; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #fff;">
            <div class="stream-status-spinner" style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #0a84ff; border-radius: 50%; animation: spin 0.9s linear infinite;"></div>
            <span id="replay-loading-text" style="font-size: 13px; font-weight: 500; color: #f1f5f9;">Buffering highlight from Google Drive...</span>
          </div>

          <!-- Stored on Camera Phone overlay (When clip is only in phone storage) -->
          <div class="replay-error-msg" id="replay-error-msg" style="display: none; position: absolute; inset: 0; align-items: center; justify-content: center; flex-direction: column; background: rgba(10,12,18,0.96); color: #fff; padding: 24px; text-align: center; z-index: 20; gap: 8px;">
            <span style="font-size: 38px; margin-bottom: 4px;">📱</span>
            <div id="replay-error-title" style="font-size: 16px; font-weight: 700; color: #ff9f0a;">Stored on Camera Phone</div>
            <p id="replay-error-desc" style="font-size: 13px; color: var(--text-secondary); max-width: 300px; line-height: 1.4; margin: 0;">
              Saved in physical camera storage on the broadcaster's phone. Open GameStreamer on that phone to sync it to Google Drive.
            </p>
          </div>

          <!-- Top Overlay: Set/Score, Label, Share, and Close -->
          <div class="replay-header-overlay" id="replay-header-overlay">
            <div class="replay-header-info">
              <span class="highlight-badge frosted-glass" style="box-shadow: 0 2px 8px rgba(0,0,0,0.3);">Set ${this.clip.set} (${this.clip.score})</span>
              <span class="highlight-label frosted-glass" style="margin-left: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${this.clip.label || 'Highlight'}</span>
              ${isBroadcaster ? (
                this.clip.storageTier === 'synced' ? `
                  <span class="highlight-badge frosted-glass" style="margin-left: 6px; background: rgba(10, 132, 255, 0.25); color: #64d2ff; border: 1px solid #0a84ff;">🔵 Server + Drive</span>
                ` : (this.clip.storageTier === 'drive' || (!this.clip.videoUrl && this.driveFileId)) ? `
                  <span class="highlight-badge frosted-glass" style="margin-left: 6px; background: rgba(175, 82, 222, 0.25); color: #bf5af2; border: 1px solid #bf5af2;">📁 Drive Only</span>
                ` : `
                  <span class="highlight-badge frosted-glass" style="margin-left: 6px; background: rgba(48, 209, 88, 0.25); color: #30d158; border: 1px solid #30d158;">🟢 Camera Phone</span>
                `
              ) : ''}
            </div>
            <div class="replay-header-actions">
              ${isBroadcaster ? `
                <button class="apple-btn frosted-glass btn-replay-debug" id="btn-replay-debug" style="padding: 6px 10px; font-size: 11px; font-family: monospace; color: #64d2ff; border: 1px solid rgba(100,210,255,0.35); background: rgba(0,0,0,0.5);" title="Toggle Video Diagnostics">🐞 Debug</button>
              ` : ''}
              <button class="apple-btn frosted-glass" id="btn-download-replay" title="Share Clip (Text, AirDrop, or Save to Photos)" style="padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                <span>Share</span>
              </button>
              <button class="btn-exit-circle" id="btn-close-replay" title="Close Replay" aria-label="Close">✕</button>
            </div>
          </div>

          <!-- On-Screen Diagnostics & Debug Panel (Broadcaster only) -->
          ${isBroadcaster ? `
            <div class="replay-debug-box frosted-glass" id="replay-debug-box" style="display: none; position: absolute; inset: 56px 12px 64px 12px; background: rgba(10,12,18,0.96); border: 1px solid rgba(100,210,255,0.4); border-radius: 14px; padding: 14px; z-index: 60; overflow-y: auto; color: #64d2ff; font-family: monospace; font-size: 11px; line-height: 1.5; pointer-events: auto; text-align: left; box-shadow: 0 12px 36px rgba(0,0,0,0.85);">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 10px;">
                <span style="font-weight: 700; color: #fff; font-size: 13px;">🐞 Replay Player Diagnostics</span>
                <div style="display: flex; gap: 8px;">
                  <button class="apple-btn" id="btn-copy-debug-replay" style="padding: 3px 8px; font-size: 11px; background: rgba(10,132,255,0.3); color: #fff;">📋 Copy</button>
                  <button class="btn-exit-circle" id="btn-close-debug-replay" style="width: 22px; height: 22px; font-size: 12px;">✕</button>
                </div>
              </div>
              <div id="replay-debug-content"></div>
            </div>
          ` : ''}

          <!-- Bottom Overlaid Controls (Floating Capsule Bar - ALWAYS visible for native HTML5 controls) -->
          <div class="replay-controls-overlay" id="replay-controls-overlay">
            <div class="replay-controls-bar frosted-glass">
              <!-- Seek Back -10s -->
              <button class="apple-btn replay-seek-btn" id="btn-seek-back" title="Rewind 10 seconds">-10s</button>
              
              <!-- Play / Pause -->
              <button class="apple-btn apple-btn-primary replay-play-btn" id="btn-play-pause" title="Play or Pause">
                ${PAUSE_ICON}
              </button>
              
              <!-- Seek Forward +10s -->
              <button class="apple-btn replay-seek-btn" id="btn-seek-forward" title="Fast forward 10 seconds">+10s</button>

              <div class="replay-ctrl-divider"></div>

              <!-- Segmented Speed Toggles -->
              <div class="speed-toggle-group" id="speed-toggle-group">
                <button class="speed-btn active" data-speed="1.0">1x</button>
                <button class="speed-btn" data-speed="0.5">0.5x</button>
                <button class="speed-btn" data-speed="0.25">0.25x</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);
    document.body.classList.add('reel-open');
    document.documentElement.classList.add('reel-open');

    this.element.addEventListener('touchmove', (e) => {
      if (!e.target.closest('.replay-debug-box')) {
        e.preventDefault();
      }
    }, { passive: false });

    this.video = this.element.querySelector('#replay-video-elem');

    this.setupListeners();
    this.loadVideo();
  }

  async loadVideo() {
    const loader = this.element.querySelector('#replay-loading-overlay');
    const loaderText = this.element.querySelector('#replay-loading-text');
    const errorBox = this.element.querySelector('#replay-error-msg');
    if (errorBox) errorBox.style.display = 'none';

    // 1. Priority 1: Check local phone IndexedDB master (broadcaster phone)
    let localBlob = null;
    if (this.clip && this.clip.id) {
      try {
        localBlob = await getLocalClipBlob(this.clip.id);
      } catch (e) {
        localBlob = null;
      }
    }

    if (localBlob && this.video) {
      localBlob = await sanitizeVideoBlob(localBlob);
      console.log(`[ReplayPlayer] ✓ Playing Master from local phone IndexedDB for clip ${this.clip.id}`);
      this.isUsingLocalBlob = true;
      this.isUsingDriveBlob = false;
      this.isUsingSampleFallback = false;
      if (loader) loader.style.display = 'none';

      const localBlobUrl = URL.createObjectURL(localBlob);
      this.playVideoSource(localBlobUrl);
      this.updateDebugInfo();
      return;
    }

    // 2. Priority 2: If backed up to Google Drive, stream directly into memory via CORS fetch
    if (this.driveFileId) {
      this.isUsingLocalBlob = false;
      this.isUsingDriveBlob = true;
      this.isUsingSampleFallback = false;

      // Check if already in session blob cache
      if (HighlightReelPlayer.globalBlobCache.has(this.driveFileId)) {
        console.log(`[ReplayPlayer] ✓ Playing pre-buffered Drive video blob from memory: ${this.driveFileId}`);
        if (loader) loader.style.display = 'none';
        const cachedBlobUrl = HighlightReelPlayer.globalBlobCache.get(this.driveFileId);
        this.playVideoSource(cachedBlobUrl);
        this.updateDebugInfo();
        return;
      }

      // Download from Google Drive with buffering spinner overlay
      if (loader) {
        if (loaderText) loaderText.textContent = 'Buffering highlight from Google Drive...';
        loader.style.display = 'flex';
      }

      try {
        const blobUrl = await HighlightReelPlayer.fetchDriveBlob(this.driveFileId);
        if (loader) loader.style.display = 'none';
        if (blobUrl && this.video) {
          console.log(`[ReplayPlayer] ✓ Downloaded Drive blob successfully, playing in HTML5 video: ${this.driveFileId}`);
          this.playVideoSource(blobUrl);
          this.updateDebugInfo();
          return;
        }
      } catch (err) {
        console.warn(`[ReplayPlayer] Error fetching Drive blob for ${this.driveFileId}:`, err);
      }
    }

    // 3. Priority 3: Network URL if not local blob URL
    if (loader) loader.style.display = 'none';
    this.isUsingLocalBlob = false;
    this.isUsingDriveBlob = false;
    this.isUsingSampleFallback = false;

    if (this.clip.videoUrl && !this.clip.videoUrl.startsWith('blob:') && !this.clip.videoUrl.includes('drive.google.com') && !this.clip.videoUrl.includes('usercontent') && !this.clip.videoUrl.includes('commondatastorage.googleapis.com')) {
      this.playVideoSource(this.clip.videoUrl);
      this.updateDebugInfo();
      return;
    }

    // 4. Stored on phone only: show informative overlay
    if (errorBox) {
      const titleElem = this.element.querySelector('#replay-error-title');
      const descElem = this.element.querySelector('#replay-error-desc');
      if (titleElem) titleElem.textContent = 'Stored on Camera Phone';
      if (descElem) {
        descElem.textContent = `"${this.clip.label || 'Highlight'}" is saved in physical camera storage on the broadcaster's phone. Open GameStreamer on that phone to automatically sync it to Google Drive.`;
      }
      errorBox.style.display = 'flex';
    }
    this.updateDebugInfo();
  }

  playVideoSource(url) {
    if (!this.video) return;
    this.video.style.display = 'block';
    this.video.src = url;
    this.video.playbackRate = this.currentSpeed;
    this.video.load();
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('[ReplayPlayer] Autoplay unmuted was restricted, muting to allow auto-play:', err);
        this.video.muted = true;
        this.video.play().catch(e => console.warn('[ReplayPlayer] Muted playback attempt failed:', e));
      });
    }
  }

  setupListeners() {
    const btnClose = this.element.querySelector('#btn-close-replay');
    const btnDownload = this.element.querySelector('#btn-download-replay');
    const btnPlayPause = this.element.querySelector('#btn-play-pause');
    const btnSeekBack = this.element.querySelector('#btn-seek-back');
    const btnSeekForward = this.element.querySelector('#btn-seek-forward');
    const speedButtons = this.element.querySelectorAll('.speed-btn');
    const videoBox = this.element.querySelector('#replay-video-box');

    const btnDebug = this.element.querySelector('#btn-replay-debug');
    const debugBox = this.element.querySelector('#replay-debug-box');
    const btnCloseDebug = this.element.querySelector('#btn-close-debug-replay');
    const btnCopyDebug = this.element.querySelector('#btn-copy-debug-replay');

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
        const content = this.element.querySelector('#replay-debug-content');
        if (content) {
          const text = content.innerText || content.textContent;
          navigator.clipboard.writeText(text).then(() => {
            btnCopyDebug.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyDebug.textContent = '📋 Copy'; }, 2000);
          }).catch(() => {});
        }
      };
    }

    if (btnClose) btnClose.onclick = () => this.destroy();

    if (btnDownload) {
      btnDownload.onclick = () => shareHighlightVideo(this.clip, btnDownload);
    }

    // Close on backdrop click outside modal
    this.element.onclick = (e) => {
      if (e.target === this.element) this.destroy();
    };

    const togglePlayPause = () => {
      if (!this.video) return;
      if (this.video.paused) {
        this.video.play();
        if (btnPlayPause) btnPlayPause.innerHTML = PAUSE_ICON;
      } else {
        this.video.pause();
        if (btnPlayPause) btnPlayPause.innerHTML = PLAY_ICON;
      }
    };

    if (this.video && btnPlayPause) {
      btnPlayPause.onclick = (e) => {
        e.stopPropagation();
        togglePlayPause();
      };

      // Tapping on empty video space toggles play/pause
      if (videoBox) {
        videoBox.onclick = (e) => {
          if (e.target === videoBox || e.target === this.video) {
            togglePlayPause();
          }
        };
      }

      if (btnSeekBack) {
        btnSeekBack.onclick = (e) => {
          e.stopPropagation();
          this.video.currentTime = Math.max(0, this.video.currentTime - 10);
        };
      }

      if (btnSeekForward) {
        btnSeekForward.onclick = (e) => {
          e.stopPropagation();
          this.video.currentTime = Math.min(this.video.duration || 999, this.video.currentTime + 10);
        };
      }

      // Speed toggle buttons (only one depressed at a time)
      speedButtons.forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const speed = parseFloat(btn.dataset.speed);
          this.currentSpeed = speed;
          this.video.playbackRate = speed;

          speedButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        };
      });

      this.video.ontimeupdate = () => {
        if (debugBox && debugBox.style.display !== 'none') {
          this.updateDebugInfo();
        }
      };

      this.video.onplay = () => {
        if (btnPlayPause) btnPlayPause.innerHTML = PAUSE_ICON;
        this.isPlaying = true;
        if (debugBox && debugBox.style.display !== 'none') {
          this.updateDebugInfo();
        }
      };

      this.video.onpause = () => {
        if (btnPlayPause) btnPlayPause.innerHTML = PLAY_ICON;
        this.isPlaying = false;
        if (debugBox && debugBox.style.display !== 'none') {
          this.updateDebugInfo();
        }
      };

      this.video.onerror = (e) => {
        console.warn('[ReplayPlayer] Video error:', e, this.video.error);
        if (debugBox && debugBox.style.display !== 'none') {
          this.updateDebugInfo();
        }
      };

      this.video.onended = () => {
        if (btnPlayPause) btnPlayPause.innerHTML = PLAY_ICON;
        this.isPlaying = false;
      };
    }

    // Keyboard controls for convenience
    this.handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.destroy();
      } else if (e.key === ' ' && this.video) {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft' && this.video) {
        e.preventDefault();
        this.video.currentTime = Math.max(0, this.video.currentTime - 10);
      } else if (e.key === 'ArrowRight' && this.video) {
        e.preventDefault();
        this.video.currentTime = Math.min(this.video.duration || 999, this.video.currentTime + 10);
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);
  }

  updateDebugInfo() {
    const content = this.element.querySelector('#replay-debug-content');
    if (!content) return;
    const v = this.video;
    const readyStateMap = ['0 (HAVE_NOTHING)', '1 (HAVE_METADATA)', '2 (HAVE_CURRENT_DATA)', '3 (HAVE_FUTURE_DATA)', '4 (HAVE_ENOUGH_DATA)'];
    const networkStateMap = ['0 (EMPTY)', '1 (IDLE)', '2 (LOADING)', '3 (NO_SOURCE)'];
    const errorMsg = v && v.error ? `Code ${v.error.code}: ${v.error.message || 'Media load failed'}` : 'None';

    const sourceTitle = this.isUsingLocalBlob
      ? '✅ Real Camera Video (Phone IndexedDB)'
      : this.isUsingDriveBlob
      ? `☁️ Google Drive Video Blob (ID: ${this.driveFileId})`
      : '☁️ Cloud Storage Video';

    const sourceBg = this.isUsingLocalBlob
      ? 'rgba(48,209,88,0.2)'
      : this.isUsingDriveBlob
      ? 'rgba(10,132,255,0.25)'
      : 'rgba(10,132,255,0.2)';

    const sourceBorder = this.isUsingLocalBlob
      ? '#30d158'
      : this.isUsingDriveBlob
      ? '#0a84ff'
      : '#0a84ff';

    content.innerHTML = `
      <div style="margin-bottom: 6px;"><b>App Version:</b> v1.4.3 (${new Date().toLocaleTimeString()})</div>
      <div style="margin-bottom: 6px;"><b>Clip:</b> ${this.clip ? (this.clip.id || 'N/A') : 'N/A'} - ${this.clip ? (this.clip.label || '') : ''} (Set ${this.clip ? this.clip.set : 1}, ${this.clip ? this.clip.score : '0-0'})</div>

      <div style="margin-bottom: 8px; padding: 8px 10px; border-radius: 8px; background: ${sourceBg}; border: 1px solid ${sourceBorder};">
        <b>Active Video Source:</b> ${sourceTitle}
        ${this.isUsingLocalBlob ? `<div style="font-size: 10px; color: #30d158; margin-top: 4px; line-height: 1.35;">Playing uncompressed camera master from physical phone storage (0 latency).</div>` : ''}
        ${this.isUsingDriveBlob ? `<div style="font-size: 10px; color: #64d2ff; margin-top: 4px; line-height: 1.35;">Playing downloaded Google Drive video blob with native HTML5 playback and scrubber controls!</div>` : ''}
      </div>

      <div style="margin-bottom: 6px;"><b>Configured URL:</b> <span style="word-break: break-all; color: #ffd60a;">${this.clip ? (this.clip.videoUrl || 'None') : 'None'}</span></div>
      ${this.driveFileId ? `<div style="margin-bottom: 6px;"><b>Google Drive ID:</b> <span style="word-break: break-all; color: #30d158;">${this.driveFileId}</span></div>` : ''}
      <div style="margin-bottom: 6px;"><b>Active Mode:</b> Native HTML5 &lt;video&gt; Element (Zero iframes)</div>
      <div style="margin-bottom: 6px;"><b>Video Element src:</b> <span style="word-break: break-all; color: #30d158;">${v ? (v.src || 'None') : 'No video elem'}</span></div>
      <div style="margin-bottom: 6px;"><b>currentSrc:</b> <span style="word-break: break-all; color: #a5b4fc;">${v ? (v.currentSrc || 'None') : 'None'}</span></div>
      <div style="margin-bottom: 6px;"><b>Playback State:</b> paused=${v ? v.paused : 'N/A'}, muted=${v ? v.muted : 'N/A'}, speed=${v ? v.playbackRate : 'N/A'}x</div>
      <div style="margin-bottom: 6px;"><b>Time / Duration:</b> ${v ? `${v.currentTime.toFixed(2)}s / ${(v.duration ? v.duration.toFixed(2) + 's' : 'unknown')}` : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>Dimensions:</b> ${v ? `${v.videoWidth} x ${v.videoHeight}` : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>readyState:</b> ${v ? (readyStateMap[v.readyState] || v.readyState) : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>networkState:</b> ${v ? (networkStateMap[v.networkState] || v.networkState) : 'N/A'}</div>
      <div style="margin-bottom: 6px;"><b>Error:</b> <span style="color: ${v && v.error ? '#ff453a' : '#30d158'};">${errorMsg}</span></div>
    `;
  }

  destroy() {
    if (this.handleKeyDown) {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.handleKeyDown = null;
    }
    if (this.element && this.element.parentNode) {
      if (this.video) this.video.pause();
      this.element.parentNode.removeChild(this.element);
    }
    document.body.classList.remove('reel-open');
    document.documentElement.classList.remove('reel-open');
    if (this.onClose) this.onClose();
  }
}
