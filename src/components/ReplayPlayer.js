// ==========================================================================
// Replay Popover Player Component (Apple-Style Minimalist)
// With Always-Visible Speed Toggles: 1x, 0.5x, 0.25x (Defaulting to 1x)
// ==========================================================================

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
          <button class="apple-btn" id="btn-close-replay" style="padding: 4px 10px; font-size: 13px;">✕ Close</button>
        </div>

        <div class="replay-video-box">
          <video class="replay-video" id="replay-video-elem" playsinline autoplay>
            <source src="${this.clip.videoUrl}" type="video/mp4" />
          </video>
        </div>

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
      </div>
    `;

    document.body.appendChild(this.element);

    this.video = this.element.querySelector('#replay-video-elem');
    this.video.playbackRate = this.currentSpeed;

    this.setupListeners();
  }

  setupListeners() {
    const btnClose = this.element.querySelector('#btn-close-replay');
    const btnPlayPause = this.element.querySelector('#btn-play-pause');
    const btnSeekBack = this.element.querySelector('#btn-seek-back');
    const btnSeekForward = this.element.querySelector('#btn-seek-forward');
    const speedButtons = this.element.querySelectorAll('.speed-btn');

    btnClose.onclick = () => this.destroy();

    // Close on backdrop click outside modal
    this.element.onclick = (e) => {
      if (e.target === this.element) this.destroy();
    };

    btnPlayPause.onclick = () => {
      if (this.video.paused) {
        this.video.play();
        btnPlayPause.innerHTML = PAUSE_ICON;
      } else {
        this.video.pause();
        btnPlayPause.innerHTML = PLAY_ICON;
      }
    };

    btnSeekBack.onclick = () => {
      this.video.currentTime = Math.max(0, this.video.currentTime - 10);
    };

    btnSeekForward.onclick = () => {
      this.video.currentTime = Math.min(this.video.duration || 999, this.video.currentTime + 10);
    };

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

  destroy() {
    if (this.element && this.element.parentNode) {
      if (this.video) this.video.pause();
      this.element.parentNode.removeChild(this.element);
    }
    if (this.onClose) this.onClose();
  }
}
