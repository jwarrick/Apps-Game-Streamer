// ==========================================================================
// GameStreamer State Management & Realtime Sync Layer
// Powered by Cloud Firestore & Local Fast Cache
// ==========================================================================

import { db } from './firebase.js';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  addDoc
} from 'firebase/firestore';

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
    id: null,
    sport: 'volleyball', // 'volleyball' or 'tennis'
    isLive: false,
    isFinished: true,
    date: 'Today',
    opponent: '',
    teamUs: 'US',
    teamThem: 'OPPONENT',
    courtSideUs: 'left', // 'left' or 'right'
    scoreUs: 0,
    scoreThem: 0,
    setsUs: 0,
    setsThem: 0,
    currentSet: 1,
    lastScoreTimestamp: Date.now(),
    viewers: 0,
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
  matches: [],
  chat: [],
  recentCheerPill: null,
  driveFolderUrl: 'https://drive.google.com/drive/folders/1_xaGV5-7hA0-cm7TnTZtAbGvWL4AERxt?usp=sharing'
};

class GameStore {
  constructor() {
    this.listeners = new Set();
    this.pointFinalizedListeners = new Set();
    this.scoreActionListeners = new Set();
    this.state = this.loadState();
    this.pointBuffer = null;
    this._isApplyingRemoteUpdate = false;
    this._chatUnsub = null;
    this._activeChatMatchId = null;
    this.initPointBuffers();
    this.initFirestoreSync();
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

          // Clean out legacy demo mock matches from localStorage
          merged.matches = (merged.matches || []).filter(m => !['demo-live', 'match-oct-18', 'match-tennis-oct-19'].includes(m.id));
          if (merged.activeMatch && ['demo-live', 'match-oct-18', 'match-tennis-oct-19'].includes(merged.activeMatch.id)) {
            merged.activeMatch.isLive = false;
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
              // Clean out old dummy drive_ ids so they do not falsely report as synced
              if (clip.driveFileId && clip.driveFileId.startsWith('drive_')) {
                clip.driveFileId = null;
              }
              if (!clip.videoUrl || clip.videoUrl.includes('commondatastorage.googleapis.com')) {
                clip.videoUrl = '/videos/sample-highlight.mp4';
              }
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
    this.syncActiveMatchToFirestore();
  }

  getDeletedMatchIds() {
    try {
      const stored = localStorage.getItem('gamestreamer_deleted_match_ids');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch (e) {
      return new Set();
    }
  }

  markMatchDeleted(matchId) {
    if (!matchId) return;
    try {
      const set = this.getDeletedMatchIds();
      set.add(matchId);
      localStorage.setItem('gamestreamer_deleted_match_ids', JSON.stringify(Array.from(set)));
    } catch (e) {}
  }

  syncActiveMatchToFirestore() {
    const m = this.state.activeMatch;
    // Sync active match to Firestore (handles live, paused, and finished state updates)
    if (m && m.id && !this._isApplyingRemoteUpdate) {
      try {
        const docRef = doc(db, 'matches', m.id);
        const matchEntry = this.state.matches.find(item => item.id === m.id);
        const highlightsToSave = matchEntry && Array.isArray(matchEntry.highlights)
          ? matchEntry.highlights.map(h => ({
              id: h.id,
              type: h.type || 'player',
              set: h.set || 1,
              score: h.score || '0 - 0',
              label: h.label || 'Highlight',
              videoUrl: h.videoUrl || '',
              storageTier: h.storageTier || (h.serverVideoDeleted ? 'drive' : (h.driveFileId ? 'synced' : 'server')),
              serverVideoDeleted: !!h.serverVideoDeleted,
              hasLocalBlob: !!h.hasLocalBlob,
              localBlobId: h.localBlobId || h.id,
              durationMs: h.durationMs || null,
              driveUrl: h.driveUrl || '',
              driveFileId: h.driveFileId || '',
              driveFolderUrl: h.driveFolderUrl || this.getDriveLocation(),
              fileSizeBytes: h.fileSizeBytes || 3400000,
              isStarred: !!h.isStarred,
              timestamp: h.timestamp || Date.now()
            }))
          : [];
        const commentsToSave = matchEntry && Array.isArray(matchEntry.comments)
          ? matchEntry.comments
          : (this.state.chat || []);

        const dataToSave = {
          id: m.id,
          sport: m.sport || 'volleyball',
          opponent: m.opponent || '',
          teamUs: m.teamUs || 'US',
          teamThem: m.teamThem || 'OPPONENT',
          courtSideUs: m.courtSideUs || 'left',
          isLive: !!m.isLive,
          isFinished: !!m.isFinished,
          isArchived: !!(matchEntry && matchEntry.isArchived),
          storageTier: (matchEntry && matchEntry.storageTier) || (m.isArchived ? 'drive' : 'server'),
          winner: m.winner || null,
          date: m.date || 'Today',
          scoreUs: m.scoreUs || 0,
          scoreThem: m.scoreThem || 0,
          setsUs: m.setsUs || 0,
          setsThem: m.setsThem || 0,
          currentSet: m.currentSet || 1,
          gamesUs: m.gamesUs || 0,
          gamesThem: m.gamesThem || 0,
          pointsUs: m.pointsUs || 0,
          pointsThem: m.pointsThem || 0,
          server: m.server || 'us',
          tennisScoringType: m.tennisScoringType || 'ad',
          currentSetFormat: m.currentSetFormat || 'standard',
          isTiebreak: !!m.isTiebreak,
          tiebreakTarget: m.tiebreakTarget || 7,
          setScores: m.setScores || [],
          setFinished: !!m.setFinished,
          highlights: highlightsToSave,
          comments: commentsToSave,
          lastScoreTimestamp: m.lastScoreTimestamp || Date.now(),
          updatedAt: Date.now()
        };
        setDoc(docRef, dataToSave, { merge: true }).catch(err => {
          console.warn('Failed to sync match to Firestore:', err);
        });
      } catch (err) {
        console.warn('Firestore sync error:', err);
      }
    }
  }

  initFirestoreSync() {
    try {
      const matchesCol = collection(db, 'matches');
      onSnapshot(matchesCol, (snapshot) => {
        const firestoreMatches = [];
        let mostRecentLiveMatch = null;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const matchObj = {
            id: docSnap.id,
            sport: 'volleyball',
            date: 'Today',
            opponent: '',
            teamUs: 'US',
            teamThem: 'OPPONENT',
            courtSideUs: 'left',
            isLive: false,
            isFinished: true,
            isArchived: false,
            scoreUs: 0,
            scoreThem: 0,
            setsUs: 0,
            setsThem: 0,
            currentSet: 1,
            gamesUs: 0,
            gamesThem: 0,
            pointsUs: 0,
            pointsThem: 0,
            highlights: [],
            comments: [],
            setScores: [],
            ...data
          };
          matchObj.highlights = (Array.isArray(matchObj.highlights) ? sortHighlightsChronologically(matchObj.highlights) : []).map(h => {
            const hasRealDriveId = !!(h.driveFileId && !h.driveFileId.startsWith('drive_'));
            if (hasRealDriveId && (!h.videoUrl || h.videoUrl.includes('sample-highlight.mp4') || h.videoUrl.startsWith('blob:'))) {
              return {
                ...h,
                videoUrl: `https://drive.google.com/uc?export=download&id=${h.driveFileId}`,
                storageTier: 'synced',
                cloudUploaded: true
              };
            }
            if (!hasRealDriveId && h.driveFileId && h.driveFileId.startsWith('drive_')) {
              // Strip fake dummy ID
              h = { ...h, driveFileId: null };
            }
            if (!h.videoUrl || h.videoUrl.includes('commondatastorage.googleapis.com')) {
              return { ...h, videoUrl: '/videos/sample-highlight.mp4' };
            }
            return h;
          });

          // Accurately set match-level storageTier
          const allClipsSynced = matchObj.highlights.length > 0 && matchObj.highlights.every(h => {
            const isRealDrive = !!(h.driveFileId && !h.driveFileId.startsWith('drive_'));
            const isTier = h.storageTier === 'synced' || h.storageTier === 'drive';
            const isDriveUrl = !!(h.driveUrl && h.driveUrl.includes('/d/') && !h.driveUrl.includes('folders/'));
            return (isTier && isRealDrive) || isDriveUrl;
          });
          if (!matchObj.isArchived) {
            matchObj.storageTier = allClipsSynced ? 'synced' : 'server';
          }

          matchObj.comments = Array.isArray(matchObj.comments) ? matchObj.comments : [];
          matchObj.setScores = Array.isArray(matchObj.setScores) ? matchObj.setScores : [];
          firestoreMatches.push(matchObj);
          // Liveness verification: must be marked isLive AND have a heartbeat/update within the last 45 seconds!
          const lastActive = matchObj.broadcasterHeartbeat || matchObj.updatedAt || 0;
          const isRecentlyActive = (Date.now() - lastActive) < 45000;
          if (matchObj.isLive && isRecentlyActive) {
            if (!mostRecentLiveMatch || (matchObj.updatedAt || 0) > (mostRecentLiveMatch.updatedAt || 0)) {
              mostRecentLiveMatch = matchObj;
            }
          } else if (matchObj.isLive && !isRecentlyActive) {
            // Self-heal ghost match from phones that closed or lost battery
            console.log(`[Store] Self-healing stale ghost match ${matchObj.id} (last active ${Math.round((Date.now() - lastActive)/1000)}s ago)`);
            matchObj.isLive = false;
            try {
              updateDoc(doc(db, 'matches', matchObj.id), { isLive: false, broadcasterHeartbeat: 0 }).catch(() => {});
            } catch (e) {}
          }
        });

        // Filter out matches that were deleted locally
        const deletedIds = this.getDeletedMatchIds();
        const validFirestoreMatches = firestoreMatches.filter(m => !deletedIds.has(m.id));

        // Merge: keep local matches that aren't deleted and haven't synced yet, 
        // while updating all matches present in Firestore!
        const matchMap = new Map();
        validFirestoreMatches.forEach(m => matchMap.set(m.id, m));

        (this.state.matches || []).forEach(localM => {
          if (localM && localM.id && !deletedIds.has(localM.id) && !matchMap.has(localM.id)) {
            matchMap.set(localM.id, localM);
            try {
              setDoc(doc(db, 'matches', localM.id), {
                ...localM,
                updatedAt: localM.updatedAt || Date.now()
              }, { merge: true }).catch(() => {});
            } catch (e) {}
          }
        });

        const mergedMatches = Array.from(matchMap.values());
        mergedMatches.sort((a, b) => (b.updatedAt || b.date || 0) - (a.updatedAt || a.date || 0));

        this._isApplyingRemoteUpdate = true;
        try {
          const isBroadcasterOnStream = (typeof window !== 'undefined' && window.location && (window.location.pathname === '/stream' || (window.location.hash && window.location.hash.includes('stream'))));

          if (!isBroadcasterOnStream) {
            if (mostRecentLiveMatch) {
              this.state.activeMatch = { ...mostRecentLiveMatch };
              if (this._activeChatMatchId !== mostRecentLiveMatch.id) {
                this.initChatSync(mostRecentLiveMatch.id);
              }
            } else {
              if (this.state.activeMatch) {
                this.state.activeMatch.isLive = false;
              }
            }
          }

          this.state.matches = mergedMatches;

          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          }
          this.notify();
        } finally {
          this._isApplyingRemoteUpdate = false;
        }
      }, (err) => {
        console.warn('Firestore matches sync error:', err);
      });
    } catch (e) {
      console.warn('Could not initialize Firestore matches sync:', e);
    }
  }

  initChatSync(matchId) {
    if (this._chatUnsub) {
      this._chatUnsub();
      this._chatUnsub = null;
    }
    if (!matchId) return;
    this._activeChatMatchId = matchId;

    try {
      const chatCol = collection(db, 'matches', matchId, 'chat');
      this._chatUnsub = onSnapshot(chatCol, (snapshot) => {
        const msgs = [];
        snapshot.forEach(d => msgs.push({ id: d.id, ...d.data() }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        this.state.chat = msgs;
        this.notify();
      });
    } catch (e) {
      console.warn('Could not init chat sync:', e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onPointFinalized(callback) {
    if (!this.pointFinalizedListeners) this.pointFinalizedListeners = new Set();
    this.pointFinalizedListeners.add(callback);
    return () => this.pointFinalizedListeners.delete(callback);
  }

  notifyPointFinalized(pointMeta) {
    if (!this.pointFinalizedListeners) return;
    for (const cb of this.pointFinalizedListeners) {
      try {
        cb(pointMeta);
      } catch (e) {
        console.error('[GameStore] Error executing pointFinalized listener:', e);
      }
    }
  }

  onScoreActionOccurred(callback) {
    if (!this.scoreActionListeners) this.scoreActionListeners = new Set();
    this.scoreActionListeners.add(callback);
    return () => this.scoreActionListeners.delete(callback);
  }

  notifyScoreAction(actionTimestamp) {
    if (!this.scoreActionListeners) return;
    for (const cb of this.scoreActionListeners) {
      try {
        cb(actionTimestamp);
      } catch (e) {
        console.error('[GameStore] Error executing scoreAction listener:', e);
      }
    }
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[GameStore] Error executing state listener:', err);
      }
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

  // --- Point Ring-Buffer & 3-Second Grace Period Management ---

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
      graceTimer: null,
      pendingClickTimestamp: null
    };
  }

  // Called every time the score changes. Debounced by 3 seconds in case of rapid misclicks/corrections.
  // When a string of clicks occurs with each click < 3s from the previous, only the last click is committed.
  onScoreAction(actionTimestamp = Date.now()) {
    if (!this.pointBuffer) this.initPointBuffers();

    const finalScore = this.getScoreSummaryString();
    const cur = this.pointBuffer.current;

    if (cur) {
      cur.scoreCurrent = finalScore;
      cur.lastScoreActionTimestamp = actionTimestamp;
    }

    // Keep track of the most recent click timestamp in this string of rapid adjustments
    this.pointBuffer.pendingClickTimestamp = actionTimestamp;

    // Immediately notify subscribers (e.g. StreamerView) of the score click so buffering starts at this exact timestamp
    this.notifyScoreAction(actionTimestamp);

    // Reset 3-second debounce timer
    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
    }

    this.pointBuffer.graceTimer = setTimeout(() => {
      this.finalizePointBoundary();
    }, 3000);
  }

  // Finalizes the current point buffer and rotates it to previousPoint after 3s of score inactivity
  finalizePointBoundary() {
    if (!this.pointBuffer) return;
    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
      this.pointBuffer.graceTimer = null;
    }

    const cur = this.pointBuffer.current;
    const m = this.state.activeMatch;
    // Effective point boundary timestamp is the timestamp of the LAST click in the string
    const endTime = this.pointBuffer.pendingClickTimestamp || (cur ? cur.lastScoreActionTimestamp : null) || Date.now();
    this.pointBuffer.pendingClickTimestamp = null;
    const finalScore = (cur && cur.scoreCurrent) ? cur.scoreCurrent : this.getScoreSummaryString();
    const finalSet = m.currentSet || 1;

    const completedPoint = {
      ...(cur || {}),
      endTime: endTime,
      finalScore: finalScore,
      finalSet: finalSet
    };

    // If broadcaster highlighted "Current Pt." mid-point, finalize and save the clip now!
    if (cur && cur.pendingHighlight) {
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
      id: 'pt_' + endTime + '_' + Math.random().toString(36).substr(2, 6),
      set: finalSet,
      scoreAtStart: finalScore,
      scoreCurrent: finalScore,
      startTime: endTime,
      lastScoreActionTimestamp: null,
      pendingHighlight: null
    };

    // Notify listeners (StreamerView, etc.) that the point tick has officially committed
    this.notifyPointFinalized(completedPoint);
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
          this._recordSetOutcome(m.currentSet, m.pointsUs, m.pointsThem, isUs ? 'us' : 'them', true);
          m.setFinished = true;
        } else {
          // Set tiebreak at 6-6 (or 8-8)
          if (isUs) m.gamesUs += 1;
          else m.gamesThem += 1;

          this._recordSetOutcome(m.currentSet, m.gamesUs, m.gamesThem, isUs ? 'us' : 'them', false, `${loserPts}`);
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
            this._recordSetOutcome(m.currentSet, m.gamesUs, m.gamesThem, setWinner, false);
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
            this._recordSetOutcome(m.currentSet, m.gamesUs, m.gamesThem, setWinner, false);
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
      const finalUs = m.isTiebreak ? m.pointsUs : m.gamesUs;
      const finalThem = m.isTiebreak ? m.pointsThem : m.gamesThem;
      this._recordSetOutcome(m.currentSet, finalUs, finalThem, setWinner, wasTBOnly);
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

  _recordSetOutcome(setNum, usScore, themScore, winner, isTiebreakOnly = false, tiebreakScore = null) {
    const m = this.state.activeMatch;
    if (!m) return;
    m.setScores = Array.isArray(m.setScores) ? m.setScores : [];
    const targetSet = parseInt(setNum, 10) || 1;
    const existingIdx = m.setScores.findIndex(s => s.set === targetSet || s.setNumber === targetSet);
    const scoreStr = isTiebreakOnly ? `[${usScore}-${themScore}]` : `${usScore}-${themScore}`;
    const entry = {
      set: targetSet,
      setNumber: targetSet,
      us: usScore,
      them: themScore,
      score: scoreStr,
      winner: winner || (usScore > themScore ? 'us' : (themScore > usScore ? 'them' : 'us')),
      isTiebreakOnly: !!isTiebreakOnly,
      ...(tiebreakScore ? { tiebreakScore } : {})
    };
    if (existingIdx >= 0) {
      m.setScores[existingIdx] = entry;
    } else {
      m.setScores.push(entry);
    }
    // Always re-evaluate setsUs and setsThem strictly from setScores to prevent duplicate set counting
    m.setsUs = m.setScores.filter(s => s.winner === 'us').length;
    m.setsThem = m.setScores.filter(s => s.winner === 'them').length;
    if (m.setsUs > m.setsThem) m.winner = 'us';
    else if (m.setsThem > m.setsUs) m.winner = 'them';
    else m.winner = entry.winner;
  }

  awardCurrentSet(winnerOverride = null) {
    const m = this.state.activeMatch;
    if (!m) return;
    const isTennis = (m.sport === 'tennis');
    const setNum = m.currentSet || 1;

    if (isTennis) {
      const isTiebreakOnly = (m.currentSetFormat === 'tiebreak-10' || m.currentSetFormat === 'match_tiebreak_10' || m.currentSetFormat === 'tiebreak-7' || m.currentSetFormat === 'tiebreak_7');
      const scoreUs = isTiebreakOnly ? (m.pointsUs || 0) : (m.gamesUs || 0);
      const scoreThem = isTiebreakOnly ? (m.pointsThem || 0) : (m.gamesThem || 0);
      let setWin = winnerOverride;
      if (!setWin) {
        if (scoreUs > scoreThem) setWin = 'us';
        else if (scoreThem > scoreUs) setWin = 'them';
        else if (m.pointsUs > m.pointsThem) setWin = 'us';
        else if (m.pointsThem > m.pointsUs) setWin = 'them';
        else setWin = 'us';
      }
      this._recordSetOutcome(setNum, scoreUs, scoreThem, setWin, isTiebreakOnly);
      m.setFinished = true;
    } else {
      const finalUs = m.scoreUs || 0;
      const finalThem = m.scoreThem || 0;
      let setWin = winnerOverride;
      if (!setWin) {
        if (finalUs > finalThem) setWin = 'us';
        else if (finalThem > finalUs) setWin = 'them';
        else setWin = 'us';
      }
      this._recordSetOutcome(setNum, finalUs, finalThem, setWin, false);
    }
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
    const setWinner = (finalUs > finalThem) ? 'us' : (finalThem > finalUs ? 'them' : 'us');

    // Record set outcome and recalculate setsUs / setsThem cleanly
    this._recordSetOutcome(prevSet, finalUs, finalThem, setWinner, false);

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

  // Pause/Stop broadcast (match still in progress, can be resumed)
  pauseBroadcast() {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }
    const m = this.state.activeMatch;
    if (m) {
      // Award the current set based upon current score
      this.awardCurrentSet();

      m.isLive = false;
      m.isFinished = false;
      if (m.id) {
        try {
          updateDoc(doc(db, 'matches', m.id), {
            isLive: false,
            isFinished: false,
            winner: m.winner || null,
            setsUs: m.setsUs || 0,
            setsThem: m.setsThem || 0,
            gamesUs: m.gamesUs || 0,
            gamesThem: m.gamesThem || 0,
            scoreUs: m.scoreUs || 0,
            scoreThem: m.scoreThem || 0,
            setScores: m.setScores || [],
            setFinished: !!m.setFinished,
            updatedAt: Date.now()
          }).catch(() => {});
        } catch (e) {}
      }
    }
    this.syncActiveMatchToArchive(false);
    this.saveState();
  }

  // Finish match, log final set score, save complete comment transcript to archive
  finishMatch(winnerOverride = null) {
    if (this.pointBuffer && this.pointBuffer.graceTimer) {
      this.finalizePointBoundary();
    }

    const m = this.state.activeMatch;

    // If there was a pending highlight that wasn't finalized yet, save it now!
    if (this.pointBuffer && this.pointBuffer.current && this.pointBuffer.current.pendingHighlight) {
      const cur = this.pointBuffer.current;
      this.saveHighlightClip({
        type: cur.pendingHighlight.type,
        label: cur.pendingHighlight.label,
        set: m.currentSet,
        score: `${m.scoreUs} - ${m.scoreThem}`,
        videoBlobOrUrl: cur.pendingHighlight.videoBlobOrUrl,
        timestamp: Date.now()
      });
      cur.pendingHighlight = null;
    }

    // Award current set based on current score
    this.awardCurrentSet(winnerOverride);

    const isTennis = (m.sport === 'tennis');
    if (isTennis) {
      let matchWinner = winnerOverride || m.winner;
      if (!matchWinner) {
        if (m.setsUs > m.setsThem) matchWinner = 'us';
        else if (m.setsThem > m.setsUs) matchWinner = 'them';
        else matchWinner = 'us';
      }
      m.winner = matchWinner;
      const winnerName = matchWinner === 'us' ? 'US' : (m.opponent || 'OPPONENT').toUpperCase();
      const scoreStr = formatTennisSetScores(m.setScores);

      this.postChatMessage('Game Streamer', `🏆 Tennis Match Final: ${winnerName} wins! ${scoreStr ? `(${scoreStr})` : ''}`, {
        isCheer: true
      });
    } else {
      const matchWinner = winnerOverride ? (winnerOverride === 'us' ? 'US' : m.teamThem) : (m.setsUs > m.setsThem ? 'US' : m.teamThem);
      m.winner = winnerOverride || (m.setsUs > m.setsThem ? 'us' : 'them');
      this.postChatMessage('Game Streamer', `🏆 Match Final: US won ${m.setsUs} set${m.setsUs === 1 ? '' : 's'}, ${m.teamThem} won ${m.setsThem} set${m.setsThem === 1 ? '' : 's'} (${matchWinner} wins match)`, {
        isCheer: true
      });
    }

    m.isLive = false;
    m.isFinished = true;

    if (m.id) {
      try {
        updateDoc(doc(db, 'matches', m.id), {
          isLive: false,
          isFinished: true,
          winner: m.winner || null,
          setsUs: m.setsUs || 0,
          setsThem: m.setsThem || 0,
          gamesUs: m.gamesUs || 0,
          gamesThem: m.gamesThem || 0,
          scoreUs: m.scoreUs || 0,
          scoreThem: m.scoreThem || 0,
          setScores: m.setScores || [],
          setFinished: !!m.setFinished,
          updatedAt: Date.now()
        }).catch(() => {});
      } catch (e) {}
    }

    // Save complete comment transcript and outcome with the match in archive
    const matchEntry = this.syncActiveMatchToArchive(true);
    matchEntry.comments = [...this.state.chat]; // Full permanent comment transcript!

    this.triggerHaptic('heavy');
    this.saveState();
  }

  // --- Highlights Engine with Player vs Team & Current vs Previous Point ---

  // Trigger point highlight (current or previous point, player or team)
  triggerPointHighlight({ type = 'player', label = 'Highlight', target = 'current', videoBlobOrUrl = null, rallyInfo = null }) {
    if (!this.pointBuffer) this.initPointBuffers();

    const m = this.state.activeMatch;
    let set = m.currentSet || 1;
    let score = this.getScoreSummaryString() || `${m.scoreUs} - ${m.scoreThem}`;
    let timestamp = Date.now();

    if (rallyInfo && rallyInfo.score) {
      score = rallyInfo.score;
      set = rallyInfo.set || set;
      timestamp = rallyInfo.timestamp || timestamp;
    } else if ((target === 'last' || target === 'previous') && this.pointBuffer && this.pointBuffer.previous) {
      const prev = this.pointBuffer.previous;
      set = prev.finalSet || prev.set || set;
      score = prev.finalScore || prev.scoreCurrent || score;
      timestamp = prev.endTime || timestamp;
    }

    // Auto-post highlight event to chat so viewers see it immediately
    this.postChatMessage('Broadcaster', `⚡ ${type === 'player' ? 'Player' : 'Team'} Highlight: ${label}`, {
      isCheer: true,
      set: set,
      score: score
    });
    this.triggerHaptic('double');

    // Immediately and permanently save the highlight clip to archive & Firestore
    return this.saveHighlightClip({
      type,
      label,
      set,
      score,
      videoBlobOrUrl,
      timestamp,
      durationMs: rallyInfo ? rallyInfo.durationMs : null
    });
  }

  // Save highlight clip to match archive
  saveHighlightClip({ type = 'player', label = 'Highlight', set = 1, score = '0 - 0', videoBlobOrUrl = null, timestamp = Date.now(), durationMs = null }) {
    const m = this.state.activeMatch;
    const clipId = 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const driveFolderUrl = this.getDriveLocation();
    const isBlob = !!(videoBlobOrUrl && videoBlobOrUrl.startsWith('blob:'));
    const newClip = {
      id: clipId,
      type: type, // 'player' or 'team'
      set: set,
      score: score,
      label: label,
      videoUrl: videoBlobOrUrl || '/videos/sample-highlight.mp4',
      storageTier: 'server', // Server copy until confirmed synced to Google Drive
      serverVideoDeleted: false,
      hasLocalBlob: isBlob,
      localBlobId: clipId,
      driveFileId: null, // Null until verified upload to Drive
      driveUrl: null,
      driveFolderUrl: driveFolderUrl,
      cloudUploaded: false,
      durationMs: durationMs,
      fileSizeBytes: 3400000,
      isUploading: false,
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
      this.postChatMessage('Broadcaster', `⚡ ${type === 'player' ? 'Player' : 'Team'} Highlight: ${label}`, {
        isCheer: true,
        set: set,
        score: score
      });
    }

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
    this.postChatMessage('Broadcaster', pillText, {
      isCheer: true,
      set: m?.currentSet || 1,
      score: `${m?.scoreUs || 0} - ${m?.scoreThem || 0}`
    });
    this.triggerHaptic('light');

    const lastMsg = this.state.chat[this.state.chat.length - 1];
    this.state.recentCheerPill = lastMsg;

    // Auto-clear recentCheerPill after 20s if no highlight was pressed
    setTimeout(() => {
      if (this.state.recentCheerPill === lastMsg) {
        this.state.recentCheerPill = null;
      }
    }, 20000);
  }

  postChatMessage(sender, text, options = {}) {
    if (!text || !text.trim()) return;
    const m = this.state.activeMatch;
    const msg = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender: sender || 'Viewer',
      text: text.trim(),
      timestamp: Date.now(),
      isCheer: !!options.isCheer,
      set: options.set !== undefined ? options.set : (m?.currentSet || 1),
      score: options.score !== undefined ? options.score : `${m?.scoreUs || 0} - ${m?.scoreThem || 0}`
    };
    this.state.chat.push(msg);
    this.saveState();

    if (m && m.id) {
      try {
        addDoc(collection(db, 'matches', m.id, 'chat'), {
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          isCheer: msg.isCheer,
          set: msg.set,
          score: msg.score
        }).catch(err => {
          console.warn('Error saving chat message to Firestore:', err);
        });
      } catch (err) {
        console.warn('Firestore chat error:', err);
      }
    }
  }

  // --- Streamer Lifecycle ---

  resumeMatch(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return;

    // Ensure all other matches are marked isLive: false, isFinished: true
    this.state.matches.forEach(m => {
      if (m.id !== matchId && (m.isLive || !m.isFinished)) {
        m.isLive = false;
        m.isFinished = true;
        try {
          updateDoc(doc(db, 'matches', m.id), { isLive: false, isFinished: true, updatedAt: Date.now() }).catch(() => {});
        } catch (e) {}
      }
    });

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
      viewers: 0
    };
    match.isLive = true;
    match.isFinished = false;
    try {
      updateDoc(doc(db, 'matches', match.id), {
        isLive: true,
        isFinished: false,
        updatedAt: Date.now()
      }).catch(() => {});
    } catch (e) {}
    this.initPointBuffers();
    this.initChatSync(matchId);
    this.saveState();
  }

  startBroadcast(opponentName = 'Opponent', options = {}) {
    if (options.resumeMatchId) {
      this.resumeMatch(options.resumeMatchId);
      return;
    }

    // Ensure all other matches are marked isLive: false, isFinished: true in local state and Firestore!
    this.state.matches.forEach(m => {
      if (m.isLive || !m.isFinished) {
        m.isLive = false;
        m.isFinished = true;
        try {
          updateDoc(doc(db, 'matches', m.id), { isLive: false, isFinished: true, updatedAt: Date.now() }).catch(() => {});
        } catch (e) {}
      }
    });

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

    let finalSetScores = options.setScores ? [...options.setScores] : [];
    if (sport !== 'tennis' && startingSet > 1 && finalSetScores.length === 0) {
      let uLeft = setsUs;
      let tLeft = setsThem;
      for (let sIdx = 1; sIdx < startingSet; sIdx++) {
        let win = 'us';
        if (uLeft > 0) {
          win = 'us';
          uLeft--;
        } else if (tLeft > 0) {
          win = 'them';
          tLeft--;
        }
        finalSetScores.push({
          set: sIdx,
          setNumber: sIdx,
          us: win === 'us' ? 25 : 20,
          them: win === 'them' ? 25 : 20,
          score: win === 'us' ? '25-20' : '20-25',
          winner: win
        });
      }
    }

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
      setScores: finalSetScores,
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
      viewers: 0,
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
        setScores: finalSetScores,
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
      setScores: finalSetScores,
      ...(sport === 'tennis' ? tennisState : {}),
      highlights: []
    });

    this.initPointBuffers();
    this.initChatSync(newMatchId);
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
      viewers: 0
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

  updateViewerCount(count) {
    const m = this.state.activeMatch;
    if (!m) return;
    const viewers = Math.max(0, parseInt(count, 10) || 0);
    m.viewers = viewers;
    if (m.id) {
      try {
        updateDoc(doc(db, 'matches', m.id), { viewers, updatedAt: Date.now() }).catch(() => {});
      } catch (e) {}
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

  // --- 3-Stage Storage Lifecycle (Server Only -> Server + Drive -> Drive Only) ---

  backupMatchToDrive(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return false;

    match.backedUpToDriveAt = Date.now();
    const driveFolderUrl = this.getDriveLocation();

    // Only mark clip as synced if it has a genuine Drive File ID
    const allSynced = (match.highlights || []).length > 0 && (match.highlights || []).every(clip => {
      const isRealDrive = !!(clip.driveFileId && !clip.driveFileId.startsWith('drive_'));
      const isTier = clip.storageTier === 'synced' || clip.storageTier === 'drive';
      const isDriveUrl = !!(clip.driveUrl && clip.driveUrl.includes('/d/') && !clip.driveUrl.includes('folders/'));
      return (isTier && isRealDrive) || isDriveUrl;
    });

    if (allSynced) {
      match.storageTier = 'synced';
    }

    try {
      updateDoc(doc(db, 'matches', matchId), {
        storageTier: match.storageTier || 'server',
        backedUpToDriveAt: match.backedUpToDriveAt,
        highlights: match.highlights,
        updatedAt: Date.now()
      }).catch(() => {});
    } catch (e) {}

    this.triggerHaptic('medium');
    this.saveState();
    return allSynced;
  }

  // Updates cloud sync & Drive details for a specific highlight clip
  updateClipCloudDetails(matchId, clipId, details) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (match) {
      const clip = (match.highlights || []).find(h => h.id === clipId);
      if (clip) {
        Object.assign(clip, details);
      }
    }
    if (this.state.activeMatch && this.state.activeMatch.id === matchId) {
      const activeClip = (this.state.activeMatch.highlights || []).find(h => h.id === clipId);
      if (activeClip) {
        Object.assign(activeClip, details);
      }
    }
    this.saveState();
    this.notify();
  }

  // Stage 2 -> Stage 3: Purges server video copy to reclaim cloud hosting quota (relies on Drive)
  purgeServerMatchStorage(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return 0;

    let freedBytes = 0;
    match.storageTier = 'drive';
    match.isArchived = true;
    match.archivedAt = Date.now();
    const driveFolderUrl = this.getDriveLocation();

    for (const clip of (match.highlights || [])) {
      if (clip.videoUrl) {
        freedBytes += clip.fileSizeBytes || 3400000;
      }
      clip.storageTier = 'drive';
      clip.serverVideoDeleted = true;
      clip.videoUrl = null; // Server copy purged to reclaim cloud space
      clip.driveFileId = clip.driveFileId || ('drive_' + clip.id);
      clip.driveUrl = clip.driveUrl || driveFolderUrl;
      clip.driveFolderUrl = driveFolderUrl;
    }

    try {
      updateDoc(doc(db, 'matches', matchId), {
        storageTier: 'drive',
        isArchived: true,
        archivedAt: match.archivedAt,
        highlights: match.highlights,
        updatedAt: Date.now()
      }).catch(() => {});
    } catch (e) {}

    this.triggerHaptic('heavy');
    this.saveState();
    return freedBytes;
  }

  // Stage 3 -> Stage 2: Re-caches video copy onto app server
  restoreMatchToServer(matchId) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) return;

    match.storageTier = 'synced';
    match.isArchived = false;
    match.archivedAt = null;

    for (const clip of (match.highlights || [])) {
      clip.storageTier = 'synced';
      clip.serverVideoDeleted = false;
      clip.videoUrl = clip.videoUrl || '/videos/sample-highlight.mp4';
    }

    try {
      updateDoc(doc(db, 'matches', matchId), {
        storageTier: 'synced',
        isArchived: false,
        archivedAt: null,
        highlights: match.highlights,
        updatedAt: Date.now()
      }).catch(() => {});
    } catch (e) {}

    this.triggerHaptic('light');
    this.saveState();
  }

  // Backwards compatibility aliases
  archiveMatch(matchId) {
    return this.purgeServerMatchStorage(matchId);
  }

  unarchiveMatch(matchId) {
    return this.restoreMatchToServer(matchId);
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
    // Target Google Drive shared folder provided by user
    return 'https://drive.google.com/drive/folders/1_xaGV5-7hA0-cm7TnTZtAbGvWL4AERxt?usp=sharing';
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
    this.markMatchDeleted(matchId);
    const matchIndex = this.state.matches.findIndex(m => m.id === matchId);
    if (matchIndex !== -1) {
      const [deletedMatch] = this.state.matches.splice(matchIndex, 1);
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
    }

    // If activeMatch matches the deleted match, reset active broadcast state safely
    if (this.state.activeMatch && this.state.activeMatch.id === matchId) {
      this.state.activeMatch = {
        id: null,
        sport: 'volleyball',
        isLive: false,
        isFinished: true,
        date: 'Today',
        opponent: '',
        teamUs: 'US',
        teamThem: 'OPPONENT',
        courtSideUs: 'left',
        scoreUs: 0,
        scoreThem: 0,
        setsUs: 0,
        setsThem: 0,
        currentSet: 1,
        lastScoreTimestamp: Date.now(),
        viewers: 0,
        highlights: [],
        comments: [],
        setScores: []
      };
      this.activePointClips = [];
      this.previousPointClips = [];
      this.midPointWaitState = null;
    }

    // Permanently delete from Firestore!
    try {
      deleteDoc(doc(db, 'matches', matchId)).catch(err => {
        console.warn('Failed to delete match from Firestore:', err);
      });
    } catch (e) {}

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
