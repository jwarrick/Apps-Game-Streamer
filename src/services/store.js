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

// Format tennis points (0 -> "0", 1 -> "15", 2 -> "30", 3 -> "40", 4 -> "AD")
export function getTennisPointDisplay(pointsUs, pointsThem, isTiebreak, scoringType = 'ad') {
  if (isTiebreak) {
    return {
      us: String(pointsUs != null ? pointsUs : 0),
      them: String(pointsThem != null ? pointsThem : 0),
      isDeuce: false,
      isTiebreak: true
    };
  }
  const pUs = pointsUs || 0;
  const pThem = pointsThem || 0;
  const pointLabels = ['0', '15', '30', '40'];

  if (pUs >= 3 && pThem >= 3) {
    if (pUs === pThem) {
      return { us: '40', them: '40', isDeuce: true, isTiebreak: false };
    }
    if (scoringType === 'ad') {
      if (pUs === 4 && pThem === 3) {
        return { us: 'AD', them: '40', isDeuce: false, isTiebreak: false };
      }
      if (pThem === 4 && pUs === 3) {
        return { us: '40', them: 'AD', isDeuce: false, isTiebreak: false };
      }
    }
  }

  return {
    us: pointLabels[pUs] || '40',
    them: pointLabels[pThem] || '40',
    isDeuce: false,
    isTiebreak: false
  };
}

// Format tennis set scores array into readable string (e.g. "6-4, 3-6, 7-6(4)")
export function formatTennisSetScores(setScores = []) {
  if (!setScores || setScores.length === 0) return '';
  return setScores.map(s => {
    if (s.isUnknown || s.score === '?' || (s.us === '?' && s.them === '?')) {
      return '?';
    }
    if (s.isTiebreakOnly) {
      return `[${s.us}-${s.them}]`;
    }
    if (s.tiebreakScore !== undefined) {
      return `${s.us}-${s.them}(${s.tiebreakScore})`;
    }
    if (s.us !== undefined && s.them !== undefined) {
      return `${s.us}-${s.them}`;
    }
    return s.score || '';
  }).filter(Boolean).join(', ');
}

