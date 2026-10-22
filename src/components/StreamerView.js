// ==========================================================================
// StreamerView: iPhone Camera Experience with Split Gestures, Corner Scores,
// Highlight Pill Picker, and Slide-Out Comment Drawer
// ==========================================================================

import { store, getTennisPointDisplay } from '../services/store.js';
import { getBroadcastIcon, getTennisNetIcon } from './icons.js';

export function renderStreamerView(container, navigate) {
  let mediaStream = null;
  let wakeLock = null;
  let isListeningVoice = false;
  let speechRecognition = null;
  let lastSeenMessageCount = store.getState().chat.length;

  container.innerHTML = `
    <div class="streamer-container" id="streamer-root">
      <!-- Fullscreen Camera Preview (or simulation canvas) -->
      <video class="camera-preview" id="camera-feed" autoplay playsinline muted></video>
      <canvas class="camera-preview" id="simulated-canvas" style="display: none;"></canvas>

      <!-- Invisible Split Screen Gesture Zones -->
      <div class="split-gesture-overlay" id="split-overlay">
        <div class="gesture-zone" id="zone-left">
          <div class="gesture-zone-hint" id="hint-left">+1 POINT</div>
        </div>
        <div class="gesture-zone" id="zone-right">
          <div class="gesture-zone-hint" id="hint-right">+1 POINT</div>
        </div>
      </div>

      <!-- Top Row Controls -->
      <header class="streamer-top-bar">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="streamer-pill frosted-glass tabular-nums" style="display: flex; align-items: center; gap: 6px;">
            ${getBroadcastIcon(13, 'var(--accent-red)')}
            <span>LIVE</span>
            <span id="txt-viewer-count" style="color: var(--text-secondary);">(3)</span>
          </div>
          <button class="apple-btn" id="btn-end-stream" style="padding: 6px 12px; font-size: 12px;">✕ End</button>
        </div>

        <button class="apple-btn frosted-glass tabular-nums" id="btn-set-counter" style="font-weight: 700; font-size: 14px;">
          SET 1
        </button>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="apple-btn btn-highlight-player" id="btn-highlight-player" title="Player Highlight (Son/Daughter)">
            Player ★
          </button>
          <button class="apple-btn btn-highlight-team" id="btn-highlight-team" title="Team Highlight (Rally)">
            Team ★
          </button>
        </div>
      </header>

      <!-- Bottom Score Row (Dual-Sport: Volleyball corner scores vs TV Tabular Tennis Scoreboard) -->
      <footer class="streamer-bottom-bar">
        <!-- Volleyball Layout: Scores in Outer Corners -->
        <div id="volleyball-score-wrap" style="width: 100%; display: flex; align-items: center; justify-content: space-between; pointer-events: none;">
          <!-- Left Corner: <score> <name> -->
          <div class="score-side-left" id="side-left">
            <span class="score-digit tabular-nums" id="digit-left">0</span>
            <span class="score-team-label" id="lbl-team-left">US</span>
          </div>

          <!-- Midline Swap Sides Button -->
          <button class="apple-btn frosted-glass btn-swap-sides" id="btn-swap-sides" title="Swap Court Sides">
            ⇄
          </button>

          <!-- Right Corner: <name> <score> -->
          <div class="score-side-right" id="side-right">
            <span class="score-team-label" id="lbl-team-right">LINCOLN</span>
            <span class="score-digit tabular-nums" id="digit-right">0</span>
          </div>
        </div>

        <!-- Tennis Layout: TV Tabular Scoreboard Overlay (Tap opens score & server editor) -->
        <div id="tennis-score-wrap" style="width: 100%; display: none; justify-content: flex-end; pointer-events: none;">
          <div class="tennis-tv-scoreboard" id="tennis-tv-scoreboard" title="Tap Scoreboard to Edit Scores & Server">
            <div class="tennis-row">
              <div class="tennis-row-team">
                <span id="tennis-srv-us" class="tennis-server-indicator active">🎾</span>
                <span id="tennis-name-us" class="tennis-team-name" title="US">US</span>
              </div>
              <div class="tennis-sets-wrap" id="tennis-sets-us"></div>
              <div class="tennis-point-cell tabular-nums" id="tennis-pts-us">0</div>
            </div>
            <div class="tennis-row">
              <div class="tennis-row-team">
                <span id="tennis-srv-them" class="tennis-server-indicator">🎾</span>
                <span id="tennis-name-them" class="tennis-team-name" title="OPPONENT">OPPONENT</span>
              </div>
              <div class="tennis-sets-wrap" id="tennis-sets-them"></div>
              <div class="tennis-point-cell tabular-nums" id="tennis-pts-them">0</div>
            </div>
            <div class="tennis-scoreboard-tap-hint">Tap Scoreboard to Edit</div>
          </div>
        </div>
      </footer>

      <!-- Broadcaster Camera Zoom Slider on Left Edge -->
      <div class="streamer-zoom-control frosted-glass" id="streamer-zoom-control">
        <button class="zoom-btn" id="btn-zoom-in" title="Zoom in (+0.2x)" aria-label="Zoom in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <div class="zoom-track-container" id="zoom-track-container" title="Drag to Zoom">
          <div class="zoom-track-bg"></div>
          <div class="zoom-track-fill" id="zoom-track-fill"></div>
          <div class="zoom-thumb" id="zoom-thumb"></div>
        </div>

        <button class="zoom-btn" id="btn-zoom-out" title="Zoom out (-0.2x)" aria-label="Zoom out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <button class="zoom-badge-btn" id="btn-zoom-badge" title="Tap to toggle 1.0x / 2.0x">
          <span id="txt-zoom-level">1.0x</span>
        </button>
      </div>

      <!-- Broadcaster Comments Edge Tab (Pulsing when unread) -->
      <div class="streamer-chat-tab" id="chat-edge-tab" title="View Viewer Comments">
        <span>💬</span>
        <span id="chat-tab-count"></span>
      </div>

      <!-- Slide-Out Semi-Transparent Comments Drawer -->
      <div class="streamer-chat-drawer" id="streamer-chat-drawer">
        <div class="streamer-drawer-header">
          <h3>Viewer Comments</h3>
          <button class="btn-drawer-close" id="btn-close-drawer" title="Close Drawer (Slide right)" aria-label="Close Drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        <div class="streamer-drawer-messages" id="drawer-chat-list">
          <!-- Comments stream here -->
        </div>

        <div class="dictation-status" id="dictation-status" style="display: none; padding: 6px 14px; font-size: 13px; color: var(--accent-gold); background: rgba(0,0,0,0.35); text-align: center;"></div>

        <div class="streamer-drawer-input-row">
          <button class="apple-btn frosted-glass btn-voice-mic" id="btn-voice-mic" title="Voice-to-Text Dictation">
            🎙️
          </button>
          <input type="text" class="simple-input" id="input-drawer-msg" placeholder="Speak or type a comment..." style="padding: 10px 14px; font-size: 15px;" />
          <button class="apple-btn apple-btn-primary" id="btn-send-drawer-msg" style="padding: 10px 16px; font-size: 14px; font-weight: 600;">Send</button>
        </div>
      </div>

      <!-- Highlight Pill Picker Modal (Appears when Player ★ or Team ★ is pressed) -->
      <div class="highlight-pill-backdrop" id="highlight-pill-modal" style="display: none;">
        <div class="highlight-pill-dialog" style="max-width: 360px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="highlight-modal-badge" style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; background: rgba(255,214,10,0.2); color: var(--accent-gold); border: 1px solid var(--accent-gold);">PLAYER ★</span>
              <h3 style="font-size: 16px; font-weight: 700;">Select Highlight</h3>
            </div>
            <button class="apple-btn" id="btn-cancel-highlight" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>

          <!-- Current Pt. vs Previous Pt. Toggle -->
          <div style="margin: 12px 0; padding: 10px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Target Point</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;" id="highlight-target-hint">Rally currently in play</div>
            </div>
            <button class="apple-btn btn-point-target-toggle current" id="btn-toggle-point-target">
              Current Pt.
            </button>
          </div>

          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Choose tag to confirm and save clip:</p>

          <div class="highlight-pill-grid" id="highlight-pill-grid">
            <!-- Dynamically populated based on active sport -->
          </div>
        </div>
      </div>

      <!-- Set Action Modal (Next Set, Match Finished, Cancel, Reset) -->
      <div class="highlight-pill-backdrop" id="set-action-modal" style="display: none;">
        <div class="highlight-pill-dialog set-action-dialog" style="max-width: 440px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 16px; font-weight: 700;" id="set-modal-title">Set 1 Options</h3>
            <button class="apple-btn" id="btn-cancel-set-modal" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;" id="set-modal-score">Current Score: US 0 - 0 LINCOLN</p>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <!-- Next Set Format Chooser for Tennis -->
            <div id="tennis-next-set-section" style="display: none; flex-direction: column; gap: 6px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--accent-gold); text-transform: uppercase; letter-spacing: 0.5px;">Start Next Set As:</div>
              <div class="next-set-grid">
                <button class="apple-btn apple-btn-primary btn-start-set-fmt" data-fmt="standard">
                  🎾 Standard Set (6)
                </button>
                <button class="apple-btn apple-btn-primary btn-start-set-fmt" data-fmt="tiebreak-10">
                  🎾 10-Pt Match TB
                </button>
                <button class="apple-btn apple-btn-primary btn-start-set-fmt" data-fmt="tiebreak-7">
                  🎾 7-Pt Tiebreak
                </button>
                <button class="apple-btn apple-btn-primary btn-start-set-fmt" data-fmt="pro-set-8">
                  🎾 8-Game Pro Set
                </button>
              </div>
            </div>

            <!-- Standard Next Set button for Volleyball -->
            <button class="apple-btn apple-btn-primary" id="btn-modal-next-set" style="padding: 10px; font-size: 14px; font-weight: 600;">
              ▶ Next Set
            </button>
            <div class="set-action-bottom-grid">
              <button class="apple-btn apple-btn-danger" id="btn-modal-finish-match" style="padding: 9px; font-size: 13px; font-weight: 600;">
                🏆 Match Finished
              </button>
              <button class="apple-btn" id="btn-modal-reset-set" style="padding: 9px; font-size: 13px; color: var(--accent-gold);">
                🔄 Reset to 0 - 0
              </button>
            </div>
            <button class="apple-btn" id="btn-modal-close-set" style="padding: 8px; font-size: 13px;">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Universal Tennis Score & Server Editor Modal -->
      <div class="highlight-pill-backdrop" id="tennis-editor-modal" style="display: none;">
        <div class="highlight-pill-dialog" style="max-width: 380px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🎾</span>
              <h3 style="font-size: 16px; font-weight: 700;">Tennis Score & Server</h3>
            </div>
            <button class="apple-btn" id="btn-close-tennis-editor" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>

          <!-- Active Server Selector -->
          <div style="margin: 10px 0 8px 0;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Active Server
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn-server-toggle serving" id="btn-toggle-srv-us">
                <span>US</span>
                <span class="srv-ball" id="ball-srv-us">🎾</span>
              </button>
              <button class="btn-server-toggle" id="btn-toggle-srv-them">
                <span id="txt-edit-srv-them">OPPONENT</span>
                <span class="srv-ball" id="ball-srv-them" style="display: none;">🎾</span>
              </button>
            </div>
          </div>

          <!-- Current Set Format Selector -->
          <div style="margin: 8px 0;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Current Set Format
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="editor-format-chips">
              <button class="format-choice-chip active" data-fmt="standard">Standard (6)</button>
              <button class="format-choice-chip" data-fmt="pro-set-8">8-Game Pro</button>
              <button class="format-choice-chip" data-fmt="tiebreak-10">10-Pt TB</button>
              <button class="format-choice-chip" data-fmt="tiebreak-7">7-Pt TB</button>
            </div>
          </div>

          <!-- Set History & Current Game Counts Table -->
          <div style="margin: 8px 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Set & Game Scores</span>
              <button class="apple-btn" id="btn-add-editor-set" style="padding: 2px 8px; font-size: 11px;">+ Add Set</button>
            </div>
            <div id="editor-sets-table-wrap" style="max-height: 140px; overflow-y: auto;">
              <!-- Dynamic Rows per Set with steppers and '?' button -->
            </div>
          </div>

          <!-- Validation Banner for Illegal Tennis Scores -->
          <div id="editor-points-validation" class="editor-validation-banner" style="display: none;"></div>

          <!-- Current Game Points Selector -->
          <div style="margin: 8px 0;" id="editor-points-section">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Current Game Points
            </div>
            <!-- Points US -->
            <div style="margin-bottom: 6px;">
              <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">US Points:</div>
              <div style="display: flex; gap: 6px;" id="editor-pills-us">
                <button class="btn-point-pill active" data-val="0">0</button>
                <button class="btn-point-pill" data-val="1">15</button>
                <button class="btn-point-pill" data-val="2">30</button>
                <button class="btn-point-pill" data-val="3">40</button>
                <button class="btn-point-pill" data-val="4">AD</button>
              </div>
            </div>
            <!-- Points Them -->
            <div>
              <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;" id="lbl-edit-pts-them">Opponent Points:</div>
              <div style="display: flex; gap: 6px;" id="editor-pills-them">
                <button class="btn-point-pill active" data-val="0">0</button>
                <button class="btn-point-pill" data-val="1">15</button>
                <button class="btn-point-pill" data-val="2">30</button>
                <button class="btn-point-pill" data-val="3">40</button>
                <button class="btn-point-pill" data-val="4">AD</button>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button class="apple-btn" id="btn-cancel-tennis-editor" style="flex: 1;">Cancel</button>
            <button class="apple-btn apple-btn-primary" id="btn-save-tennis-editor" style="flex: 1; font-weight: 600;">Save & Apply</button>
          </div>
        </div>
      </div>

      <!-- Exit Broadcast Modal (Pause Broadcast vs Finish Match) -->
      <div class="highlight-pill-backdrop" id="exit-broadcast-modal" style="display: none;">
        <div class="highlight-pill-dialog" style="max-width: 330px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 16px; font-weight: 700;">Leave Broadcast</h3>
            <button class="apple-btn" id="btn-cancel-exit-modal" style="padding: 4px 10px; font-size: 12px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 6px 0 14px 0;">
            Would you like to pause and keep this match in progress, or finalize the match score?
          </p>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="apple-btn apple-btn-primary" id="btn-pause-stream" style="padding: 12px; font-size: 14px; font-weight: 600; text-align: left; display: flex; flex-direction: column; gap: 2px;">
              <span>⏸ Pause Broadcast</span>
              <span style="font-size: 11px; font-weight: 400; opacity: 0.85;">Keeps match in progress. You can resume and append highlights later today.</span>
            </button>
            <button class="apple-btn apple-btn-danger" id="btn-finish-stream" style="padding: 12px; font-size: 14px; font-weight: 600; text-align: left; display: flex; flex-direction: column; gap: 2px;">
              <span>🏆 Finish Match</span>
              <span style="font-size: 11px; font-weight: 400; opacity: 0.85;">Awards current set, finalizes match score and archives transcript.</span>
            </button>
            <button class="apple-btn" id="btn-cancel-exit-action" style="padding: 10px; font-size: 13px; margin-top: 4px;">
              Cancel (Stay in Broadcast)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Elements
  const videoElem = container.querySelector('#camera-feed');
  const canvasElem = container.querySelector('#simulated-canvas');
  const zoneLeft = container.querySelector('#zone-left');
  const zoneRight = container.querySelector('#zone-right');
  const hintLeft = container.querySelector('#hint-left');
  const hintRight = container.querySelector('#hint-right');
  const btnSet = container.querySelector('#btn-set-counter');
  const btnHighlightPlayer = container.querySelector('#btn-highlight-player');
  const btnHighlightTeam = container.querySelector('#btn-highlight-team');
  const highlightModalBadge = container.querySelector('#highlight-modal-badge');
  const btnTogglePointTarget = container.querySelector('#btn-toggle-point-target');
  const highlightTargetHint = container.querySelector('#highlight-target-hint');
  let chosenHighlightType = 'player';
  let highlightPointTarget = 'current';
  let activeTriggerBtn = btnHighlightPlayer;
  const btnSwap = container.querySelector('#btn-swap-sides');
  const btnEnd = container.querySelector('#btn-end-stream');

  const volleyballScoreWrap = container.querySelector('#volleyball-score-wrap');
  const lblTeamLeft = container.querySelector('#lbl-team-left');
  const digitLeft = container.querySelector('#digit-left');
  const lblTeamRight = container.querySelector('#lbl-team-right');
  const digitRight = container.querySelector('#digit-right');
  const txtViewerCount = container.querySelector('#txt-viewer-count');

  // Tennis Scoreboard elements
  const tennisScoreWrap = container.querySelector('#tennis-score-wrap');
  const tennisTvScoreboard = container.querySelector('#tennis-tv-scoreboard');
  const tennisSrvUs = container.querySelector('#tennis-srv-us');
  const tennisSrvThem = container.querySelector('#tennis-srv-them');
  const tennisNameUs = container.querySelector('#tennis-name-us');
  const tennisNameThem = container.querySelector('#tennis-name-them');
  const tennisSetsUs = container.querySelector('#tennis-sets-us');
  const tennisSetsThem = container.querySelector('#tennis-sets-them');
  const tennisPtsUs = container.querySelector('#tennis-pts-us');
  const tennisPtsThem = container.querySelector('#tennis-pts-them');

  // Highlight modal elements
  const highlightModal = container.querySelector('#highlight-pill-modal');
  const btnCancelHighlight = container.querySelector('#btn-cancel-highlight');
  const highlightPillGrid = container.querySelector('#highlight-pill-grid');

  // Set action modal elements
  const setActionModal = container.querySelector('#set-action-modal');
  const setModalTitle = container.querySelector('#set-modal-title');
  const setModalScore = container.querySelector('#set-modal-score');
  const tennisNextSetSection = container.querySelector('#tennis-next-set-section');
  const btnModalNextSet = container.querySelector('#btn-modal-next-set');
  const btnModalFinishMatch = container.querySelector('#btn-modal-finish-match');
  const btnModalResetSet = container.querySelector('#btn-modal-reset-set');
  const btnModalCloseSet = container.querySelector('#btn-modal-close-set');
  const btnCancelSetModal = container.querySelector('#btn-cancel-set-modal');

  // Tennis Editor modal elements
  const tennisEditorModal = container.querySelector('#tennis-editor-modal');
  const btnCloseTennisEditor = container.querySelector('#btn-close-tennis-editor');
  const btnCancelTennisEditor = container.querySelector('#btn-cancel-tennis-editor');
  const btnSaveTennisEditor = container.querySelector('#btn-save-tennis-editor');
  const btnToggleSrvUs = container.querySelector('#btn-toggle-srv-us');
  const btnToggleSrvThem = container.querySelector('#btn-toggle-srv-them');
  const ballSrvUs = container.querySelector('#ball-srv-us');
  const ballSrvThem = container.querySelector('#ball-srv-them');
  const txtEditSrvThem = container.querySelector('#txt-edit-srv-them');
  const editorFormatChips = container.querySelector('#editor-format-chips');
  const editorSetsTableWrap = container.querySelector('#editor-sets-table-wrap');
  const btnAddEditorSet = container.querySelector('#btn-add-editor-set');
  const editorPointsSection = container.querySelector('#editor-points-section');
  const editorPointsValidation = container.querySelector('#editor-points-validation');
  const editorPillsUs = container.querySelector('#editor-pills-us');
  const editorPillsThem = container.querySelector('#editor-pills-them');
  const lblEditPtsThem = container.querySelector('#lbl-edit-pts-them');

  // Exit broadcast modal elements
  const exitModal = container.querySelector('#exit-broadcast-modal');
  const btnPauseStream = container.querySelector('#btn-pause-stream');
  const btnFinishStream = container.querySelector('#btn-finish-stream');
  const btnCancelExitModal = container.querySelector('#btn-cancel-exit-modal');
  const btnCancelExitAction = container.querySelector('#btn-cancel-exit-action');

  // Chat drawer elements
  const chatEdgeTab = container.querySelector('#chat-edge-tab');
  const chatTabCount = container.querySelector('#chat-tab-count');
  const chatDrawer = container.querySelector('#streamer-chat-drawer');
  const btnCloseDrawer = container.querySelector('#btn-close-drawer');
  const drawerChatList = container.querySelector('#drawer-chat-list');
  const inputDrawerMsg = container.querySelector('#input-drawer-msg');
  const btnSendDrawerMsg = container.querySelector('#btn-send-drawer-msg');
  const btnVoiceMic = container.querySelector('#btn-voice-mic');
  const dictationStatus = container.querySelector('#dictation-status');

  // Zoom control elements on left edge
  const zoomControl = container.querySelector('#streamer-zoom-control');
  const btnZoomIn = container.querySelector('#btn-zoom-in');
  const btnZoomOut = container.querySelector('#btn-zoom-out');
  const zoomTrackContainer = container.querySelector('#zoom-track-container');
  const zoomTrackFill = container.querySelector('#zoom-track-fill');
  const zoomThumb = container.querySelector('#zoom-thumb');
  const btnZoomBadge = container.querySelector('#btn-zoom-badge');
  const txtZoomLevel = container.querySelector('#txt-zoom-level');

  let currentZoom = 1.0;
  let maxZoom = 4.0;
  let hardwareZoomSupported = false;
  let currentHardwareZoom = 1.0;

  // --- 1. Camera Initialization & Wake Lock ---
  async function initCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false // audio: false allows SpeechRecognition to access the mic exclusively without iOS Safari audio session contention
      });
      videoElem.srcObject = mediaStream;
      videoElem.style.display = 'block';
      canvasElem.style.display = 'none';

      // Detect hardware optical/digital zoom capabilities on device camera
      try {
        const track = mediaStream ? mediaStream.getVideoTracks()[0] : null;
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities();
          if (caps && caps.zoom) {
            hardwareZoomSupported = true;
            if (caps.zoom.max && caps.zoom.max > 1.0) {
              maxZoom = Math.min(6.0, Math.max(3.0, caps.zoom.max));
            }
          }
          if (typeof track.getSettings === 'function') {
            const settings = track.getSettings();
            if (settings && settings.zoom) {
              currentHardwareZoom = settings.zoom;
            }
          }
        }
      } catch (err) {
        console.log('Camera capabilities check ignored:', err);
      }
    } catch (err) {
      console.warn('Real camera not available, falling back to simulated volleyball court:', err);
      startSimulatedVolleyballCourt(canvasElem);
      videoElem.style.display = 'none';
      canvasElem.style.display = 'block';
    }

    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      console.log('Wake Lock ignored or unsupported:', e);
    }
  }

  // --- Zoom Handling (Fluid 60fps Live Viewfinder Zoom + Zero-Oscillation Hardware Commit) ---
  let isDraggingZoom = false;
  let hardwareZoomTimeout = null;
  let isApplyingHardwareConstraint = false;
  let pendingHardwareZoom = null;

  // Real-time GPU visual scaling gives 0ms latency live zooming at 60fps without interrupting the camera feed!
  // When zooming out below the current hardware frame, a viewfinder framing guide allows estimating
  // the exact shot field-of-view without jittering the physical camera sensor.
  function updateVisualScale() {
    const visualScale = hardwareZoomSupported ? (currentZoom / currentHardwareZoom) : currentZoom;

    if (Math.abs(visualScale - 1.0) > 0.02) {
      const scaleStr = `scale(${visualScale.toFixed(3)})`;
      videoElem.style.transform = scaleStr;
      canvasElem.style.transform = scaleStr;

      // When scaling down to estimate zoom-out, activate viewfinder framing reticle
      if (visualScale < 0.98) {
        videoElem.classList.add('zooming-out-viewfinder');
        canvasElem.classList.add('zooming-out-viewfinder');
      } else {
        videoElem.classList.remove('zooming-out-viewfinder');
        canvasElem.classList.remove('zooming-out-viewfinder');
      }
    } else {
      videoElem.style.transform = 'none';
      canvasElem.style.transform = 'none';
      videoElem.classList.remove('zooming-out-viewfinder');
      canvasElem.classList.remove('zooming-out-viewfinder');
    }
  }

  async function applyHardwareConstraint(val) {
    if (!hardwareZoomSupported || !mediaStream) return;
    const track = mediaStream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') return;

    let targetHardwareVal = val;
    try {
      if (typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities();
        if (caps && caps.zoom) {
          const min = caps.zoom.min || 1.0;
          const max = caps.zoom.max || maxZoom;
          targetHardwareVal = Math.max(min, Math.min(max, val));
        }
      }
    } catch (e) {}

    if (isApplyingHardwareConstraint) {
      pendingHardwareZoom = targetHardwareVal;
      return;
    }

    isApplyingHardwareConstraint = true;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: targetHardwareVal }]
      });
      currentHardwareZoom = targetHardwareVal;

      // No transition "glide" effect: simply fill in the outer pixels without zooming still frames
      videoElem.style.transition = 'none';
      canvasElem.style.transition = 'none';
      updateVisualScale();
    } catch (e) {
      console.warn('Hardware zoom constraint ignored or unsupported:', e);
    } finally {
      isApplyingHardwareConstraint = false;
      if (pendingHardwareZoom !== null && Math.abs(pendingHardwareZoom - currentHardwareZoom) > 0.05) {
        const next = pendingHardwareZoom;
        pendingHardwareZoom = null;
        applyHardwareConstraint(next);
      } else {
        pendingHardwareZoom = null;
      }
    }
  }

  function applyZoom(val, isImmediateHardware = false) {
    currentZoom = Math.max(1.0, Math.min(maxZoom, Math.round(val * 10) / 10));

    // 1. Instant 60fps GPU live zoom feedback
    updateVisualScale();

    // 2. Update slider track & badge UI immediately
    const ratio = (currentZoom - 1.0) / (maxZoom - 1.0);
    const pct = Math.max(0, Math.min(100, ratio * 100));
    zoomTrackFill.style.height = `${pct}%`;
    zoomThumb.style.bottom = `${pct}%`;
    txtZoomLevel.textContent = `${currentZoom.toFixed(1)}x`;

    if (currentZoom > 1.05) {
      btnZoomBadge.classList.add('zoomed');
    } else {
      btnZoomBadge.classList.remove('zoomed');
    }

    // 3. Hardware camera zoom:
    // Only dispatch hardware constraint on immediate button click (+/-) or when drag releases.
    // Keeping hardware constraints off during dragging prevents camera daemon stutter and oscillation!
    if (hardwareZoomTimeout) clearTimeout(hardwareZoomTimeout);
    if (isImmediateHardware) {
      applyHardwareConstraint(currentZoom);
    }
  }

  // Stop propagation on zoom control so touching it never triggers +1 point on left court zone
  zoomControl.addEventListener('pointerdown', (e) => e.stopPropagation());
  zoomControl.addEventListener('touchstart', (e) => e.stopPropagation());
  zoomControl.addEventListener('click', (e) => e.stopPropagation());

  // Slider Dragging (desktop mouse and mobile touch)
  function handleZoomPointer(e) {
    const rect = zoomTrackContainer.getBoundingClientRect();
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : rect.bottom);
    // Bottom is 1.0x (wide), Top is maxZoom (telephoto)
    const ratio = (rect.bottom - clientY) / rect.height;
    const clamped = Math.max(0, Math.min(1, ratio));
    const targetZoom = 1.0 + clamped * (maxZoom - 1.0);
    applyZoom(targetZoom, false);
  }

  zoomTrackContainer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingZoom = true;
    videoElem.style.transition = 'none';
    canvasElem.style.transition = 'none';
    if (zoomTrackContainer.setPointerCapture) {
      try { zoomTrackContainer.setPointerCapture(e.pointerId); } catch (err) {}
    }
    handleZoomPointer(e);
  });

  zoomTrackContainer.addEventListener('pointermove', (e) => {
    if (!isDraggingZoom) return;
    e.stopPropagation();
    e.preventDefault();
    handleZoomPointer(e);
  });

  const stopZoomDrag = (e) => {
    if (isDraggingZoom) {
      e.stopPropagation();
      isDraggingZoom = false;
      store.triggerHaptic('light');
      // On release, immediately commit the new zoom level to the hardware camera!
      if (hardwareZoomTimeout) clearTimeout(hardwareZoomTimeout);
      applyHardwareConstraint(currentZoom);
    }
  };
  zoomTrackContainer.addEventListener('pointerup', stopZoomDrag);
  zoomTrackContainer.addEventListener('pointercancel', stopZoomDrag);

  // Zoom In / Out Buttons (+0.2x / -0.2x)
  btnZoomIn.onclick = (e) => {
    e.stopPropagation();
    applyZoom(currentZoom + 0.2, true);
    store.triggerHaptic('light');
  };

  btnZoomOut.onclick = (e) => {
    e.stopPropagation();
    applyZoom(currentZoom - 0.2, true);
    store.triggerHaptic('light');
  };

  // Zoom Badge: tap to snap to 1.0x if zoomed, or toggle to 2.0x for rapid close-up
  btnZoomBadge.onclick = (e) => {
    e.stopPropagation();
    if (currentZoom > 1.05) {
      applyZoom(1.0, true);
    } else {
      applyZoom(2.0, true);
    }
    store.triggerHaptic('light');
  };

  // --- 2. Update UI from Store ---
  function updateUI() {
    const s = store.getState().activeMatch;
    const isVictory = store.checkSetVictory();
    const isTennis = (s.sport === 'tennis');

    if (isVictory) {
      btnSet.classList.add('pulse-victory');
    } else {
      btnSet.classList.remove('pulse-victory');
    }

    if (isTennis) {
      if (s.isTiebreak) {
        btnSet.textContent = `SET ${s.currentSet} (TB)`;
      } else if (s.currentSetFormat === 'pro-set-8') {
        btnSet.textContent = `PRO-SET`;
      } else {
        btnSet.textContent = `SET ${s.currentSet}`;
      }
    } else {
      btnSet.textContent = `SET ${s.currentSet}`;
    }

    txtViewerCount.textContent = `(${s.viewers})`;

    if (isTennis) {
      volleyballScoreWrap.style.display = 'none';
      tennisScoreWrap.style.display = 'flex';

      // Serve Ball Indicator
      if (s.server === 'us') {
        tennisSrvUs.classList.add('active');
        tennisSrvThem.classList.remove('active');
      } else {
        tennisSrvUs.classList.remove('active');
        tennisSrvThem.classList.add('active');
      }

      tennisNameUs.textContent = 'US';
      const themName = (s.opponent || 'OPPONENT').toUpperCase();
      tennisNameThem.textContent = themName;
      tennisNameThem.title = s.opponent || 'OPPONENT';

      // Render sets columns
      const sets = s.setScores || [];
      let setsUsHtml = '';
      let setsThemHtml = '';
      sets.forEach(set => {
        const valUs = set.us !== undefined ? set.us : (set.score ? set.score.split('-')[0] : '?');
        const valThem = set.them !== undefined ? set.them : (set.score ? set.score.split('-')[1] : '?');
        setsUsHtml += `<div class="tennis-set-cell">${valUs}</div>`;
        setsThemHtml += `<div class="tennis-set-cell">${valThem}</div>`;
      });

      // Current set game cell (only if not a pure tiebreak set)
      if (s.currentSetFormat !== 'tiebreak-10' && s.currentSetFormat !== 'tiebreak-7') {
        setsUsHtml += `<div class="tennis-set-cell current">${s.gamesUs || 0}</div>`;
        setsThemHtml += `<div class="tennis-set-cell current">${s.gamesThem || 0}</div>`;
      }

      tennisSetsUs.innerHTML = setsUsHtml;
      tennisSetsThem.innerHTML = setsThemHtml;

      // Points cell
      const ptDisplay = getTennisPointDisplay(s.pointsUs, s.pointsThem, s.isTiebreak, s.tennisScoringType);
      tennisPtsUs.textContent = ptDisplay.us;
      tennisPtsThem.textContent = ptDisplay.them;
    } else {
      volleyballScoreWrap.style.display = 'flex';
      tennisScoreWrap.style.display = 'none';

      const teamUs = 'US';
      const teamThem = (s.opponent || 'THEM').toUpperCase();

      if (s.courtSideUs === 'left') {
        digitLeft.textContent = s.scoreUs;
        lblTeamLeft.textContent = teamUs;
        lblTeamRight.textContent = teamThem;
        digitRight.textContent = s.scoreThem;
      } else {
        digitLeft.textContent = s.scoreThem;
        lblTeamLeft.textContent = teamThem;
        lblTeamRight.textContent = teamUs;
        digitRight.textContent = s.scoreUs;
      }
    }

    // Update Drawer Comments and Edge Tab
    const chatList = store.getState().chat;
    const isDrawerOpen = chatDrawer.classList.contains('open');

    // Helper to format special pill icons (e.g. isometric tennis net, shovel for dig)
    function formatCommentText(text) {
      if (!text) return '';
      if (text.includes('Net Point')) {
        text = text.replace(/(?:🎾|🥅)?\s*Net Point/, `${getTennisNetIcon(18, 'chat-tennis-net-img')} Net Point`);
      }
      if (text.includes('Amazing Dig')) {
        text = text.replace(/(?:⛏️|🪏)?\s*Amazing Dig/, '🪏 Amazing Dig');
      }
      return text;
    }

    drawerChatList.innerHTML = chatList.map(msg => `
      <div class="chat-bubble">
        <div class="sender">${msg.sender} ${msg.score ? `(Set ${msg.set} • ${msg.score})` : ''}</div>
        <div style="font-weight: ${msg.isCheer ? '700' : '400'}; color: ${msg.isCheer ? 'var(--accent-gold)' : 'inherit'};">
          ${formatCommentText(msg.text)}
        </div>
      </div>
    `).join('');

    if (isDrawerOpen) {
      lastSeenMessageCount = chatList.length;
      chatEdgeTab.classList.remove('pulsing');
      chatTabCount.textContent = '';
      drawerChatList.scrollTop = drawerChatList.scrollHeight;
    } else {
      const unread = Math.max(0, chatList.length - lastSeenMessageCount);
      if (unread > 0) {
        chatEdgeTab.classList.add('pulsing');
        chatTabCount.textContent = `${unread}`;
      } else {
        chatEdgeTab.classList.remove('pulsing');
        chatTabCount.textContent = '';
      }
    }
  }

  // --- 3. Split-Screen Touch Gestures (Tap = +1, Swipe Down = -1) ---
  function setupGestures(zoneElem, side, hintElem) {
    let startY = 0;
    let startTime = 0;
    let isSwiping = false;

    zoneElem.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
      isSwiping = false;
    }, { passive: true });

    zoneElem.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;
      if (diffY > 45 && !isSwiping) {
        isSwiping = true;
        store.adjustScore(side, -1);
        flashHint(hintElem, '-1 POINT', 'red');
      }
    }, { passive: true });

    zoneElem.addEventListener('touchend', (e) => {
      const elapsed = Date.now() - startTime;
      if (!isSwiping && elapsed < 350) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
      }
    });

    zoneElem.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) {
        store.adjustScore(side, +1);
        flashHint(hintElem, '+1 POINT', 'white');
      }
    });
  }

  function flashHint(elem, text, color) {
    elem.textContent = text;
    elem.style.color = color === 'red' ? 'var(--accent-red)' : 'var(--text-primary)';
    elem.style.opacity = '1';
    setTimeout(() => {
      elem.style.opacity = '0';
    }, 450);
  }

  setupGestures(zoneLeft, 'left', hintLeft);
  setupGestures(zoneRight, 'right', hintRight);

  // --- 4. Controls Listeners ---
  btnSwap.onclick = (e) => {
    e.stopPropagation();
    store.swapSides();
  };

  btnSet.onclick = (e) => {
    e.stopPropagation();
    const cur = store.getState().activeMatch;
    const teamThem = (cur.opponent || 'THEM').toUpperCase();
    if (cur.sport === 'tennis') {
      setModalTitle.textContent = cur.setFinished ? `Set ${cur.currentSet} Complete!` : `Set ${cur.currentSet} Options`;
      setModalScore.textContent = `Score: Games ${cur.gamesUs}-${cur.gamesThem} • Points: ${cur.pointsUs}-${cur.pointsThem}`;
      tennisNextSetSection.style.display = 'flex';
      btnModalNextSet.style.display = 'none';
    } else {
      setModalTitle.textContent = `Set ${cur.currentSet} Options`;
      setModalScore.textContent = `Current Score: US ${cur.scoreUs} - ${cur.scoreThem} ${teamThem}`;
      tennisNextSetSection.style.display = 'none';
      btnModalNextSet.style.display = 'block';
    }
    setActionModal.style.display = 'flex';
  };

  btnModalNextSet.onclick = (e) => {
    e.stopPropagation();
    store.advanceSet();
    setActionModal.style.display = 'none';
  };

  // Tennis next set format choice buttons
  container.querySelectorAll('.btn-start-set-fmt').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const fmt = btn.dataset.fmt;
      store.startNextTennisSet(fmt);
      setActionModal.style.display = 'none';
    };
  });

  btnModalResetSet.onclick = (e) => {
    e.stopPropagation();
    store.resetScores();
    setActionModal.style.display = 'none';
  };

  function handleFinishMatch() {
    const cur = store.getState().activeMatch;
    let winner = null;
    const teamThem = (cur.opponent || 'OPPONENT').toUpperCase();
    const hasUnknown = (cur.setScores || []).some(s => s.us === '?' || s.them === '?');
    if (cur.sport === 'tennis' && (hasUnknown || !cur.setFinished)) {
      const choice = confirm(`Finish Match:\n\nDid US win this match?\n\n[OK] = US Won\n[Cancel] = ${teamThem} Won`);
      winner = choice ? 'us' : 'them';
    }
    store.finishMatch(winner);
    setActionModal.style.display = 'none';
    exitModal.style.display = 'none';
    cleanup();
    navigate('/');
  }

  btnModalFinishMatch.onclick = (e) => {
    e.stopPropagation();
    handleFinishMatch();
  };

  btnModalCloseSet.onclick = (e) => {
    e.stopPropagation();
    setActionModal.style.display = 'none';
  };

  btnCancelSetModal.onclick = (e) => {
    e.stopPropagation();
    setActionModal.style.display = 'none';
  };

  setActionModal.onclick = (e) => {
    if (e.target === setActionModal) {
      setActionModal.style.display = 'none';
    }
  };

  btnEnd.onclick = (e) => {
    e.stopPropagation();
    exitModal.style.display = 'flex';
  };

  btnPauseStream.onclick = (e) => {
    e.stopPropagation();
    store.pauseBroadcast();
    exitModal.style.display = 'none';
    cleanup();
    navigate('/');
  };

  btnFinishStream.onclick = (e) => {
    e.stopPropagation();
    handleFinishMatch();
  };

  const closeExitModal = () => { exitModal.style.display = 'none'; };
  btnCancelExitModal.onclick = closeExitModal;
  btnCancelExitAction.onclick = closeExitModal;
  exitModal.onclick = (e) => {
    if (e.target === exitModal) closeExitModal();
  };

  // --- Tennis Universal Score & Server Editor Modal Logic ---
  let editorServer = 'us';
  let editorFormat = 'standard';
  let editorSetScores = [];
  let editorGamesUs = 0;
  let editorGamesThem = 0;
  let editorPtsUs = 0;
  let editorPtsThem = 0;

  function updateEditorServerUI() {
    if (editorServer === 'us') {
      btnToggleSrvUs.classList.add('serving');
      btnToggleSrvThem.classList.remove('serving');
      ballSrvUs.style.display = 'inline';
      ballSrvThem.style.display = 'none';
    } else {
      btnToggleSrvUs.classList.remove('serving');
      btnToggleSrvThem.classList.add('serving');
      ballSrvUs.style.display = 'none';
      ballSrvThem.style.display = 'inline';
    }
  }

  function updateEditorFormatUI() {
    editorFormatChips.querySelectorAll('.format-choice-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.fmt === editorFormat);
    });
  }

  function renderEditorSetsTable() {
    const s = store.getState().activeMatch;
    let html = `
      <table class="tennis-editor-table">
        <thead>
          <tr>
            <th>Set</th>
            <th>US</th>
            <th>${(s.opponent || 'OPPONENT').toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Past sets
    editorSetScores.forEach((set, idx) => {
      const isUnknownUs = set.us === '?' || set.us === undefined;
      const isUnknownThem = set.them === '?' || set.them === undefined;

      html += `
        <tr>
          <td style="font-weight: 700;">Set ${set.set || (idx + 1)}</td>
          <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              ${isUnknownUs ? `
                <span class="tennis-stepper-val" style="color: var(--accent-gold);">?</span>
              ` : `
                <button class="tennis-stepper-btn" data-action="dec-past-us" data-idx="${idx}">–</button>
                <span class="tennis-stepper-val">${set.us}</span>
                <button class="tennis-stepper-btn" data-action="inc-past-us" data-idx="${idx}">+</button>
              `}
              <button class="tennis-unknown-btn ${isUnknownUs ? 'active' : ''}" data-action="toggle-past-us" data-idx="${idx}">?</button>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              ${isUnknownThem ? `
                <span class="tennis-stepper-val" style="color: var(--accent-gold);">?</span>
              ` : `
                <button class="tennis-stepper-btn" data-action="dec-past-them" data-idx="${idx}">–</button>
                <span class="tennis-stepper-val">${set.them}</span>
                <button class="tennis-stepper-btn" data-action="inc-past-them" data-idx="${idx}">+</button>
              `}
              <button class="tennis-unknown-btn ${isUnknownThem ? 'active' : ''}" data-action="toggle-past-them" data-idx="${idx}">?</button>
            </div>
          </td>
        </tr>
      `;
    });

    // Current Live Set
    html += `
      <tr style="background: rgba(255, 214, 10, 0.08); font-weight: 700;">
        <td>Set ${s.currentSet} (Live)</td>
        <td>
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button class="tennis-stepper-btn" data-action="dec-cur-us">–</button>
            <span class="tennis-stepper-val">${editorGamesUs}</span>
            <button class="tennis-stepper-btn" data-action="inc-cur-us">+</button>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button class="tennis-stepper-btn" data-action="dec-cur-them">–</button>
            <span class="tennis-stepper-val">${editorGamesThem}</span>
            <button class="tennis-stepper-btn" data-action="inc-cur-them">+</button>
          </div>
        </td>
      </tr>
    `;

    html += `</tbody></table>`;
    editorSetsTableWrap.innerHTML = html;

    // Steppers inside sets table
    editorSetsTableWrap.querySelectorAll('button[data-action]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx, 10);

        if (action === 'dec-cur-us') {
          editorGamesUs = Math.max(0, editorGamesUs - 1);
        } else if (action === 'inc-cur-us') {
          editorGamesUs += 1;
        } else if (action === 'dec-cur-them') {
          editorGamesThem = Math.max(0, editorGamesThem - 1);
        } else if (action === 'inc-cur-them') {
          editorGamesThem += 1;
        } else if (action === 'toggle-past-us') {
          if (editorSetScores[idx].us === '?') {
            editorSetScores[idx].us = 6;
          } else {
            editorSetScores[idx].us = '?';
          }
        } else if (action === 'toggle-past-them') {
          if (editorSetScores[idx].them === '?') {
            editorSetScores[idx].them = 4;
          } else {
            editorSetScores[idx].them = '?';
          }
        } else if (action === 'dec-past-us') {
          const v = typeof editorSetScores[idx].us === 'number' ? editorSetScores[idx].us : 6;
          editorSetScores[idx].us = Math.max(0, v - 1);
        } else if (action === 'inc-past-us') {
          const v = typeof editorSetScores[idx].us === 'number' ? editorSetScores[idx].us : 5;
          editorSetScores[idx].us = v + 1;
        } else if (action === 'dec-past-them') {
          const v = typeof editorSetScores[idx].them === 'number' ? editorSetScores[idx].them : 4;
          editorSetScores[idx].them = Math.max(0, v - 1);
        } else if (action === 'inc-past-them') {
          const v = typeof editorSetScores[idx].them === 'number' ? editorSetScores[idx].them : 3;
          editorSetScores[idx].them = v + 1;
        }
        renderEditorSetsTable();
      };
    });
  }

  function validateTennisPoints(ptsUs, ptsThem) {
    if (ptsUs === 4 && ptsThem === 4) {
      return 'Both players cannot have Advantage (AD) at the same time. If tied after Deuce, the score is Deuce (40-40).';
    }
    if (ptsUs === 4 && ptsThem < 3) {
      const themLabel = ptsThem === 0 ? '0' : (ptsThem === 1 ? '15' : '30');
      return `Advantage (AD) for US is only possible from Deuce (40-40). A score of AD–${themLabel} is not allowed.`;
    }
    if (ptsThem === 4 && ptsUs < 3) {
      const usLabel = ptsUs === 0 ? '0' : (ptsUs === 1 ? '15' : '30');
      return `Advantage (AD) for Opponent is only possible from Deuce (40-40). A score of ${usLabel}–AD is not allowed.`;
    }
    return null;
  }

  function updatePointsValidationUI() {
    if (!editorPointsValidation) return;
    const err = validateTennisPoints(editorPtsUs, editorPtsThem);
    if (err) {
      const fixTarget = (editorPtsUs === 4 && editorPtsThem < 3) ? 'Opponent to 40' : ((editorPtsThem === 4 && editorPtsUs < 3) ? 'US to 40' : 'both to 40');
      editorPointsValidation.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 15px;">⚠️</span>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #ff9f0a; font-size: 12px;">Invalid Score Combination</div>
            <div style="font-size: 11.5px; margin-top: 2px; color: #f8fafc;">${err}</div>
            <div style="margin-top: 6px; display: flex; gap: 6px;">
              <button class="apple-btn" id="btn-fix-score" style="padding: 4px 10px; font-size: 11px; background: rgba(255, 214, 10, 0.25); color: var(--accent-gold); border: 1px solid var(--accent-gold); font-weight: 600;">
                Auto-Fix (${fixTarget})
              </button>
            </div>
          </div>
        </div>
      `;
      editorPointsValidation.style.display = 'block';

      const btnFix = editorPointsValidation.querySelector('#btn-fix-score');
      if (btnFix) {
        btnFix.onclick = (e) => {
          e.stopPropagation();
          if (editorPtsUs === 4 && editorPtsThem < 3) {
            editorPtsThem = 3; // 40
          } else if (editorPtsThem === 4 && editorPtsUs < 3) {
            editorPtsUs = 3; // 40
          } else if (editorPtsUs === 4 && editorPtsThem === 4) {
            editorPtsUs = 3;
            editorPtsThem = 3;
          }
          renderEditorPointsPills();
        };
      }
    } else {
      editorPointsValidation.style.display = 'none';
      editorPointsValidation.innerHTML = '';
    }
  }

  function renderEditorPointsPills() {
    editorPillsUs.querySelectorAll('.btn-point-pill').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.val, 10) === editorPtsUs);
      pill.onclick = (e) => {
        e.stopPropagation();
        editorPtsUs = parseInt(pill.dataset.val, 10);
        renderEditorPointsPills();
      };
    });

    editorPillsThem.querySelectorAll('.btn-point-pill').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.val, 10) === editorPtsThem);
      pill.onclick = (e) => {
        e.stopPropagation();
        editorPtsThem = parseInt(pill.dataset.val, 10);
        renderEditorPointsPills();
      };
    });

    updatePointsValidationUI();
  }

  function openTennisEditorModal() {
    const s = store.getState().activeMatch;
    editorServer = s.server || 'us';
    editorFormat = s.currentSetFormat || 'standard';
    editorSetScores = (s.setScores || []).map(x => ({ ...x }));
    editorGamesUs = s.gamesUs || 0;
    editorGamesThem = s.gamesThem || 0;
    editorPtsUs = s.pointsUs || 0;
    editorPtsThem = s.pointsThem || 0;

    updateEditorServerUI();
    updateEditorFormatUI();
    renderEditorSetsTable();
    renderEditorPointsPills();

    txtEditSrvThem.textContent = (s.opponent || 'OPPONENT').toUpperCase();
    lblEditPtsThem.textContent = `${(s.opponent || 'OPPONENT').toUpperCase()} Points:`;

    tennisEditorModal.style.display = 'flex';
  }

  btnToggleSrvUs.onclick = (e) => {
    e.stopPropagation();
    editorServer = 'us';
    updateEditorServerUI();
  };

  btnToggleSrvThem.onclick = (e) => {
    e.stopPropagation();
    editorServer = 'them';
    updateEditorServerUI();
  };

  editorFormatChips.querySelectorAll('.format-choice-chip').forEach(chip => {
    chip.onclick = (e) => {
      e.stopPropagation();
      editorFormat = chip.dataset.fmt;
      updateEditorFormatUI();
    };
  });

  btnAddEditorSet.onclick = (e) => {
    e.stopPropagation();
    editorSetScores.push({
      set: editorSetScores.length + 1,
      us: '?',
      them: '?'
    });
    renderEditorSetsTable();
  };

  btnSaveTennisEditor.onclick = (e) => {
    e.stopPropagation();
    const err = validateTennisPoints(editorPtsUs, editorPtsThem);
    if (err) {
      updatePointsValidationUI();
      if (editorPointsValidation) {
        editorPointsValidation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      store.triggerHaptic('double');
      return;
    }
    store.updateTennisScore({
      setScores: editorSetScores,
      gamesUs: editorGamesUs,
      gamesThem: editorGamesThem,
      pointsUs: editorPtsUs,
      pointsThem: editorPtsThem,
      server: editorServer,
      currentSetFormat: editorFormat
    });
    tennisEditorModal.style.display = 'none';
  };

  const closeTennisEditor = () => { tennisEditorModal.style.display = 'none'; };
  btnCloseTennisEditor.onclick = closeTennisEditor;
  btnCancelTennisEditor.onclick = closeTennisEditor;
  tennisEditorModal.onclick = (e) => {
    if (e.target === tennisEditorModal) closeTennisEditor();
  };

  tennisTvScoreboard.onclick = (e) => {
    e.stopPropagation();
    openTennisEditorModal();
  };

  // Helper to visually toggle point target colors & keep button size constant
  function updatePointTargetUI(target) {
    highlightPointTarget = target;
    if (target === 'previous') {
      btnTogglePointTarget.textContent = 'Previous Pt.';
      btnTogglePointTarget.className = 'apple-btn btn-point-target-toggle previous';
      highlightTargetHint.textContent = 'Prior rally (footage of previous point)';
    } else {
      btnTogglePointTarget.textContent = 'Current Pt.';
      btnTogglePointTarget.className = 'apple-btn btn-point-target-toggle current';
      highlightTargetHint.textContent = 'Rally currently in play (saves once point finishes)';
    }
  }

  // --- 5. Highlight Pill Picker Trigger with Sport-Specific Pills ---
  function renderHighlightPills() {
    const isTennis = (store.getState().activeMatch.sport === 'tennis');
    const pills = isTennis ? [
      { label: '🔥 Sweet Serve', html: '🔥 Sweet Serve' },
      { label: '⏱️ Long Point', html: '⏱️ Long Point' },
      { label: '💪 Killer Forehand', html: '💪 Killer Forehand' },
      { label: '💪 Nice Backhand', html: '<span class="icon-mirrored">💪</span> Nice Backhand' },
      { label: '🎾 Net Point', html: `${getTennisNetIcon(22, 'pill-tennis-net-img')} Net Point` },
      { label: '↩️ Blistering Return', html: '↩️ Blistering Return' }
    ] : [
      { label: '🪏 Amazing Dig', html: '🪏 Amazing Dig' },
      { label: '💣 Crazy Kill', html: '💣 Crazy Kill' },
      { label: '🔥 Sweet Serve', html: '🔥 Sweet Serve' },
      { label: '💪 Big Block!', html: '💪 Big Block!' },
      { label: '🎯 Cool Set', html: '🎯 Cool Set' },
      { label: '⏱️ Long Point', html: '⏱️ Long Point' }
    ];

    highlightPillGrid.innerHTML = pills.map(p => `
      <button class="apple-btn btn-highlight-select" data-label="${p.label}">${p.html}</button>
    `).join('');

    highlightPillGrid.querySelectorAll('.btn-highlight-select').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const label = btn.dataset.label;
        const target = highlightPointTarget;
        const type = chosenHighlightType;

        store.triggerPointHighlight({
          type: type,
          label: label,
          target: target
        });

        highlightModal.style.display = 'none';

        const confirmText = (target === 'previous') ? 'Prev. Pt. Highlighted' : 'Current Pt. Highlighted';
        const originalText = (type === 'player') ? 'Player ★' : 'Team ★';

        if (activeTriggerBtn) {
          activeTriggerBtn.style.transform = 'scale(1.08)';
          activeTriggerBtn.textContent = `✓ ${confirmText}`;
          flashHint(hintLeft, `${type.toUpperCase()}: ${label}`, type === 'player' ? 'gold' : 'blue');

          setTimeout(() => {
            activeTriggerBtn.style.transform = 'scale(1)';
            activeTriggerBtn.textContent = originalText;
          }, 2400);
        }
      };
    });
  }

  btnHighlightPlayer.onclick = (e) => {
    e.stopPropagation();
    chosenHighlightType = 'player';
    activeTriggerBtn = btnHighlightPlayer;
    highlightModalBadge.textContent = 'PLAYER ★';
    highlightModalBadge.style.color = 'var(--accent-gold)';
    highlightModalBadge.style.borderColor = 'var(--accent-gold)';
    highlightModalBadge.style.background = 'rgba(255, 214, 10, 0.2)';
    updatePointTargetUI('current');
    renderHighlightPills();
    highlightModal.style.display = 'flex';
  };

  btnHighlightTeam.onclick = (e) => {
    e.stopPropagation();
    chosenHighlightType = 'team';
    activeTriggerBtn = btnHighlightTeam;
    highlightModalBadge.textContent = 'TEAM ★';
    highlightModalBadge.style.color = '#0A84FF';
    highlightModalBadge.style.borderColor = '#0A84FF';
    highlightModalBadge.style.background = 'rgba(10, 132, 255, 0.2)';
    updatePointTargetUI('current');
    renderHighlightPills();
    highlightModal.style.display = 'flex';
  };

  btnTogglePointTarget.onclick = (e) => {
    e.stopPropagation();
    const nextTarget = (highlightPointTarget === 'current') ? 'previous' : 'current';
    updatePointTargetUI(nextTarget);
  };

  btnCancelHighlight.onclick = (e) => {
    e.stopPropagation();
    highlightModal.style.display = 'none';
  };

  highlightModal.onclick = (e) => {
    if (e.target === highlightModal) {
      highlightModal.style.display = 'none';
    }
  };

  // --- 6. Broadcaster Chat Drawer & Voice-to-Text ---
  function openDrawer() {
    chatDrawer.classList.add('open');
    lastSeenMessageCount = store.getState().chat.length;
    chatEdgeTab.classList.remove('pulsing');
    chatTabCount.textContent = '';
    drawerChatList.scrollTop = drawerChatList.scrollHeight;
  }

  function closeDrawer() {
    chatDrawer.classList.remove('open');
    lastSeenMessageCount = store.getState().chat.length;
  }

  chatEdgeTab.onclick = (e) => {
    e.stopPropagation();
    if (chatDrawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  btnCloseDrawer.onclick = (e) => {
    e.stopPropagation();
    closeDrawer();
  };

  function sendBroadcasterMessage() {
    const text = inputDrawerMsg.value.trim();
    if (!text) return;
    store.postChatMessage('Broadcaster', text);
    inputDrawerMsg.value = '';
    drawerChatList.scrollTop = drawerChatList.scrollHeight;
  }

  btnSendDrawerMsg.onclick = sendBroadcasterMessage;
  inputDrawerMsg.onkeydown = (e) => {
    if (e.key === 'Enter') sendBroadcasterMessage();
  };

  // Web Speech API Voice-to-Text
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isListeningVoice = true;
      btnVoiceMic.classList.add('listening');
      dictationStatus.style.display = 'block';
      dictationStatus.textContent = '🎙️ Listening... speak into microphone';
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = (finalTranscript || interimTranscript).trim();
      if (text) {
        inputDrawerMsg.value = text;
        dictationStatus.style.display = 'block';
        dictationStatus.textContent = `🗣️ "${text}"`;
      }
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error event:', event.error);
      isListeningVoice = false;
      btnVoiceMic.classList.remove('listening');
      dictationStatus.style.display = 'block';

      if (event.error === 'network') {
        dictationStatus.textContent = '⚠️ Voice server unreachable. (Apple restricts speech recognition on local debug IP / self-signed SSL. Please type directly)';
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        dictationStatus.textContent = '⚠️ Mic access denied or Siri/Dictation disabled in iOS Settings.';
      } else if (event.error === 'no-speech') {
        dictationStatus.textContent = 'No speech detected. Tap mic to try again or type directly.';
      } else if (event.error === 'audio-capture') {
        dictationStatus.textContent = '⚠️ Microphone capture failed. Ensure mic is enabled in Safari.';
      } else {
        dictationStatus.textContent = `⚠️ Voice status: ${event.error}. You can type directly.`;
      }
    };

    speechRecognition.onend = () => {
      isListeningVoice = false;
      btnVoiceMic.classList.remove('listening');
      if (inputDrawerMsg.value.trim()) {
        dictationStatus.style.display = 'block';
        dictationStatus.textContent = '✓ Speech captured! Tap Send or edit text below.';
      } else {
        setTimeout(() => {
          if (!isListeningVoice && !inputDrawerMsg.value.trim()) {
            dictationStatus.style.display = 'none';
          }
        }, 3500);
      }
    };

    btnVoiceMic.onclick = (e) => {
      e.stopPropagation();
      if (!isListeningVoice) {
        try {
          dictationStatus.style.display = 'block';
          dictationStatus.textContent = '🎙️ Initializing microphone...';
          speechRecognition.start();
        } catch (err) {
          console.warn('Speech recognition start failed:', err);
          isListeningVoice = false;
          btnVoiceMic.classList.remove('listening');
          dictationStatus.style.display = 'block';
          dictationStatus.textContent = '⚠️ Could not start voice recognition. Please type below.';
        }
      } else {
        try {
          speechRecognition.stop();
        } catch (err) {
          try { speechRecognition.abort(); } catch (e2) {}
        }
        isListeningVoice = false;
        btnVoiceMic.classList.remove('listening');
      }
    };
  } else {
    btnVoiceMic.style.display = 'none';
  }

  // --- 7. Cleanup ---
  function cleanup() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    if (wakeLock) {
      wakeLock.release().catch(() => {});
    }
  }

  initCamera();
  updateUI();
  const unsubscribe = store.subscribe(updateUI);

  return () => {
    cleanup();
    unsubscribe();
  };
}

// Simulated dynamic volleyball court background for desktop testing
function startSimulatedVolleyballCourt(canvas) {
  const ctx = canvas.getContext('2d');
  let frame = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    frame++;
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Court floor
    const courtY = canvas.height * 0.25;
    const courtH = canvas.height * 0.65;
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(40, courtY, canvas.width - 80, courtH);

    // Court boundary lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, courtY, canvas.width - 80, courtH);

    // Net line (midline)
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, courtY);
    ctx.lineTo(canvas.width / 2, courtY + courtH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated volleyball
    const ballX = canvas.width / 2 + Math.sin(frame * 0.04) * (canvas.width * 0.35);
    const ballY = courtY + courtH * 0.5 - Math.abs(Math.cos(frame * 0.04)) * (courtH * 0.3);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();
}
