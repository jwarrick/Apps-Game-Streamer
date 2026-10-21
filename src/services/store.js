// ==========================================================================
// GameStreamer State Management & Realtime Sync Layer
// ==========================================================================

const STORAGE_KEY = 'gamestreamer_state_v1';

// Parse total score points (e.g. "14 - 12" -> 26 points)
export function parseScoreTotal(scoreStr) {
  if (!scoreStr) return 0;
  const nums = String(scoreStr).match(/\d+/g);
  if (!nums) return 0;
  if (nums.length >= 2) {
    return (parseInt(nums[0], 10) || 0) + (parseInt(nums[1], 10) || 0);
  }
  return parseInt(nums[0], 10) || 0;
}

// Order highlights strictly chronologically: 1. Set ascending, 2. Total score ascending, 3. Timestamp
export function sortHighlightsChronologically(highlights = []) {
  return [...highlights].sort((a, b) => {
    // 1. Set number ascending
    const setA = parseInt(a.set, 10) || 1;
    const setB = parseInt(b.set, 10) || 1;
    if (setA !== setB) {
      return setA - setB;
    }

    // 2. Total points scored ascending
    const totalA = parseScoreTotal(a.score);
    const totalB = parseScoreTotal(b.score);
    if (totalA !== totalB) {
      return totalA - totalB;
    }

    // 3. Fallback to timestamp ascending
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

// Initial state with realistic demo matches so the app is immediately beautiful and testable
const DEFAULT_STATE = {
  activeMatch: {
    id: 'demo-live',
    isLive: false,
    isFinished: false,
    date: 'Today',
    opponent: 'Lincoln High',
    teamUs: 'US',
    teamThem: 'LINCOLN',
    courtSideUs: 'left', // 'left' or 'right'
    scoreUs: 18,
    scoreThem: 16,
    setsUs: 1,
    setsThem: 0,
    currentSet: 2,
    lastScoreTimestamp: Date.now(),
    viewers: 1
  },
  matches: [
    {
      id: 'demo-live',
      date: 'Today',
      opponent: 'Lincoln High',
      isLive: false,
      isFinished: false,
      isArchived: false,
      setsUs: 1,
      setsThem: 0,
      currentSet: 2,
      scoreUs: 18,
      scoreThem: 16,
      highlights: [
        {
          id: 'h_1',
          type: 'player',
          set: 1,
          score: '14 - 12',
          label: '🔥 Sweet Serve',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          driveFileId: 'drive_h_1',
          driveUrl: 'https://drive.google.com/file/d/drive_h_1/view',
          fileSizeBytes: 3400000,
          isUploading: false,
          isStarred: true, // Starred by default so user sees gold star!
          timestamp: Date.now() - 1800000
        },
        {
          id: 'h_2',
          type: 'team',
          set: 1,
          score: '24 - 23',
          label: '💪 Big Block!',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          driveFileId: 'drive_h_2',
          driveUrl: 'https://drive.google.com/file/d/drive_h_2/view',
          fileSizeBytes: 3500000,
          isUploading: false,
          isStarred: true, // Blue filled star for team highlight!
          timestamp: Date.now() - 900000
        },
        {
          id: 'h_3',
          type: 'player',
          set: 2,
          score: '18 - 16',
          label: '💣 Crazy Kill',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          driveFileId: 'drive_h_3',
          driveUrl: 'https://drive.google.com/file/d/drive_h_3/view',
          fileSizeBytes: 3300000,
          isUploading: true, // Show the uploading state requested!
          isStarred: false, // Gold outline for unstarred player highlight!
          timestamp: Date.now() - 60000
        }
      ]
    },
    {
      id: 'match-oct-18',
      date: 'Oct 18, 2026',
      opponent: 'West High',
      isLive: false,
      isFinished: true,
      isArchived: false,
      setsUs: 2,
      setsThem: 1,
      currentSet: 3,
      scoreUs: 15,
      scoreThem: 11,
      highlights: [
        {
          id: 'h_w1',
          type: 'player',
          set: 1,
          score: '19 - 17',
          label: '⛏️ Amazing Dig',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
          driveFileId: 'drive_h_w1',
          driveUrl: 'https://drive.google.com/file/d/drive_h_w1/view',
          fileSizeBytes: 3400000,
          isUploading: false,
          isStarred: false,
          timestamp: 1729267200000
        },
        {
          id: 'h_w2',
          type: 'team',
          set: 3,
          score: '14 - 11',
          label: '🎯 Cool Set',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
          driveFileId: 'drive_h_w2',
          driveUrl: 'https://drive.google.com/file/d/drive_h_w2/view',
          fileSizeBytes: 3600000,
          isUploading: false,
          isStarred: false,
          timestamp: 1729269000000
        }
      ],
      comments: [
        { sender: 'Grandma', text: 'Let\'s go Wildcats! Looking good! 🏐' },
        { sender: 'Game Streamer', text: '🏐 Set 1 Final: US 25 - 21 WEST HIGH', isCheer: true },
        { sender: 'Game Streamer', text: '🏐 Set 2 Final: US 23 - 25 WEST HIGH', isCheer: true },
        { sender: 'Game Streamer', text: '🏐 Set 3 Final: US 15 - 11 WEST HIGH', isCheer: true },
        { sender: 'Uncle Dave', text: 'What a match! Huge win!' }
      ]
    },
    {
      id: 'match-oct-11',
      date: 'Oct 11, 2026',
      opponent: 'East High',
      isLive: false,
      isArchived: true, // Example of match already archived to Google Drive!
      archivedAt: 1728700000000,
      setsUs: 2,
      setsThem: 0,
      currentSet: 2,
      scoreUs: 25,
      scoreThem: 21,
      highlights: [
        {
          id: 'h_e1',
          set: 2,
          score: '24 - 21',
          label: 'Highlight',
          videoUrl: null, // Server copy deleted to save cloud storage!
          serverVideoDeleted: true,
          driveFileId: 'drive_h_e1',
          driveUrl: 'https://drive.google.com/file/d/drive_h_e1/view',
          fileSizeBytes: 3400000,
          isUploading: false,
          timestamp: 1728662400000
        }
      ]
    }
  ],
  chat: [
    { id: 'c1', sender: 'Grandma', text: 'Watching from Ohio! Let\'s go Wildcats! 🏐', timestamp: Date.now() - 120000 },
    { id: 'c2', sender: 'Aunt Sarah', text: 'Great defense! 💪', timestamp: Date.now() - 60000 }
  ],
  recentCheerPill: null
};

class GameStore {
  constructor() {
    this.listeners = new Set();
    this.state = this.loadState();
    this.pointBuffer = null;
    this.initPointBuffers();
  }

  loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const merged = { ...DEFAULT_STATE, ...parsed };
          // If not actively streaming live, reset score ONLY if match was already finished
          if (merged.activeMatch && merged.activeMatch.isFinished) {
            merged.activeMatch.scoreUs = 0;
            merged.activeMatch.scoreThem = 0;
            merged.activeMatch.setsUs = 0;
            merged.activeMatch.setsThem = 0;
            merged.activeMatch.currentSet = 1;
          }
          // Ensure all matches and clips have archive, finished, drive & type properties, and sort highlights chronologically
          for (const match of (merged.matches || [])) {
            match.highlights = sortHighlightsChronologically(match.highlights || []);
            if (typeof match.isArchived === 'undefined') {
              match.isArchived = false;
            }
            if (typeof match.isFinished === 'undefined') {
              match.isFinished = (match.id !== 'demo-live' && !match.isLive);
            }
            for (const clip of (match.highlights || [])) {
              if (!clip.type) clip.type = 'player';
              if (!clip.fileSizeBytes) clip.fileSizeBytes = 3400000;
              if (!clip.driveFileId) clip.driveFileId = 'drive_' + clip.id;
              if (!clip.driveUrl) clip.driveUrl = `https://drive.google.com/file/d/${clip.driveFileId}/view`;
            }
          }
          return merged;
        }
      }
    } catch (e) {
      console.warn('Could not load stored state, using defaults:', e);
    }
    return DEFAULT_STATE;
  }

  saveState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  getState() {
    return this.state;
  }

  // Sync active match scores, sets, and status to matches archive
  syncActiveMatchToArchive(isFinished = false) {
    const m = this.state.activeMatch;
    let matchEntry = this.state.matches.find(item => item.id === m.id);
    if (!matchEntry) {
      matchEntry = {
        id: m.id,
        date: m.date || 'Today',
        opponent: m.opponent,
        teamUs: m.teamUs || 'US',
        teamThem: m.teamThem,
        isLive: m.isLive,
        isFinished: isFinished,
        isArchived: false,
        setsUs: m.setsUs,
        setsThem: m.setsThem,
        currentSet: m.currentSet,
        scoreUs: m.scoreUs,
        scoreThem: m.scoreThem,
        highlights: []
      };
      this.state.matches.unshift(matchEntry);
    } else {
      matchEntry.isLive = m.isLive;
      matchEntry.isFinished = isFinished;
      matchEntry.setsUs = m.setsUs;
      matchEntry.setsThem = m.setsThem;
      matchEntry.currentSet = m.currentSet;
      matchEntry.scoreUs = m.scoreUs;
      matchEntry.scoreThem = m.scoreThem;
      matchEntry.opponent = m.opponent;
    }
    return matchEntry;
  }

  // --- Point Ring-Buffer & 5-Second Grace Period Management ---

  initPointBuffers() {
    const m = this.state.activeMatch || {};
    const now = Date.now();
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
    }
    this.pointBuffer = {
      current: {
        id: 'pt_' + now + '_' + Math.random().toString(36).substr(2, 6),
        set: m.currentSet || 1,
        scoreAtStart: `${m.scoreUs || 0} - ${m.scoreThem || 0}`,
        scoreCurrent: `${m.scoreUs || 0} - ${m.scoreThem || 0}`,
        startTime: now,
        lastScoreActionTimestamp: null,
        pendingHighlight: null
      },
      previous: this.pointBuffer ? this.pointBuffer.previous : null,
      graceTimer: null
    };
  }

  // Called every time the score changes
  onScoreAction(actionTimestamp = Date.now()) {
    if (!this.pointBuffer) this.initPointBuffers();

    const m = this.state.activeMatch;
    const cur = this.pointBuffer.current;

    // Record the timestamp of this latest score update
    cur.lastScoreActionTimestamp = actionTimestamp;
    cur.scoreCurrent = `${m.scoreUs} - ${m.scoreThem}`;

    // Reset 5s grace period timer if running (handles rapid undos/corrections/catch-ups)
    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
      this.pointBuffer.graceTimer = null;
    }

    // 5-second grace period before accepting this time mark as the official highlight closure point
    this.pointBuffer.graceTimer = setTimeout(() => {
      this.finalizePointBoundary();
    }, 5000);
  }

  // Finalizes the current point buffer and rotates it to previousPoint
  finalizePointBoundary() {
    if (!this.pointBuffer) return;
    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
      this.pointBuffer.graceTimer = null;
    }

    const cur = this.pointBuffer.current;
    const m = this.state.activeMatch;
    const endTime = cur.lastScoreActionTimestamp || Date.now();

    const completedPoint = {
      ...cur,
      endTime: endTime,
      finalScore: `${m.scoreUs} - ${m.scoreThem}`,
      finalSet: m.currentSet
    };

    // If broadcaster highlighted "Current Pt." mid-point, finalize and save the clip now!
    if (cur.pendingHighlight) {
      this.saveHighlightClip({
        type: cur.pendingHighlight.type,
        label: cur.pendingHighlight.label,
        set: completedPoint.finalSet,
        score: completedPoint.finalScore,
        videoBlobOrUrl: cur.pendingHighlight.videoBlobOrUrl,
        timestamp: endTime
      });
      cur.pendingHighlight = null;
    }

    // Rotate: completed point becomes previous point
    this.pointBuffer.previous = completedPoint;

    // Start fresh current point
    this.pointBuffer.current = {
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      set: m.currentSet,
      scoreAtStart: `${m.scoreUs} - ${m.scoreThem}`,
      scoreCurrent: `${m.scoreUs} - ${m.scoreThem}`,
      startTime: endTime,
      lastScoreActionTimestamp: null,
      pendingHighlight: null
    };
  }

  // --- Broadcaster Score Controls ---

  // Tap or swipe on the left/right screen
  adjustScore(side, delta) {
    const isUs = (this.state.activeMatch.courtSideUs === side);
    if (isUs) {
      const next = Math.max(0, Number(this.state.activeMatch.scoreUs || 0) + delta);
      this.state.activeMatch.scoreUs = next;
    } else {
      const next = Math.max(0, Number(this.state.activeMatch.scoreThem || 0) + delta);
      this.state.activeMatch.scoreThem = next;
    }
    const now = Date.now();
    this.state.activeMatch.lastScoreTimestamp = now;
    this.syncActiveMatchToArchive(false);
    this.triggerHaptic(delta > 0 ? 'light' : 'double');
    this.saveState();

    // Trigger 5-second grace period on the point buffer
    this.onScoreAction(now);
  }

  resetScores() {
    this.state.activeMatch.scoreUs = 0;
    this.state.activeMatch.scoreThem = 0;
    this.state.activeMatch.lastScoreTimestamp = Date.now();
    this.syncActiveMatchToArchive(false);
    this.initPointBuffers();
    this.triggerHaptic('medium');
    this.saveState();
  }

  swapSides() {
    const cur = this.state.activeMatch.courtSideUs;
    this.state.activeMatch.courtSideUs = cur === 'left' ? 'right' : 'left';
    this.triggerHaptic('medium');
    this.saveState();
  }

  advanceSet() {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }

    const m = this.state.activeMatch;
    const prevSet = m.currentSet;
    const finalUs = m.scoreUs;
    const finalThem = m.scoreThem;
    const winnerName = (finalUs > finalThem) ? 'US' : m.teamThem;

    // Award set to whoever has more points
    if (finalUs > finalThem) {
      m.setsUs += 1;
    } else if (finalThem > finalUs) {
      m.setsThem += 1;
    }

    // Auto-post set score summary to chat so it is permanently logged
    this.state.chat.push({
      id: 'set_summary_' + Date.now(),
      sender: 'Game Streamer',
      text: `🏐 Set ${prevSet} Final: US ${finalUs} - ${finalThem} ${m.teamThem} (${winnerName} wins Set ${prevSet})`,
      set: prevSet,
      score: `${finalUs} - ${finalThem}`,
      timestamp: Date.now(),
      isCheer: true
    });

    m.currentSet += 1;
    m.scoreUs = 0;
    m.scoreThem = 0;
    m.lastScoreTimestamp = Date.now();
    this.syncActiveMatchToArchive(false);
    this.initPointBuffers();
    this.triggerHaptic('heavy');
    this.saveState();
  }

  // Always check 25 points, win by 2
  checkSetVictory() {
    const m = this.state.activeMatch;
    const lead = Math.abs(m.scoreUs - m.scoreThem);
    const maxScore = Math.max(m.scoreUs, m.scoreThem);
    return maxScore >= 25 && lead >= 2;
  }

  // Pause broadcast (match still in progress, can be resumed)
  pauseBroadcast() {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }
    this.state.activeMatch.isLive = false;
    this.state.activeMatch.isFinished = false;
    this.syncActiveMatchToArchive(false);
    this.saveState();
  }

  // Finish match, log final set score, save complete comment transcript to archive
  finishMatch() {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }

    const m = this.state.activeMatch;
    const prevSet = m.currentSet;
    const finalUs = m.scoreUs;
    const finalThem = m.scoreThem;

    // If points were scored in this set, award the set and log it
    if (finalUs > 0 || finalThem > 0) {
      if (finalUs > finalThem) {
        m.setsUs += 1;
      } else if (finalThem > finalUs) {
        m.setsThem += 1;
      }

      this.state.chat.push({
        id: 'set_summary_' + Date.now(),
        sender: 'Game Streamer',
        text: `🏐 Set ${prevSet} Final: US ${finalUs} - ${finalThem} ${m.teamThem}`,
        set: prevSet,
        score: `${finalUs} - ${finalThem}`,
        timestamp: Date.now(),
        isCheer: true
      });
    }

    // Post final match milestone to chat
    const matchWinner = m.setsUs > m.setsThem ? 'US' : m.teamThem;
    this.state.chat.push({
      id: 'match_final_' + Date.now(),
      sender: 'Game Streamer',
      text: `🏆 Match Final: US won ${m.setsUs} set${m.setsUs === 1 ? '' : 's'}, ${m.teamThem} won ${m.setsThem} set${m.setsThem === 1 ? '' : 's'} (${matchWinner} wins match)`,
      timestamp: Date.now(),
      isCheer: true
    });

    m.isLive = false;
    m.isFinished = true;

    // Save complete comment transcript and outcome with the match in archive
    const matchEntry = this.syncActiveMatchToArchive(true);
    matchEntry.comments = [...this.state.chat]; // Full permanent comment transcript!

    this.triggerHaptic('heavy');
    this.saveState();
  }

  // --- Highlights Engine with Player vs Team & Current vs Previous Point ---

  // Trigger point highlight (current or previous point, player or team)
  triggerPointHighlight({ type = 'player', label = 'Highlight', target = 'current', videoBlobOrUrl = null }) {
    if (!this.pointBuffer) this.initPointBuffers();

    const m = this.state.activeMatch;

    if (target === 'previous') {
      const prev = this.pointBuffer.previous;
      if (prev) {
        return this.saveHighlightClip({
          type,
          label,
          set: prev.finalSet || prev.set || m.currentSet,
          score: prev.finalScore || prev.scoreCurrent || `${m.scoreUs} - ${m.scoreThem}`,
          videoBlobOrUrl,
          timestamp: prev.endTime || Date.now()
        });
      } else {
        // Fallback if no previous point exists yet (first rally of match)
        return this.saveHighlightClip({
          type,
          label,
          set: m.currentSet,
          score: `${m.scoreUs} - ${m.scoreThem}`,
          videoBlobOrUrl,
          timestamp: Date.now()
        });
      }
    } else {
      // Current point highlight:
      const cur = this.pointBuffer.current;
      cur.pendingHighlight = {
        type,
        label,
        videoBlobOrUrl,
        requestedAt: Date.now()
      };

      // Auto-post highlight event to chat so viewers see it immediately
      this.state.chat.push({
        id: 'c_' + Date.now(),
        sender: 'Broadcaster',
        text: `⚡ ${type === 'player' ? 'Player' : 'Team'} Highlight: ${label}`,
        set: m.currentSet,
        score: `${m.scoreUs} - ${m.scoreThem}`,
        timestamp: Date.now(),
        isCheer: true
      });
      this.saveState();
      this.triggerHaptic('double');

      return {
        isPending: true,
        type,
        label,
        target: 'current'
      };
    }
  }

  // Save highlight clip to match archive
  saveHighlightClip({ type = 'player', label = 'Highlight', set = 1, score = '0 - 0', videoBlobOrUrl = null, timestamp = Date.now() }) {
    const m = this.state.activeMatch;
    const clipId = 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const driveId = 'drive_' + clipId;
    const driveFolderUrl = this.getDriveLocation();
    const newClip = {
      id: clipId,
      type: type, // 'player' or 'team'
      set: set,
      score: score,
      label: label,
      videoUrl: videoBlobOrUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      driveFileId: driveId,
      driveUrl: `https://drive.google.com/file/d/${driveId}/view`,
      driveFolderUrl: driveFolderUrl,
      fileSizeBytes: 3400000,
      isUploading: true,
      isStarred: false,
      timestamp: timestamp
    };

    // Find current active match in matches list or add it
    let matchEntry = this.state.matches.find(item => item.id === m.id);
    if (!matchEntry) {
      matchEntry = this.syncActiveMatchToArchive(false);
    }

    matchEntry.highlights.push(newClip);
    matchEntry.highlights = sortHighlightsChronologically(matchEntry.highlights);
    this.triggerHaptic('double');
    this.saveState();

    // Auto-post to chat if not already queued
    const alreadyPosted = this.state.chat.some(c => c.text && c.text.includes(label) && Date.now() - c.timestamp < 6000);
    if (!alreadyPosted) {
      this.state.chat.push({
        id: 'c_' + Date.now(),
        sender: 'Broadcaster',
        text: `⚡ ${type === 'player' ? 'Player' : 'Team'} Highlight: ${label}`,
        set: set,
        score: score,
        timestamp: Date.now(),
        isCheer: true
      });
      this.saveState();
    }

    // Simulate background throttled upload finishing after 4 seconds
    setTimeout(() => {
      newClip.isUploading = false;
      this.saveState();
    }, 4000);

    return newClip;
  }

  // Backwards compatibility alias for triggerHighlight
  triggerHighlight(chosenLabel = null, videoBlobOrUrl = null, type = 'player') {
    return this.saveHighlightClip({
      type,
      label: chosenLabel || 'Highlight',
      set: this.state.activeMatch.currentSet,
      score: `${this.state.activeMatch.scoreUs} - ${this.state.activeMatch.scoreThem}`,
      videoBlobOrUrl
    });
  }

  toggleStarHighlight(matchId, clipId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return false;
    const clip = (match.highlights || []).find(c => c.id === clipId);
    if (!clip) return false;

    clip.isStarred = !clip.isStarred;
    this.triggerHaptic('light');
    this.saveState();
    return {
      isStarred: clip.isStarred,
      type: clip.type || 'player'
    };
  }

  // --- Chat & Cheer Drawer ---

  postCheerPill(pillText) {
    const m = this.state.activeMatch;
    const cheerObj = {
      id: 'c_' + Date.now(),
      sender: 'Broadcaster',
      text: pillText,
      set: m.currentSet,
      score: `${m.scoreUs} - ${m.scoreThem}`,
      timestamp: Date.now(),
      isCheer: true
    };
    this.state.recentCheerPill = cheerObj;
    this.state.chat.push(cheerObj);
    this.triggerHaptic('light');
    this.saveState();

    // Auto-clear recentCheerPill after 20s if no highlight was pressed
    setTimeout(() => {
      if (this.state.recentCheerPill === cheerObj) {
        this.state.recentCheerPill = null;
      }
    }, 20000);
  }

  postChatMessage(sender, text) {
    if (!text || !text.trim()) return;
    this.state.chat.push({
      id: 'c_' + Date.now(),
      sender: sender || 'Viewer',
      text: text.trim(),
      timestamp: Date.now()
    });
    this.saveState();
  }

  // --- Streamer Lifecycle ---

  resumeMatch(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return;

    this.state.activeMatch = {
      id: match.id,
      isLive: true,
      isFinished: false,
      date: match.date || 'Today',
      opponent: match.opponent,
      teamUs: match.teamUs || 'US',
      teamThem: (match.opponent || 'OPPONENT').toUpperCase(),
      courtSideUs: 'left',
      scoreUs: match.scoreUs || 0,
      scoreThem: match.scoreThem || 0,
      setsUs: match.setsUs || 0,
      setsThem: match.setsThem || 0,
      currentSet: match.currentSet || 1,
      lastScoreTimestamp: Date.now(),
      viewers: 1
    };
    match.isLive = true;
    match.isFinished = false;
    this.initPointBuffers();
    this.saveState();
  }

  startBroadcast(opponentName = 'Opponent', options = {}) {
    if (options.resumeMatchId) {
      this.resumeMatch(options.resumeMatchId);
      return;
    }

    const oppUpper = (opponentName || 'OPPONENT').toUpperCase();
    const newMatchId = 'match_' + Date.now();
    const startingSet = Math.max(1, parseInt(options.startingSet, 10) || 1);
    const setsUs = Math.max(0, parseInt(options.setsUs, 10) || 0);
    const setsThem = Math.max(0, parseInt(options.setsThem, 10) || 0);

    this.state.activeMatch = {
      id: newMatchId,
      opponent: opponentName,
      teamUs: 'US',
      teamThem: oppUpper,
      courtSideUs: 'left',
      isLive: true,
      isFinished: false,
      date: 'Today',
      scoreUs: 0,
      scoreThem: 0,
      setsUs: setsUs,
      setsThem: setsThem,
      currentSet: startingSet,
      lastScoreTimestamp: Date.now(),
      viewers: 1
    };

    this.state.matches.unshift({
      id: newMatchId,
      date: 'Today',
      opponent: opponentName,
      teamUs: 'US',
      teamThem: oppUpper,
      isLive: true,
      isFinished: false,
      isArchived: false,
      setsUs: setsUs,
      setsThem: setsThem,
      currentSet: startingSet,
      scoreUs: 0,
      scoreThem: 0,
      highlights: []
    });

    this.initPointBuffers();
    this.saveState();
  }

  startDemoStream() {
    this.state.activeMatch = {
      id: 'demo-live',
      isLive: true,
      isFinished: false,
      date: 'Today',
      opponent: 'Lincoln High',
      teamUs: 'US',
      teamThem: 'LINCOLN',
      courtSideUs: 'left',
      scoreUs: 18,
      scoreThem: 16,
      setsUs: 1,
      setsThem: 0,
      currentSet: 2,
      lastScoreTimestamp: Date.now(),
      viewers: 3
    };
    const demo = this.state.matches.find(m => m.id === 'demo-live');
    if (demo) {
      demo.isLive = true;
      demo.isFinished = false;
    }
    this.initPointBuffers();
    this.saveState();
  }

  stopBroadcast() {
    this.pauseBroadcast();
  }

  // --- Server Storage & Google Drive Archiving ---

  getServerStorageStats() {
    const FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024; // 5.0 GB Free Allowance
    let usedBytes = 0;
    let activeClipsCount = 0;
    let archivedClipsCount = 0;
    let activeMatchesCount = 0;
    let archivedMatchesCount = 0;

    for (const match of this.state.matches) {
      if (match.isArchived) {
        archivedMatchesCount++;
        for (const clip of (match.highlights || [])) {
          archivedClipsCount++;
        }
      } else {
        activeMatchesCount++;
        for (const clip of (match.highlights || [])) {
          if (!clip.serverVideoDeleted && clip.videoUrl) {
            const size = clip.fileSizeBytes || 3400000;
            usedBytes += size;
            activeClipsCount++;
          }
        }
      }
    }

    const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
    const percentNum = (usedBytes / FREE_TIER_BYTES) * 100;
    const percentUsed = percentNum < 0.1 && percentNum > 0 ? '0.1' : percentNum.toFixed(1);

    return {
      usedBytes,
      maxBytes: FREE_TIER_BYTES,
      usedMB,
      maxGB: '5.0 GB',
      percentUsed,
      activeMatchesCount,
      archivedMatchesCount,
      activeClipsCount,
      archivedClipsCount
    };
  }

  archiveMatch(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match || match.isArchived) return 0;

    let freedBytes = 0;
    match.isArchived = true;
    match.archivedAt = Date.now();

    for (const clip of (match.highlights || [])) {
      if (clip.videoUrl) {
        freedBytes += clip.fileSizeBytes || 3400000;
      }
      clip.serverVideoDeleted = true;
      clip.videoUrl = null; // Server copy purged to reclaim cloud space
      clip.driveFileId = clip.driveFileId || ('drive_' + clip.id);
      clip.driveUrl = clip.driveUrl || `https://drive.google.com/file/d/${clip.driveFileId}/view`;
    }

    this.triggerHaptic('medium');
    this.saveState();
    return freedBytes;
  }

  unarchiveMatch(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match || !match.isArchived) return;

    match.isArchived = false;
    match.archivedAt = null;

    // Restore server video reference
    for (const clip of (match.highlights || [])) {
      clip.serverVideoDeleted = false;
      clip.videoUrl = clip.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    }

    this.triggerHaptic('light');
    this.saveState();
  }

  // --- Google Drive Persistent Location & Safe Fallback ---
  getDriveLocation() {
    if (this.state && this.state.driveFolderUrl && this.state.driveFolderUrl.trim()) {
      return this.state.driveFolderUrl.trim();
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('gamestreamer_drive_folder_url');
        if (saved && saved.trim()) {
          if (this.state) this.state.driveFolderUrl = saved.trim();
          return saved.trim();
        }
      }
    } catch (e) {}
    // Guaranteed default location so highlights always have a backup target
    return 'https://drive.google.com/drive/my-drive';
  }

  setDriveLocation(url) {
    if (!url) return;
    const clean = url.trim();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gamestreamer_drive_folder_url', clean);
      }
      this.state.driveFolderUrl = clean;
    } catch (e) {}
    this.saveState();
  }

  // --- Broadcaster-Only Archive Highlight Deletion ---
  deleteHighlight(matchId, clipId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match || !match.highlights) return false;

    const clipIndex = match.highlights.findIndex(h => h.id === clipId);
    if (clipIndex === -1) return false;

    const [deletedClip] = match.highlights.splice(clipIndex, 1);

    // If activeMatch matches, sync its highlights list too
    if (this.state.activeMatch && this.state.activeMatch.id === matchId && this.state.activeMatch.highlights) {
      const activeIdx = this.state.activeMatch.highlights.findIndex(h => h.id === clipId);
      if (activeIdx !== -1) {
        this.state.activeMatch.highlights.splice(activeIdx, 1);
      }
    }

    // Revoke any blob URL if present to free memory
    if (deletedClip && deletedClip.videoUrl && deletedClip.videoUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(deletedClip.videoUrl);
      } catch (e) {}
    }

    this.triggerHaptic('medium');
    this.saveState();
    return true;
  }

  // Haptic feedback (supported on iOS 13+ & Android)
  triggerHaptic(type = 'light') {
    try {
      if (navigator.vibrate) {
        if (type === 'light') navigator.vibrate(20);
        else if (type === 'medium') navigator.vibrate(40);
        else if (type === 'double') navigator.vibrate([25, 40, 25]);
        else if (type === 'heavy') navigator.vibrate(70);
      }
    } catch (e) {
      // Ignore vibration error
    }
  }
}

export const store = new GameStore();
