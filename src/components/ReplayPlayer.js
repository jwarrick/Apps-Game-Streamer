import { shareHighlightVideo } from '../services/share.js';

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
    this.currentSpeed = 1.0; // Default to 1x as specified
    this.isPlaying = true;
    this.element = null;
    this.video = null;
    this.render();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'replay-modal-backdrop';

    this.element.innerHTML = `
      <div class="replay-modal">
        <div class="replay-header">
          <div>
            <span class="highlight-badge">Set ${this.clip.set} (${this.clip.score})</span>
            <span class="highlight-label" style="margin-left: 8px;">${this.clip.label || 'Highlight'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="apple-btn" id="btn-download-replay" title="Share Clip (Text, AirDrop, or Save to Photos)" style="padding: 4px 10px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
              <span>Share</span>
            </button>
            <button class="apple-btn" id="btn-close-replay" style="padding: 4px 10px; font-size: 13px;">✕ Close</button>
          </div>
        </div>

        <div class="replay-video-box">
          ${this.clip.videoUrl ? `
            <video class="replay-video" id="replay-video-elem" playsinline autoplay>
              <source src="${this.clip.videoUrl}" type="video/mp4" />
            </video>
          ` : `
            <div class="replay-drive-box">
              <span style="font-size: 38px; margin-bottom: 8px;">📦</span>
              <div style="font-size: 16px; font-weight: 600; color: #fff;">Archived to Google Drive</div>
              <p style="font-size: 13px; color: var(--text-secondary); max-width: 320px; margin: 8px auto 16px auto; line-height: 1.4;">
                Server copy was deleted to free up cloud storage. This highlight is permanently preserved in your Google Drive archive.
              </p>
              <a href="${this.clip.driveUrl || (this.clip.driveFileId ? `https://drive.google.com/file/d/${this.clip.driveFileId}/view` : '#')}" target="_blank" class="apple-btn apple-btn-primary" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: 13px; padding: 8px 16px;">
                <span>▶ Play in Google Drive</span>
              </a>
            </div>
          `}
        </div>

        ${this.clip.videoUrl ? `
          <div class="replay-controls">
            <div class="replay-button-row">
              <!-- Left & Play & Right: -10s, Play/Pause, +10s -->
              <div class="replay-actions-left">
                <button class="apple-btn replay-seek-btn" id="btn-seek-back" title="Rewind 10 seconds">-10s</button>
                <button class="apple-btn apple-btn-primary replay-play-btn" id="btn-play-pause" title="Play or Pause">
                  ${PAUSE_ICON}
                </button>
                <button class="apple-btn replay-seek-btn" id="btn-seek-forward" title="Fast forward 10 seconds">+10s</button>
              </div>

              <!-- Always visible segmented speed toggles, default 1x -->
              <div class="speed-toggle-group" id="speed-toggle-group">
                <button class="speed-btn active" data-speed="1.0">1x</button>
                <button class="speed-btn" data-speed="0.5">0.5x</button>
                <button class="speed-btn" data-speed="0.25">0.25x</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="replay-controls" style="justify-content: center; padding: 12px 18px;">
            <span style="font-size: 12px; color: var(--text-tertiary);">Google Drive File ID: ${this.clip.driveFileId || 'Archived'}</span>
          </div>
        `}
      </div>
    `;

    document.body.appendChild(this.element);

    this.video = this.element.querySelector('#replay-video-elem');
    if (this.video) {
      this.video.playbackRate = this.currentSpeed;
    }

    this.setupListeners();
  }

  setupListeners() {
    const btnClose = this.element.querySelector('#btn-close-replay');
    const btnDownload = this.element.querySelector('#btn-download-replay');
    const btnPlayPause = this.element.querySelector('#btn-play-pause');
    const btnSeekBack = this.element.querySelector('#btn-seek-back');
    const btnSeekForward = this.element.querySelector('#btn-seek-forward');
    const speedButtons = this.element.querySelectorAll('.speed-btn');

    btnClose.onclick = () => this.destroy();

    if (btnDownload) {
      btnDownload.onclick = () => shareHighlightVideo(this.clip, btnDownload);
    }

    // Close on backdrop click outside modal
    this.element.onclick = (e) => {
      if (e.target === this.element) this.destroy();
    };

    if (this.video && btnPlayPause) {
      btnPlayPause.onclick = () => {
        if (this.video.paused) {
          this.video.play();
          btnPlayPause.innerHTML = PAUSE_ICON;
        } else {
          this.video.pause();
          btnPlayPause.innerHTML = PLAY_ICON;
        }
      };

      if (btnSeekBack) {
        btnSeekBack.onclick = () => {
          this.video.currentTime = Math.max(0, this.video.currentTime - 10);
        };
      }

      if (btnSeekForward) {
        btnSeekForward.onclick = () => {
          this.video.currentTime = Math.min(this.video.duration || 999, this.video.currentTime + 10);
        };
      }

      // Speed toggle buttons (only one depressed at a time)
      speedButtons.forEach(btn => {
        btn.onclick = () => {
          const speed = parseFloat(btn.dataset.speed);
          this.currentSpeed = speed;
          this.video.playbackRate = speed;

          speedButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        };
      });

      this.video.onended = () => {
        btnPlayPause.innerHTML = PLAY_ICON;
      };
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      if (this.video) this.video.pause();
      this.element.parentNode.removeChild(this.element);
    }
    if (this.onClose) this.onClose();
  }
}
