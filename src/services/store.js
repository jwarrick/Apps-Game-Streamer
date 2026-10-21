// ==========================================================================
// GameStreamer State Management & Realtime Sync Layer
// ==========================================================================

const STORAGE_KEY = 'gamestreamer_state_v1';

// Initial state with realistic demo matches so the app is immediately beautiful and testable
const DEFAULT_STATE = {
  activeMatch: {
    id: 'demo-live',
    isLive: false,
    date: 'Today',
    opponent: 'Lincoln High',
    teamUs: 'US',
    teamThem: 'LINCOLN',
    courtSideUs: 'left', // 'left' or 'right'
    scoreUs: 0,
    scoreThem: 0,
    setsUs: 0,
    setsThem: 0,
    currentSet: 1,
    lastScoreTimestamp: Date.now(),
    viewers: 1
  },
  matches: [
    {
      id: 'demo-live',
      date: 'Today',
      opponent: 'Lincoln High',
      isLive: false,
      isArchived: false,
      setsUs: 1,
      setsThem: 0,
      currentSet: 2,
      scoreUs: 18,
      scoreThem: 16,
      highlights: [
        {
          id: 'h_1',
          set: 1,
          score: '14 - 12',
          label: '🔥 Ace!',
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
          set: 1,
          score: '24 - 23',
          label: '💪 Big Block!',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          driveFileId: 'drive_h_2',
          driveUrl: 'https://drive.google.com/file/d/drive_h_2/view',
          fileSizeBytes: 3500000,
          isUploading: false,
          timestamp: Date.now() - 900000
        },
        {
          id: 'h_3',
          set: 2,
          score: '18 - 16',
          label: '💣 Crazy Kill',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          driveFileId: 'drive_h_3',
          driveUrl: 'https://drive.google.com/file/d/drive_h_3/view',
          fileSizeBytes: 3300000,
          isUploading: true, // Show the uploading state requested!
          timestamp: Date.now() - 60000
        }
      ]
    },
    {
      id: 'match-oct-18',
      date: 'Oct 18, 2026',
      opponent: 'West High',
      isLive: false,
      isArchived: false,
      setsUs: 2,
      setsThem: 1,
      currentSet: 3,
      scoreUs: 15,
      scoreThem: 11,
      highlights: [
        {
          id: 'h_w1',
          set: 1,
          score: '19 - 17',
          label: '⛏️ Amazing Dig',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
          driveFileId: 'drive_h_w1',
          driveUrl: 'https://drive.google.com/file/d/drive_h_w1/view',
          fileSizeBytes: 3400000,
          isUploading: false,
          timestamp: 1729267200000
        },
        {
          id: 'h_w2',
          set: 3,
          score: '14 - 11',
          label: '🎯 Cool Set',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
          driveFileId: 'drive_h_w2',
          driveUrl: 'https://drive.google.com/file/d/drive_h_w2/view',
          fileSizeBytes: 3600000,
          isUploading: false,
          timestamp: 1729270800000
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
  }

  loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const merged = { ...DEFAULT_STATE, ...parsed };
          // If not actively streaming live, ensure score starts at 0 - 0
          if (merged.activeMatch && !merged.activeMatch.isLive) {
            merged.activeMatch.scoreUs = 0;
            merged.activeMatch.scoreThem = 0;
            merged.activeMatch.setsUs = 0;
            merged.activeMatch.setsThem = 0;
            merged.activeMatch.currentSet = 1;
          }
          // Ensure all matches and clips have archive & drive properties
          for (const match of (merged.matches || [])) {
            if (typeof match.isArchived === 'undefined') {
              match.isArchived = false;
            }
            for (const clip of (match.highlights || [])) {
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
    this.state.activeMatch.lastScoreTimestamp = Date.now();
    this.triggerHaptic(delta > 0 ? 'light' : 'double');
    this.saveState();
  }

  resetScores() {
    this.state.activeMatch.scoreUs = 0;
    this.state.activeMatch.scoreThem = 0;
    this.state.activeMatch.lastScoreTimestamp = Date.now();
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

  // Finish match, log final set score, save complete comment transcript to archive
  finishMatch() {
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

    // Save complete comment transcript and outcome with the match in archive
    let matchEntry = this.state.matches.find(item => item.id === m.id);
    if (!matchEntry) {
      matchEntry = {
        id: m.id,
        date: m.date,
        opponent: m.opponent,
        highlights: []
      };
      this.state.matches.unshift(matchEntry);
    }

    matchEntry.isLive = false;
    matchEntry.setsUs = m.setsUs;
    matchEntry.setsThem = m.setsThem;
    matchEntry.currentSet = m.currentSet;
    matchEntry.comments = [...this.state.chat]; // Full permanent comment transcript!

    this.triggerHaptic('heavy');
    this.saveState();
  }

  // --- Highlights Engine ---

  triggerHighlight(chosenLabel = null, videoBlobOrUrl = null) {
    const m = this.state.activeMatch;
    const cheer = this.state.recentCheerPill;
    const label = chosenLabel || (cheer ? cheer.text : 'Highlight');

    const clipId = 'h_' + Date.now();
    const driveId = 'drive_' + clipId;
    const newClip = {
      id: clipId,
      set: m.currentSet,
      score: `${m.scoreUs} - ${m.scoreThem}`,
      label: label,
      videoUrl: videoBlobOrUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      driveFileId: driveId,
      driveUrl: `https://drive.google.com/file/d/${driveId}/view`,
      fileSizeBytes: 3400000,
      isUploading: true,
      timestamp: Date.now()
    };

    // Auto-post highlight pill to chat so viewers see it live
    this.state.chat.push({
      id: 'c_' + Date.now(),
      sender: 'Broadcaster',
      text: `⚡ Highlight: ${label}`,
      set: m.currentSet,
      score: `${m.scoreUs} - ${m.scoreThem}`,
      timestamp: Date.now(),
      isCheer: true
    });

    // Find current active match in matches list or add it
    let matchEntry = this.state.matches.find(item => item.id === m.id);
    if (!matchEntry) {
      matchEntry = {
        id: m.id,
        date: m.date,
        opponent: m.opponent,
        isLive: m.isLive,
        setsUs: m.setsUs,
        setsThem: m.setsThem,
        currentSet: m.currentSet,
        scoreUs: m.scoreUs,
        scoreThem: m.scoreThem,
        highlights: []
      };
      this.state.matches.unshift(matchEntry);
    }

    matchEntry.highlights.push(newClip);
    this.triggerHaptic('double');
    this.saveState();

    // Simulate background throttled upload finishing after 4 seconds
    setTimeout(() => {
      newClip.isUploading = false;
      this.saveState();
    }, 4000);

    return newClip;
  }

  toggleStarHighlight(matchId, clipId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return false;
    const clip = (match.highlights || []).find(c => c.id === clipId);
    if (!clip) return false;

    clip.isStarred = !clip.isStarred;
    this.triggerHaptic('light');
    this.saveState();
    return clip.isStarred;
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

  startBroadcast(opponentName = 'Opponent') {
    const oppUpper = (opponentName || 'OPPONENT').toUpperCase();
    this.state.activeMatch.opponent = opponentName;
    this.state.activeMatch.teamUs = 'US';
    this.state.activeMatch.teamThem = oppUpper;
    this.state.activeMatch.isLive = true;
    this.state.activeMatch.date = 'Today';
    this.state.activeMatch.scoreUs = 0;
    this.state.activeMatch.scoreThem = 0;
    this.state.activeMatch.setsUs = 0;
    this.state.activeMatch.setsThem = 0;
    this.state.activeMatch.currentSet = 1;
    this.state.activeMatch.viewers = 1;

    // Sync match in matches list
    const existing = this.state.matches.find(item => item.id === this.state.activeMatch.id);
    if (existing) {
      existing.isLive = true;
      existing.opponent = opponentName;
      existing.date = 'Today';
    } else {
      this.state.matches.unshift({
        id: this.state.activeMatch.id,
        date: 'Today',
        opponent: opponentName,
        isLive: true,
        setsUs: 0,
        setsThem: 0,
        currentSet: 1,
        scoreUs: 0,
        scoreThem: 0,
        highlights: []
      });
    }

    this.saveState();
  }

  startDemoStream() {
    this.state.activeMatch = {
      id: 'demo-live',
      isLive: true,
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
    this.saveState();
  }

  stopBroadcast() {
    this.state.activeMatch.isLive = false;
    const existing = this.state.matches.find(item => item.id === this.state.activeMatch.id);
    if (existing) {
      existing.isLive = false;
    }
    this.saveState();
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