// Initial state with realistic demo matches so the app is immediately beautiful and testable
const DEFAULT_STATE = {
  activeMatch: {
    id: 'demo-live',
    sport: 'volleyball', // 'volleyball' or 'tennis'
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
    viewers: 1,
    // Tennis specific state
    gamesUs: 0,
    gamesThem: 0,
    pointsUs: 0,
    pointsThem: 0,
    server: 'us', // 'us' or 'them'
    tennisScoringType: 'ad', // 'ad' or 'no-ad'
    currentSetFormat: 'standard', // 'standard', 'pro-set-8', 'tiebreak-10', 'tiebreak-7'
    isTiebreak: false,
    tiebreakTarget: 7,
    tiebreakInitialServer: 'us',
    setScores: [], // [{ set: 1, us: 6, them: 4 }, ...]
    setFinished: false,
    ringBufferDuration: 20
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
          label: '🪏 Amazing Dig',
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
    },
    {
      id: 'match-tennis-oct-19',
      sport: 'tennis',
      date: 'Oct 19, 2026',
      opponent: 'St. Marks Academy',
      teamUs: 'US',
      teamThem: 'ST. MARKS',
      isLive: false,
      isFinished: true,
      isArchived: false,
      setsUs: 2,
      setsThem: 1,
      currentSet: 3,
      currentSetFormat: 'tiebreak-10',
      setScores: [
        { set: 1, us: 6, them: 4, winner: 'us' },
        { set: 2, us: 4, them: 6, winner: 'them' },
        { set: 3, us: 10, them: 8, winner: 'us', isTiebreakOnly: true }
      ],
      highlights: [
        {
          id: 'h_t1',
          type: 'player',
          set: 1,
          score: 'G:5-4 (40-30)',
          label: '🔥 Sweet Serve',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          driveFileId: 'drive_h_t1',
          driveUrl: 'https://drive.google.com/file/d/drive_h_t1/view',
          fileSizeBytes: 3500000,
          isUploading: false,
          isStarred: true,
          timestamp: 1729353600000
        },
        {
          id: 'h_t2',
          type: 'team',
          set: 2,
          score: 'G:3-4 (30-40)',
          label: '💪 Killer Forehand',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          driveFileId: 'drive_h_t2',
          driveUrl: 'https://drive.google.com/file/d/drive_h_t2/view',
          fileSizeBytes: 3400000,
          isUploading: false,
          isStarred: false,
          timestamp: 1729355400000
        },
        {
          id: 'h_t3',
          type: 'player',
          set: 3,
          score: 'TB:9-8',
          label: '↩️ Blistering Return',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          driveFileId: 'drive_h_t3',
          driveUrl: 'https://drive.google.com/file/d/drive_h_t3/view',
          fileSizeBytes: 3600000,
          isUploading: false,
          isStarred: true,
          timestamp: 1729357200000
        }
      ],
      comments: [
        { sender: 'Grandma', text: 'Watching the tennis match! Great forehands! 🎾' },
        { sender: 'Game Streamer', text: '🎾 Set 1 Final: US 6 - 4 ST. MARKS (US wins Set 1)', isCheer: true },
        { sender: 'Game Streamer', text: '🎾 Set 2 Final: US 4 - 6 ST. MARKS (ST. MARKS wins Set 2)', isCheer: true },
        { sender: 'Game Streamer', text: '🏆 Tennis Match Final: US wins! (6-4, 4-6, [10-8])', isCheer: true }
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
          // Ensure activeMatch has all tennis fields initialized
          if (merged.activeMatch) {
            merged.activeMatch.sport = merged.activeMatch.sport || 'volleyball';
            if (merged.activeMatch.gamesUs === undefined) merged.activeMatch.gamesUs = 0;
            if (merged.activeMatch.gamesThem === undefined) merged.activeMatch.gamesThem = 0;
            if (merged.activeMatch.pointsUs === undefined) merged.activeMatch.pointsUs = 0;
            if (merged.activeMatch.pointsThem === undefined) merged.activeMatch.pointsThem = 0;
            if (!merged.activeMatch.server) merged.activeMatch.server = 'us';
            if (!merged.activeMatch.tennisScoringType) merged.activeMatch.tennisScoringType = 'ad';
            if (!merged.activeMatch.currentSetFormat) merged.activeMatch.currentSetFormat = 'standard';
            if (!merged.activeMatch.setScores) merged.activeMatch.setScores = [];
          }

          // If not actively streaming live, reset score ONLY if match was already finished
          if (merged.activeMatch && merged.activeMatch.isFinished) {
            merged.activeMatch.scoreUs = 0;
            merged.activeMatch.scoreThem = 0;
            merged.activeMatch.setsUs = 0;
            merged.activeMatch.setsThem = 0;
            merged.activeMatch.currentSet = 1;
            merged.activeMatch.gamesUs = 0;
            merged.activeMatch.gamesThem = 0;
            merged.activeMatch.pointsUs = 0;
            merged.activeMatch.pointsThem = 0;
            merged.activeMatch.setScores = [];
          }

          // Ensure demo tennis match is available in archive
          if (!merged.matches.some(m => m.id === 'match-tennis-oct-19')) {
            const demoTennis = DEFAULT_STATE.matches.find(m => m.id === 'match-tennis-oct-19');
            if (demoTennis) merged.matches.push(demoTennis);
          }

          // Ensure all matches and clips have archive, finished, drive & type properties, and sort highlights chronologically
          for (const match of (merged.matches || [])) {
            match.sport = match.sport || 'volleyball';
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
        sport: m.sport || 'volleyball',
        date: m.date || 'Today',
        opponent: m.opponent,
        teamUs: m.teamUs || 'US',
        teamThem: m.teamThem,
        isLive: m.isLive,
        isFinished: isFinished,
        isArchived: false,
        setsUs: m.setsUs || 0,
        setsThem: m.setsThem || 0,
        currentSet: m.currentSet || 1,
        scoreUs: m.scoreUs || 0,
        scoreThem: m.scoreThem || 0,
        gamesUs: m.gamesUs || 0,
        gamesThem: m.gamesThem || 0,
        pointsUs: m.pointsUs || 0,
        pointsThem: m.pointsThem || 0,
        server: m.server || 'us',
        tennisScoringType: m.tennisScoringType || 'ad',
        currentSetFormat: m.currentSetFormat || 'standard',
        isTiebreak: !!m.isTiebreak,
        tiebreakTarget: m.tiebreakTarget || 7,
        tiebreakInitialServer: m.tiebreakInitialServer || m.server || 'us',
        setScores: m.setScores ? [...m.setScores] : [],
        setFinished: !!m.setFinished,
        ringBufferDuration: m.ringBufferDuration || (m.sport === 'tennis' ? 30 : 20),
        winner: m.winner || null,
        highlights: []
      };
      this.state.matches.unshift(matchEntry);
    } else {
      matchEntry.sport = m.sport || matchEntry.sport || 'volleyball';
      matchEntry.isLive = m.isLive;
      matchEntry.isFinished = isFinished;
      matchEntry.setsUs = m.setsUs;
      matchEntry.setsThem = m.setsThem;
      matchEntry.currentSet = m.currentSet;
      matchEntry.scoreUs = m.scoreUs;
      matchEntry.scoreThem = m.scoreThem;
      matchEntry.gamesUs = m.gamesUs || 0;
      matchEntry.gamesThem = m.gamesThem || 0;
      matchEntry.pointsUs = m.pointsUs || 0;
      matchEntry.pointsThem = m.pointsThem || 0;
      matchEntry.server = m.server || 'us';
      matchEntry.tennisScoringType = m.tennisScoringType || 'ad';
      matchEntry.currentSetFormat = m.currentSetFormat || 'standard';
      matchEntry.isTiebreak = !!m.isTiebreak;
      matchEntry.tiebreakTarget = m.tiebreakTarget || 7;
      matchEntry.tiebreakInitialServer = m.tiebreakInitialServer || matchEntry.tiebreakInitialServer || 'us';
      matchEntry.setScores = m.setScores ? [...m.setScores] : (matchEntry.setScores || []);
      matchEntry.setFinished = !!m.setFinished;
      matchEntry.opponent = m.opponent;
      matchEntry.ringBufferDuration = m.ringBufferDuration || (m.sport === 'tennis' ? 30 : 20);
      matchEntry.winner = m.winner || matchEntry.winner || null;
    }
    return matchEntry;
  }

  // Helper: Return concise score summary string for highlights and point buffers
  getScoreSummaryString() {
    const m = this.state.activeMatch;
    if (m.sport === 'tennis') {
      const ptDisplay = getTennisPointDisplay(m.pointsUs, m.pointsThem, m.isTiebreak, m.tennisScoringType);
      if (m.isTiebreak) {
        return `G:${m.gamesUs}-${m.gamesThem} TB:${ptDisplay.us}-${ptDisplay.them}`;
      }
      return `G:${m.gamesUs}-${m.gamesThem} (${ptDisplay.us}-${ptDisplay.them})`;
    }
    return `${m.scoreUs} - ${m.scoreThem}`;
  }

  // --- Point Ring-Buffer & 5-Second Grace Period Management ---

  initPointBuffers() {
    const m = this.state.activeMatch || {};
    const now = Date.now();
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
    }
    const scoreSummary = this.getScoreSummaryString();
    this.pointBuffer = {
      current: {
        id: 'pt_' + now + '_' + Math.random().toString(36).substr(2, 6),
        set: m.currentSet || 1,
        scoreAtStart: scoreSummary,
        scoreCurrent: scoreSummary,
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
    cur.scoreCurrent = this.getScoreSummaryString();

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
    const finalScore = this.getScoreSummaryString();

    const completedPoint = {
      ...cur,
      endTime: endTime,
      finalScore: finalScore,
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
      scoreAtStart: finalScore,
      scoreCurrent: finalScore,
      startTime: endTime,
      lastScoreActionTimestamp: null,
      pendingHighlight: null
    };
  }

  // --- Broadcaster Score Controls ---

  // Tap or swipe on the left/right screen
  adjustScore(side, delta) {
    if (this.state.activeMatch.sport === 'tennis') {
      this.adjustScoreTennis(side, delta);
      return;
    }

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

  // Tennis Scoring Engine (Points -> Games -> Sets with Tiebreaks and Server Rotation)
  adjustScoreTennis(side, delta) {
    const m = this.state.activeMatch;
    const isUs = (m.courtSideUs === side);
    const now = Date.now();

    // 1. Point Undo / Decrement
    if (delta < 0) {
      if (m.isTiebreak) {
        if (isUs && m.pointsUs > 0) m.pointsUs -= 1;
        if (!isUs && m.pointsThem > 0) m.pointsThem -= 1;
        // Recalculate tiebreak server
        const total = m.pointsUs + m.pointsThem;
        const initial = m.tiebreakInitialServer || 'us';
        const other = initial === 'us' ? 'them' : 'us';
        const mod = total % 4;
        m.server = (mod === 1 || mod === 2) ? other : initial;
      } else {
        if (isUs) {
          if (m.pointsUs === 4 && m.pointsThem === 3) {
            m.pointsUs = 3; // US drops from AD to Deuce
          } else {
            m.pointsUs = Math.max(0, m.pointsUs - 1);
          }
        } else {
          if (m.pointsThem === 4 && m.pointsUs === 3) {
            m.pointsThem = 3; // Opponent drops from AD to Deuce
          } else {
            m.pointsThem = Math.max(0, m.pointsThem - 1);
          }
        }
      }
      m.setFinished = false;
      m.lastScoreTimestamp = now;
      this.syncActiveMatchToArchive(false);
      this.triggerHaptic('double');
      this.saveState();
      this.onScoreAction(now);
      return;
    }

    // 2. Point Increment (+1)
    if (m.isTiebreak) {
      if (isUs) m.pointsUs += 1;
      else m.pointsThem += 1;

      const target = m.tiebreakTarget || 7;
      const winnerPts = isUs ? m.pointsUs : m.pointsThem;
      const loserPts = isUs ? m.pointsThem : m.pointsUs;
      const diff = winnerPts - loserPts;

      if (winnerPts >= target && diff >= 2) {
        // Tiebreak won!
        if (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'match_tiebreak_10' || m.currentSetFormat === 'tiebreak-7' || m.currentSetFormat === 'tiebreak_7') {
          // Tiebreak-only set (e.g. match tiebreak)
          m.setScores = m.setScores || [];
          m.setScores.push({
            set: m.currentSet,
            setNumber: m.currentSet,
            us: m.pointsUs,
            them: m.pointsThem,
            score: `[${m.pointsUs}-${m.pointsThem}]`,
            winner: isUs ? 'us' : 'them',
            isTiebreakOnly: true
          });
          if (isUs) m.setsUs += 1;
          else m.setsThem += 1;
          m.setFinished = true;
        } else {
          // Set tiebreak at 6-6 (or 8-8)
          if (isUs) m.gamesUs += 1;
          else m.gamesThem += 1;

          m.setScores = m.setScores || [];
          m.setScores.push({
            set: m.currentSet,
            setNumber: m.currentSet,
            us: m.gamesUs,
            them: m.gamesThem,
            score: `${m.gamesUs}-${m.gamesThem}`,
            winner: isUs ? 'us' : 'them',
            tiebreakScore: `${loserPts}`
          });
          if (isUs) m.setsUs += 1;
          else m.setsThem += 1;
          m.setFinished = true;
        }

        const setWinnerName = isUs ? 'US' : (m.opponent || 'OPPONENT').toUpperCase();
        this.state.chat.push({
          id: 'set_summary_' + Date.now(),
          sender: 'Game Streamer',
          text: `🎾 Set ${m.currentSet} Final: US ${m.gamesUs || m.pointsUs} - ${m.gamesThem || m.pointsThem} (${setWinnerName} wins Set ${m.currentSet})`,
          set: m.currentSet,
          score: `${m.gamesUs || m.pointsUs} - ${m.gamesThem || m.pointsThem}`,
          timestamp: Date.now(),
          isCheer: true
        });

        // Rotate server for the next set (receiver of tiebreak serves game 1 of next set)
        const initial = m.tiebreakInitialServer || 'us';
        m.server = (initial === 'us' ? 'them' : 'us');
      } else {
        // Tiebreak ongoing - update server rotation
        const total = m.pointsUs + m.pointsThem;
        const initial = m.tiebreakInitialServer || 'us';
        const other = initial === 'us' ? 'them' : 'us';
        const mod = total % 4;
        m.server = (mod === 1 || mod === 2) ? other : initial;
      }
    } else {
      // Normal game play
      let gameWon = false;
      const scoring = m.tennisScoringType || 'ad';

      if (scoring === 'no-ad') {
        if (isUs) {
          if (m.pointsUs === 3 && m.pointsThem === 3) {
            gameWon = true; // Deciding point at 40-40 Deuce!
          } else if (m.pointsUs === 3) {
            gameWon = true;
          } else {
            m.pointsUs += 1;
          }
        } else {
          if (m.pointsThem === 3 && m.pointsUs === 3) {
            gameWon = true; // Deciding point at 40-40 Deuce!
          } else if (m.pointsThem === 3) {
            gameWon = true;
          } else {
            m.pointsThem += 1;
          }
        }
      } else {
        // Standard Advantage (Ad) scoring
        if (isUs) {
          if (m.pointsUs < 3) {
            m.pointsUs += 1;
          } else if (m.pointsUs === 3 && m.pointsThem < 3) {
            gameWon = true;
          } else if (m.pointsUs === 3 && m.pointsThem === 3) {
            m.pointsUs = 4; // Deuce -> US Ad-In
          } else if (m.pointsUs === 4 && m.pointsThem === 3) {
            gameWon = true; // US had Ad and scores -> Game!
          } else if (m.pointsUs === 3 && m.pointsThem === 4) {
            m.pointsThem = 3; // THEM had Ad, US scores -> Back to Deuce (3-3)
          }
        } else {
          if (m.pointsThem < 3) {
            m.pointsThem += 1;
          } else if (m.pointsThem === 3 && m.pointsUs < 3) {
            gameWon = true;
          } else if (m.pointsThem === 3 && m.pointsUs === 3) {
            m.pointsThem = 4; // Deuce -> THEM Ad-Out
          } else if (m.pointsThem === 4 && m.pointsUs === 3) {
            gameWon = true; // THEM had Ad and scores -> Game!
          } else if (m.pointsThem === 3 && m.pointsUs === 4) {
            m.pointsUs = 3; // US had Ad, THEM scores -> Back to Deuce (3-3)
          }
        }
      }

      if (gameWon) {
        m.pointsUs = 0;
        m.pointsThem = 0;
        if (isUs) m.gamesUs += 1;
        else m.gamesThem += 1;

        // Rotate server after each completed game
        m.server = (m.server === 'us' ? 'them' : 'us');

        // Check Set win / tiebreak conditions
        const fmt = m.currentSetFormat || 'standard';
        if (fmt === 'standard') {
          if (m.gamesUs === 6 && m.gamesThem === 6) {
            // Set tiebreak reached at 6-6!
            m.isTiebreak = true;
            m.tiebreakTarget = 7;
            m.tiebreakInitialServer = m.server;
          } else if ((m.gamesUs >= 6 || m.gamesThem >= 6) && Math.abs(m.gamesUs - m.gamesThem) >= 2) {
            // Set Won!
            const setWinner = m.gamesUs > m.gamesThem ? 'us' : 'them';
            m.setScores = m.setScores || [];
            m.setScores.push({
              set: m.currentSet,
              setNumber: m.currentSet,
              us: m.gamesUs,
              them: m.gamesThem,
              score: `${m.gamesUs}-${m.gamesThem}`,
              winner: setWinner
            });
            if (setWinner === 'us') m.setsUs += 1;
            else m.setsThem += 1;
            m.setFinished = true;

            const winnerName = setWinner === 'us' ? 'US' : (m.opponent || 'OPPONENT').toUpperCase();
            this.state.chat.push({
              id: 'set_summary_' + Date.now(),
              sender: 'Game Streamer',
              text: `🎾 Set ${m.currentSet} Final: US ${m.gamesUs} - ${m.gamesThem} (${winnerName} wins Set ${m.currentSet})`,
              set: m.currentSet,
              score: `${m.gamesUs} - ${m.gamesThem}`,
              timestamp: Date.now(),
              isCheer: true
            });
          }
        } else if (fmt === 'pro-set-8' || fmt === 'pro8') {
          if (m.gamesUs === 8 && m.gamesThem === 8) {
            // Tiebreak reached at 8-8!
            m.isTiebreak = true;
            m.tiebreakTarget = 7;
            m.tiebreakInitialServer = m.server;
          } else if ((m.gamesUs >= 8 || m.gamesThem >= 8) && Math.abs(m.gamesUs - m.gamesThem) >= 2) {
            const setWinner = m.gamesUs > m.gamesThem ? 'us' : 'them';
            m.setScores = m.setScores || [];
            m.setScores.push({
              set: m.currentSet,
              setNumber: m.currentSet,
              us: m.gamesUs,
              them: m.gamesThem,
              score: `${m.gamesUs}-${m.gamesThem}`,
              winner: setWinner
            });
            if (setWinner === 'us') m.setsUs += 1;
            else m.setsThem += 1;
            m.setFinished = true;

            const winnerName = setWinner === 'us' ? 'US' : (m.opponent || 'OPPONENT').toUpperCase();
            this.state.chat.push({
              id: 'set_summary_' + Date.now(),
              sender: 'Game Streamer',
              text: `🎾 Pro Set Final: US ${m.gamesUs} - ${m.gamesThem} (${winnerName} wins Set)`,
              set: m.currentSet,
              score: `${m.gamesUs} - ${m.gamesThem}`,
              timestamp: Date.now(),
              isCheer: true
            });
          }
        }
      }
    }

    m.lastScoreTimestamp = now;
    this.syncActiveMatchToArchive(false);
    this.triggerHaptic(delta > 0 ? 'light' : 'double');
    this.saveState();

    // Trigger 5-second grace period on point buffer
    this.onScoreAction(now);
  }

  // Start next tennis set on demand with chosen format
  startNextTennisSet(format = 'standard') {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }
    const m = this.state.activeMatch;

    const isTB10 = (format === 'tiebreak-10' || format === 'match_tiebreak_10');
    const isTB7 = (format === 'tiebreak-7' || format === 'tiebreak_7');

    // If set was not yet recorded in setScores, record it now
    if (!m.setFinished && (m.gamesUs > 0 || m.gamesThem > 0 || m.pointsUs > 0 || m.pointsThem > 0)) {
      const setWinner = m.gamesUs > m.gamesThem ? 'us' : (m.gamesThem > m.gamesUs ? 'them' : null);
      const wasTBOnly = (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'match_tiebreak_10' || m.currentSetFormat === 'tiebreak-7' || m.currentSetFormat === 'tiebreak_7');
      m.setScores = m.setScores || [];
      const finalUs = m.isTiebreak ? m.pointsUs : m.gamesUs;
      const finalThem = m.isTiebreak ? m.pointsThem : m.gamesThem;
      m.setScores.push({
        set: m.currentSet,
        setNumber: m.currentSet,
        us: finalUs,
        them: finalThem,
        score: wasTBOnly ? `[${finalUs}-${finalThem}]` : `${finalUs}-${finalThem}`,
        winner: setWinner,
        isTiebreakOnly: wasTBOnly
      });
      if (setWinner === 'us') m.setsUs += 1;
      else if (setWinner === 'them') m.setsThem += 1;
    }

    const nextSetNum = (m.currentSet || 1) + 1;
    m.currentSet = nextSetNum;
    m.currentSetFormat = format;
    m.gamesUs = 0;
    m.gamesThem = 0;
    m.pointsUs = 0;
    m.pointsThem = 0;
    m.isTiebreak = isTB10 || isTB7;
    m.tiebreakTarget = isTB10 ? 10 : 7;
    m.setFinished = false;

    // Normal tennis server rotation to start next set
    m.server = (m.server === 'us' ? 'them' : 'us');
    m.tiebreakInitialServer = m.server;

    const formatLabels = {
      'standard': 'Standard 6-Game Set',
      'pro-set-8': '8-Game Pro Set',
      'tiebreak-10': '10-Point Match Tiebreak',
      'tiebreak-7': '7-Point Tiebreak'
    };
    const fName = formatLabels[format] || format;

    this.state.chat.push({
      id: 'set_start_' + Date.now(),
      sender: 'Game Streamer',
      text: `🎾 Starting Set ${nextSetNum} (${fName})`,
      set: nextSetNum,
      timestamp: Date.now(),
      isCheer: true
    });

    m.lastScoreTimestamp = Date.now();
    this.syncActiveMatchToArchive(false);
    this.initPointBuffers();
    this.triggerHaptic('heavy');
    this.saveState();
  }

  // Universal Tennis Score & Server Editor Updater
  updateTennisScore({ setScores, gamesUs, gamesThem, pointsUs, pointsThem, server, currentSetFormat, isTiebreak, tennisScoringType }) {
    const m = this.state.activeMatch;
    if (!m) return;
    if (setScores !== undefined) {
      m.setScores = Array.isArray(setScores) ? [...setScores] : m.setScores;
      // Recalculate setsUs and setsThem from completed sets where winner is identifiable
      let sUs = 0;
      let sThem = 0;
      for (const s of m.setScores) {
        if (s.winner === 'us' || (typeof s.us === 'number' && typeof s.them === 'number' && s.us > s.them)) {
          sUs++;
        } else if (s.winner === 'them' || (typeof s.us === 'number' && typeof s.them === 'number' && s.them > s.us)) {
          sThem++;
        }
      }
      m.setsUs = sUs;
      m.setsThem = sThem;
    }
    if (gamesUs !== undefined) m.gamesUs = Math.max(0, parseInt(gamesUs, 10) || 0);
    if (gamesThem !== undefined) m.gamesThem = Math.max(0, parseInt(gamesThem, 10) || 0);
    if (pointsUs !== undefined) m.pointsUs = Math.max(0, parseInt(pointsUs, 10) || 0);
    if (pointsThem !== undefined) m.pointsThem = Math.max(0, parseInt(pointsThem, 10) || 0);

    // Sanitize illegal Advantage (AD) combinations if not in tiebreak
    // Advantage is only valid if the other player is at 40 (value 3).
    if (!m.isTiebreak) {
      if (m.pointsUs === 4 && m.pointsThem < 3) {
        m.pointsUs = 3; // Clamp to 40
      }
      if (m.pointsThem === 4 && m.pointsUs < 3) {
        m.pointsThem = 3; // Clamp to 40
      }
      if (m.pointsUs === 4 && m.pointsThem === 4) {
        m.pointsUs = 3;
        m.pointsThem = 3;
      }
    }

    if (server !== undefined) m.server = (server === 'them' ? 'them' : 'us');
    if (currentSetFormat !== undefined) m.currentSetFormat = currentSetFormat;
    if (isTiebreak !== undefined) m.isTiebreak = !!isTiebreak;
    if (tennisScoringType !== undefined) m.tennisScoringType = tennisScoringType;

    m.lastScoreTimestamp = Date.now();
    this.syncActiveMatchToArchive(false);
    this.saveState();
  }

  // Toggle active server between 'us' and 'them'
  toggleServer() {
    const m = this.state.activeMatch;
    if (!m) return;
    m.server = (m.server === 'us' ? 'them' : 'us');
    this.syncActiveMatchToArchive(false);
    this.triggerHaptic('light');
    this.saveState();
  }

  resetScores() {
    const m = this.state.activeMatch;
    if (m.sport === 'tennis') {
      m.pointsUs = 0;
      m.pointsThem = 0;
      m.gamesUs = 0;
      m.gamesThem = 0;
      m.isTiebreak = (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'tiebreak-7');
      m.setFinished = false;
    } else {
      m.scoreUs = 0;
      m.scoreThem = 0;
    }
    m.lastScoreTimestamp = Date.now();
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
    if (this.state.activeMatch.sport === 'tennis') {
      this.startNextTennisSet('standard');
      return;
    }

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

  // Always check victory conditions
  checkSetVictory() {
    const m = this.state.activeMatch;
    if (m.sport === 'tennis') {
      return !!m.setFinished;
    }
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
  finishMatch(winnerOverride = null) {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }

    const m = this.state.activeMatch;
    const isTennis = (m.sport === 'tennis');

    if (isTennis) {
      // If current set had games/points and wasn't finalized
      if (!m.setFinished && (m.gamesUs > 0 || m.gamesThem > 0 || m.pointsUs > 0 || m.pointsThem > 0)) {
        let setWin = winnerOverride;
        if (!setWin) {
          if (m.gamesUs > m.gamesThem) setWin = 'us';
          else if (m.gamesThem > m.gamesUs) setWin = 'them';
          else if (m.pointsUs > m.pointsThem) setWin = 'us';
          else if (m.pointsThem > m.pointsUs) setWin = 'them';
        }
        m.setScores = m.setScores || [];
        m.setScores.push({
          set: m.currentSet,
          us: (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'tiebreak-7') ? m.pointsUs : m.gamesUs,
          them: (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'tiebreak-7') ? m.pointsThem : m.gamesThem,
          winner: setWin,
          isTiebreakOnly: (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'tiebreak-7')
        });
        if (setWin === 'us') m.setsUs += 1;
        else if (setWin === 'them') m.setsThem += 1;
      }

      let matchWinner = winnerOverride;
      if (!matchWinner) {
        if (m.setsUs > m.setsThem) matchWinner = 'us';
        else if (m.setsThem > m.setsUs) matchWinner = 'them';
        else matchWinner = 'us';
      }
      m.winner = matchWinner;
      const winnerName = matchWinner === 'us' ? 'US' : (m.opponent || 'OPPONENT').toUpperCase();
      const scoreStr = formatTennisSetScores(m.setScores);

      this.state.chat.push({
        id: 'match_final_' + Date.now(),
        sender: 'Game Streamer',
        text: `🏆 Tennis Match Final: ${winnerName} wins! ${scoreStr ? `(${scoreStr})` : ''}`,
        timestamp: Date.now(),
        isCheer: true
      });
    } else {
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
      const matchWinner = winnerOverride ? (winnerOverride === 'us' ? 'US' : m.teamThem) : (m.setsUs > m.setsThem ? 'US' : m.teamThem);
      m.winner = winnerOverride || (m.setsUs > m.setsThem ? 'us' : 'them');
      this.state.chat.push({
        id: 'match_final_' + Date.now(),
        sender: 'Game Streamer',
        text: `🏆 Match Final: US won ${m.setsUs} set${m.setsUs === 1 ? '' : 's'}, ${m.teamThem} won ${m.setsThem} set${m.setsThem === 1 ? '' : 's'} (${matchWinner} wins match)`,
        timestamp: Date.now(),
        isCheer: true
      });
    }

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

    const sport = match.sport || 'volleyball';
    this.state.activeMatch = {
      id: match.id,
      sport: sport,
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
      gamesUs: match.gamesUs || 0,
      gamesThem: match.gamesThem || 0,
      pointsUs: match.pointsUs || 0,
      pointsThem: match.pointsThem || 0,
      server: match.server || 'us',
      tennisScoringType: match.tennisScoringType || 'ad',
      currentSetFormat: match.currentSetFormat || 'standard',
      isTiebreak: !!match.isTiebreak,
      tiebreakTarget: match.tiebreakTarget || 7,
      tiebreakInitialServer: match.tiebreakInitialServer || match.server || 'us',
      setScores: match.setScores ? [...match.setScores] : [],
      setFinished: !!match.setFinished,
      ringBufferDuration: match.ringBufferDuration || (sport === 'tennis' ? 30 : 20),
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
    const sport = options.sport || 'volleyball';
    const startingSet = Math.max(1, parseInt(options.startingSet, 10) || 1);
    const setsUs = Math.max(0, parseInt(options.setsUs, 10) || 0);
    const setsThem = Math.max(0, parseInt(options.setsThem, 10) || 0);
    const ringBufferDuration = options.ringBufferDuration || (sport === 'tennis' ? 30 : 20);

    // Persist broadcaster's preferred sport in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gamestreamer_last_sport', sport);
      }
    } catch (e) {}

    const tennisState = {
      gamesUs: Math.max(0, parseInt(options.gamesUs, 10) || 0),
      gamesThem: Math.max(0, parseInt(options.gamesThem, 10) || 0),
      pointsUs: Math.max(0, parseInt(options.pointsUs, 10) || 0),
      pointsThem: Math.max(0, parseInt(options.pointsThem, 10) || 0),
      server: options.server || 'us',
      tennisScoringType: options.tennisScoringType || 'ad',
      currentSetFormat: options.currentSetFormat || 'standard',
      isTiebreak: options.currentSetFormat === 'tiebreak-10' || options.currentSetFormat === 'tiebreak-7' || !!options.isTiebreak,
      tiebreakTarget: options.currentSetFormat === 'tiebreak-10' ? 10 : 7,
      tiebreakInitialServer: options.server || 'us',
      setScores: options.setScores ? [...options.setScores] : [],
      setFinished: false
    };

    this.state.activeMatch = {
      id: newMatchId,
      sport: sport,
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
      viewers: 1,
      ringBufferDuration: ringBufferDuration,
      ...(sport === 'tennis' ? tennisState : {
        gamesUs: 0,
        gamesThem: 0,
        pointsUs: 0,
        pointsThem: 0,
        server: 'us',
        tennisScoringType: 'ad',
        currentSetFormat: 'standard',
        isTiebreak: false,
        tiebreakTarget: 7,
        setScores: [],
        setFinished: false
      })
    };

    this.state.matches.unshift({
      id: newMatchId,
      sport: sport,
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
      ringBufferDuration: ringBufferDuration,
      ...(sport === 'tennis' ? tennisState : {}),
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

  // --- Broadcaster-Only Complete Match Deletion ---
  deleteMatch(matchId) {
    const matchIndex = this.state.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return false;

    const [deletedMatch] = this.state.matches.splice(matchIndex, 1);

    // If activeMatch matches the deleted match, reset active broadcast state safely
    if (this.state.activeMatch && this.state.activeMatch.id === matchId) {
      this.state.activeMatch = {
        id: 'match_' + Date.now(),
        isLive: false,
        isFinished: true,
        date: 'Today',
        opponent: 'Opponent',
        teamUs: 'US',
        teamThem: 'THEM',
        courtSideUs: 'left',
        scoreUs: 0,
        scoreThem: 0,
        setsUs: 0,
        setsThem: 0,
        currentSet: 1,
        lastScoreTimestamp: Date.now(),
        viewers: 0,
        highlights: [],
        comments: []
      };
      this.activePointClips = [];
      this.previousPointClips = [];
      this.midPointWaitState = null;
    }

    // Revoke any blob URLs for clips in this match to reclaim memory
    if (deletedMatch && deletedMatch.highlights) {
      for (const clip of deletedMatch.highlights) {
        if (clip.videoUrl && clip.videoUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(clip.videoUrl);
          } catch (e) {}
        }
      }
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
