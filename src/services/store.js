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
    teamUs: 'Wildcats',
    teamThem: 'Lincoln',
    courtSideUs: 'left', // 'left' or 'right'
    scoreUs: 18,
    scoreThem: 16,
    setsUs: 1,
    setsThem: 0,
    currentSet: 2,
    lastScoreTimestamp: Date.now() - 15000,
    viewers: 3
  },
  matches: [
    {
      id: 'demo-live',
      date: 'Today',
      opponent: 'Lincoln High',
      isLive: false,
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
          isUploading: false,
          timestamp: Date.now() - 1800000
        },
        {
          id: 'h_2',
          set: 1,
          score: '24 - 23',
          label: '💪 Big Block!',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          isUploading: false,
          timestamp: Date.now() - 900000
        },
        {
          id: 'h_3',
          set: 2,
          score: '18 - 16',
          label: '💣 Crazy Kill',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
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
          isUploading: false,
          timestamp: 1729267200000
        },
        {
          id: 'h_w2',
          set: 3,
          score: '14 - 11',
          label: '🎯 Cool Set',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
          isUploading: false,
          timestamp: 1729270800000
        }
      ]
    },
    {
      id: 'match-oct-11',
      date: 'Oct 11, 2026',
      opponent: 'East High',
      isLive: false,
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
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load stored state, using defaults:', e);
    }
    return DEFAULT_STATE;
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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
      const next = Math.max(0, this.state.activeMatch.scoreUs + delta);
      this.state.activeMatch.scoreUs = next;
    } else {
      const next = Math.max(0, this.state.activeMatch.scoreThem + delta);
      this.state.activeMatch.scoreThem = next;
    }
    this.state.activeMatch.lastScoreTimestamp = Date.now();
    this.triggerHaptic(delta > 0 ? 'light' : 'double');
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
    // Award set to whoever has more points
    if (m.scoreUs > m.scoreThem) {
      m.setsUs += 1;
    } else if (m.scoreThem > m.scoreUs) {
      m.setsThem += 1;
    }
    m.currentSet += 1;
    m.scoreUs = 0;
    m.scoreThem = 0;
    m.lastScoreTimestamp = Date.now();
    this.triggerHaptic('heavy');
    this.saveState();
  }

  // --- Highlights Engine ---

  triggerHighlight(videoBlobOrUrl = null) {
    const m = this.state.activeMatch;
    const cheer = this.state.recentCheerPill;
    const label = cheer ? cheer.text : 'Highlight';

    const newClip = {
      id: 'h_' + Date.now(),
      set: m.currentSet,
      score: `${m.scoreUs} - ${m.scoreThem}`,
      label: label,
      videoUrl: videoBlobOrUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      isUploading: true,
      timestamp: Date.now()
    };

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
    this.state.activeMatch.opponent = opponentName;
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

  stopBroadcast() {
    this.state.activeMatch.isLive = false;
    const existing = this.state.matches.find(item => item.id === this.state.activeMatch.id);
    if (existing) {
      existing.isLive = false;
    }
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
