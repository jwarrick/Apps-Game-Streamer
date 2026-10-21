// ==========================================================================
// Replay Popover Player Component (Apple-Style Minimalist)
// With Always-Visible Speed Toggles: 1x, 0.5x, 0.25x (Defaulting to 1x)
// ==========================================================================

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
            <div class="replay-actions-left">
              <button class="apple-btn" id="btn-play-pause">⏸</button>
              <button class="apple-btn" id="btn-seek-back">⏮ 10s</button>
              <button class="apple-btn" id="btn-seek-forward">10s ⏭</button>
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
        btnPlayPause.textContent = '⏸';
      } else {
        this.video.pause();
        btnPlayPause.textContent = '▶';
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
      btnPlayPause.textContent = '▶';
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
