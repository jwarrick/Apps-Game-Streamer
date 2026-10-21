// ==========================================================================
// HighlightReelPlayer: Continuous Match Highlights Player (YouTube/Story style)
// Plays all highlights sequentially without pause, overlays live score info
// in the top-left, and displays the final match outcome at the end
// ==========================================================================

import { sortHighlightsChronologically } from '../services/store.js';
import { getBroadcastIcon } from './icons.js';

export class HighlightReelPlayer {
  constructor(match, onClose) {
    this.match = match;
    this.onClose = onClose;
    // Strictly order highlights chronologically: Set ascending, Total score points ascending
    const sorted = sortHighlightsChronologically(match.highlights || []);
    this.clips = sorted.filter(h => h.videoUrl || h.driveUrl);
    this.currentIndex = 0;
    this.isPlaying = true;
    this.currentSpeed = 1.0;
    this.isCompleted = false;
    this.element = null;
    this.video = null;

    if (this.clips.length === 0) {
      alert('No video highlights available for this match yet.');
      if (this.onClose) this.onClose();
      return;
    }

    this.render();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'reel-modal-backdrop';

    const currentClip = this.clips[this.currentIndex];

    this.element.innerHTML = `
      <div class="reel-player-container">
        <!-- Story / Chapter Progress Segments at Top -->
        <div class="reel-progress-segments" id="reel-progress-segments">
          ${this.clips.map((c, i) => `
            <div class="reel-segment-bar" data-index="${i}" title="Jump to Highlight ${i + 1}">
              <div class="reel-segment-fill" id="segment-fill-${i}"></div>
            </div>
          `).join('')}
        </div>

        <!-- Top Header Navigation Bar -->
        <div class="reel-header-bar">
          <div class="reel-counter-badge" id="reel-counter-badge">
            Highlight 1 of ${this.clips.length}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="apple-btn btn-reel-speed" id="btn-reel-speed" title="Toggle Playback Speed">1.0x</button>
            <button class="btn-exit-circle" id="btn-close-reel" title="Exit Highlight Reel" aria-label="Exit">✕</button>
          </div>
        </div>

        <!-- Main Video Frame -->
        <div class="reel-video-wrapper" id="reel-video-wrapper">
          <video class="reel-video" id="reel-video-elem" playsinline autoplay>
            <source src="${currentClip.videoUrl || ''}" type="video/mp4" />
          </video>

          <!-- Top-Left Broadcast Live Score Overlay -->
          <div class="watcher-score-overlay frosted-glass reel-score-overlay" id="reel-score-overlay">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="live-badge" style="font-size: 12px; font-weight: 700; padding: 2px 8px; background: rgba(255, 59, 48, 0.2); color: var(--accent-red); border: 1px solid rgba(255, 59, 48, 0.4); display: inline-flex; align-items: center; gap: 5px;">
                  ${getBroadcastIcon(13, 'var(--accent-red)')} HIGHLIGHT REEL
                </span>
                <span style="font-size: 16px; font-weight: 700; color: #ffffff;" id="reel-overlay-opponent">vs. ${this.match.opponent}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 2px;">
                <span class="tabular-nums" style="font-size: 28px; font-weight: 900; line-height: 1; letter-spacing: 0.5px;" id="reel-overlay-score">
                  ${currentClip.score || '0 - 0'}
                </span>
                <span style="font-size: 15px; font-weight: 600; color: #f1f5f9; background: rgba(255, 255, 255, 0.12); padding: 3px 9px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15);" id="reel-overlay-set">
                  Set ${currentClip.set || 1}
                </span>
                <span class="reel-clip-badge" id="reel-overlay-label">
                  ${currentClip.label || 'Highlight'}
                </span>
              </div>
            </div>
          </div>

          <!-- Tap Zones: Left = Previous, Right = Next -->
          <div class="reel-tap-zone left" id="reel-tap-prev" title="Tap for Previous Highlight"></div>
          <div class="reel-tap-zone right" id="reel-tap-next" title="Tap for Next Highlight"></div>
        </div>

        <!-- Bottom Floating Navigation Strip -->
        <div class="reel-bottom-bar" id="reel-bottom-bar">
          <button class="apple-btn reel-nav-btn" id="btn-reel-prev" title="Previous Highlight">⏮ Prev</button>
          <button class="apple-btn apple-btn-primary reel-playpause-btn" id="btn-reel-playpause" title="Play or Pause">⏸</button>
          <button class="apple-btn reel-nav-btn" id="btn-reel-next" title="Next Highlight">Next ⏭</button>
        </div>

        <!-- Match Final Overlay Screen (Celebration screen at end of reel) -->
        <div class="reel-final-overlay frosted-glass" id="reel-final-overlay" style="display: none;">
          <div class="reel-trophy-icon">🏆</div>
          <div class="reel-final-tag">MATCH FINAL</div>
          <div class="reel-final-score-line tabular-nums" id="reel-final-score-display">
            ${this.match.setsUs} - ${this.match.setsThem}
          </div>
          <div class="reel-final-matchup-text" id="reel-final-matchup-text">
            Final: ${this.match.setsUs} (${this.match.teamUs || 'US'}) - ${this.match.setsThem} (${this.match.opponent})
          </div>
          <div class="reel-final-winner-badge" id="reel-final-winner-badge">
            ${this.match.setsUs > this.match.setsThem ? '🎉 US Wins the Match!' : `🏐 ${this.match.opponent} Wins the Match`}
          </div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 24px;">
            ${this.match.date} • Complete Highlight Reel Finished
          </div>
          <div class="reel-final-actions">
            <button class="apple-btn apple-btn-primary" id="btn-reel-restart" style="padding: 10px 20px; font-size: 15px;">↺ Replay Reel</button>
            <button class="apple-btn" id="btn-reel-exit-final" style="padding: 10px 20px; font-size: 15px;">✕ Done</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);
    this.video = this.element.querySelector('#reel-video-elem');
    this.setupListeners();
    this.loadClip(0);
  }

  setupListeners() {
    const btnClose = this.element.querySelector('#btn-close-reel');
    const btnPlayPause = this.element.querySelector('#btn-reel-playpause');
    const btnPrev = this.element.querySelector('#btn-reel-prev');
    const btnNext = this.element.querySelector('#btn-reel-next');
    const btnSpeed = this.element.querySelector('#btn-reel-speed');
    const tapPrev = this.element.querySelector('#reel-tap-prev');
    const tapNext = this.element.querySelector('#reel-tap-next');
    const btnRestart = this.element.querySelector('#btn-reel-restart');
    const btnExitFinal = this.element.querySelector('#btn-reel-exit-final');

    btnClose.onclick = () => this.destroy();
    if (btnExitFinal) btnExitFinal.onclick = () => this.destroy();

    btnPlayPause.onclick = () => this.togglePlayPause();
    btnPrev.onclick = () => this.prevClip();
    btnNext.onclick = () => this.nextClip();
    tapPrev.onclick = () => this.prevClip();
    tapNext.onclick = () => this.nextClip();

    btnSpeed.onclick = () => {
      if (this.currentSpeed === 1.0) this.currentSpeed = 0.5;
      else if (this.currentSpeed === 0.5) this.currentSpeed = 0.25;
      else this.currentSpeed = 1.0;

      btnSpeed.textContent = `${this.currentSpeed}x`;
      if (this.video) this.video.playbackRate = this.currentSpeed;
    };

    if (btnRestart) {
      btnRestart.onclick = () => {
        this.isCompleted = false;
        const finalOverlay = this.element.querySelector('#reel-final-overlay');
        const bottomBar = this.element.querySelector('#reel-bottom-bar');
        const scoreOverlay = this.element.querySelector('#reel-score-overlay');
        if (finalOverlay) finalOverlay.style.display = 'none';
        if (bottomBar) bottomBar.style.display = 'flex';
        if (scoreOverlay) scoreOverlay.style.display = 'block';
        this.loadClip(0);
      };
    }

    // Segment bars click to jump directly to any highlight
    this.element.querySelectorAll('.reel-segment-bar').forEach(bar => {
      bar.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(bar.dataset.index, 10);
        this.loadClip(idx);
      };
    });

    // Video events
    if (this.video) {
      this.video.onended = () => {
        // When clip ends, mark its segment complete and proceed to next immediately!
        this.fillSegment(this.currentIndex, 100);
        this.nextClip();
      };

      this.video.ontimeupdate = () => {
        if (this.video && this.video.duration) {
          const pct = Math.min(100, (this.video.currentTime / this.video.duration) * 100);
          this.fillSegment(this.currentIndex, pct);
        }
      };

      this.video.onerror = () => {
        console.warn('Highlight video failed to load, automatically advancing to next:', this.clips[this.currentIndex]);
        setTimeout(() => this.nextClip(), 1200);
      };
    }

    // Keyboard navigation (Left/Right arrows, Space to pause, Esc to exit)
    this.keyHandler = (e) => {
      if (e.key === 'ArrowRight') this.nextClip();
      else if (e.key === 'ArrowLeft') this.prevClip();
      else if (e.key === ' ') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.key === 'Escape') {
        this.destroy();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  loadClip(index) {
    if (index >= this.clips.length) {
      this.showFinalOverlay();
      return;
    }

    this.currentIndex = Math.max(0, index);
    const clip = this.clips[this.currentIndex];

    // Reset fills of segments ahead of current, mark past as 100%
    for (let i = 0; i < this.clips.length; i++) {
      if (i < this.currentIndex) this.fillSegment(i, 100);
      else if (i > this.currentIndex) this.fillSegment(i, 0);
    }

    // Update Counter
    const counterBadge = this.element.querySelector('#reel-counter-badge');
    if (counterBadge) {
      counterBadge.textContent = `Highlight ${this.currentIndex + 1} of ${this.clips.length}`;
    }

    // Update Score Overlay in top-left
    const scoreElem = this.element.querySelector('#reel-overlay-score');
    const setElem = this.element.querySelector('#reel-overlay-set');
    const labelElem = this.element.querySelector('#reel-overlay-label');
    const opponentElem = this.element.querySelector('#reel-overlay-opponent');

    if (scoreElem) scoreElem.textContent = clip.score || '0 - 0';
    if (setElem) setElem.textContent = `Set ${clip.set || 1}`;
    if (labelElem) labelElem.textContent = clip.label || 'Highlight';
    if (opponentElem) opponentElem.textContent = `vs. ${this.match.opponent}`;

    // Play next video
    if (this.video) {
      this.video.src = clip.videoUrl || '';
      this.video.playbackRate = this.currentSpeed;
      this.video.currentTime = 0;
      this.video.play().then(() => {
        this.isPlaying = true;
        this.updatePlayPauseIcon();
      }).catch(err => {
        console.warn('Autoplay prevented or failed:', err);
      });
    }
  }

  nextClip() {
    if (this.currentIndex + 1 < this.clips.length) {
      this.fillSegment(this.currentIndex, 100);
      this.loadClip(this.currentIndex + 1);
    } else {
      this.fillSegment(this.currentIndex, 100);
      this.showFinalOverlay();
    }
  }

  prevClip() {
    if (this.currentIndex > 0) {
      this.fillSegment(this.currentIndex, 0);
      this.loadClip(this.currentIndex - 1);
    } else {
      if (this.video) this.video.currentTime = 0;
    }
  }

  togglePlayPause() {
    if (!this.video) return;
    if (this.video.paused) {
      this.video.play();
      this.isPlaying = true;
    } else {
      this.video.pause();
      this.isPlaying = false;
    }
    this.updatePlayPauseIcon();
  }

  updatePlayPauseIcon() {
    const btn = this.element.querySelector('#btn-reel-playpause');
    if (btn) {
      btn.innerHTML = this.isPlaying ? '⏸' : '▶';
    }
  }

  fillSegment(index, percent) {
    const fill = this.element.querySelector(`#segment-fill-${index}`);
    if (fill) {
      fill.style.width = `${percent}%`;
    }
  }

  showFinalOverlay() {
    this.isCompleted = true;
    if (this.video) this.video.pause();

    const finalOverlay = this.element.querySelector('#reel-final-overlay');
    const bottomBar = this.element.querySelector('#reel-bottom-bar');
    const scoreOverlay = this.element.querySelector('#reel-score-overlay');

    if (finalOverlay) finalOverlay.style.display = 'flex';
    if (bottomBar) bottomBar.style.display = 'none';
    if (scoreOverlay) scoreOverlay.style.display = 'none';
  }

  destroy() {
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
    if (this.onClose) {
      this.onClose();
    }
  }
}
