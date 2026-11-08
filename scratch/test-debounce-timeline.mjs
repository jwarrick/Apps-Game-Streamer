// Unit test simulating the user's exact debounce sequence:
// Clicks at 5s, 10s, 11s, 13s, 17s.
// Expected recorded point ticks: 5s, 13s, 17s.

class MockStore {
  constructor() {
    this.recordedBoundaries = [];
    this.pointBuffer = null;
    this.initPointBuffers();
  }

  initPointBuffers() {
    const now = 0;
    this.pointBuffer = {
      current: {
        startTime: now,
        lastScoreActionTimestamp: null
      },
      previous: null,
      graceTimer: null,
      pendingClickTimestamp: null
    };
  }

  onScoreAction(actionTimestamp) {
    if (!this.pointBuffer) this.initPointBuffers();

    this.pointBuffer.pendingClickTimestamp = actionTimestamp;
    if (this.pointBuffer.current) {
      this.pointBuffer.current.lastScoreActionTimestamp = actionTimestamp;
    }

    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
    }

    this.pointBuffer.graceTimer = setTimeout(() => {
      this.finalizePointBoundary();
    }, 3000);
  }

  finalizePointBoundary() {
    if (!this.pointBuffer) return;
    if (this.pointBuffer.graceTimer) {
      clearTimeout(this.pointBuffer.graceTimer);
      this.pointBuffer.graceTimer = null;
    }

    const cur = this.pointBuffer.current;
    const endTime = this.pointBuffer.pendingClickTimestamp || cur.lastScoreActionTimestamp || 0;
    this.pointBuffer.pendingClickTimestamp = null;

    const completedPoint = {
      startTime: cur.startTime,
      endTime: endTime
    };

    this.recordedBoundaries.push(completedPoint);
    this.pointBuffer.previous = completedPoint;

    this.pointBuffer.current = {
      startTime: endTime,
      lastScoreActionTimestamp: null
    };
  }
}

// Simulate timeline with fake timers
const store = new MockStore();

// Virtual timeline in ms
let currentTime = 0;
const timers = [];

// Monkey-patch setTimeout / clearTimeout for deterministic simulation
global.setTimeout = (fn, delay) => {
  const timer = { fn, fireTime: currentTime + delay, id: Math.random() };
  timers.push(timer);
  return timer;
};

global.clearTimeout = (timer) => {
  const idx = timers.indexOf(timer);
  if (idx !== -1) timers.splice(idx, 1);
};

function advanceTimeTo(targetTime) {
  while (true) {
    // Find earliest pending timer <= targetTime
    timers.sort((a, b) => a.fireTime - b.fireTime);
    if (timers.length > 0 && timers[0].fireTime <= targetTime) {
      const nextTimer = timers.shift();
      currentTime = nextTimer.fireTime;
      nextTimer.fn();
    } else {
      break;
    }
  }
  currentTime = targetTime;
}

// User clicks:
// 1) t = 5s (5000ms)
advanceTimeTo(5000);
console.log(`[t=${currentTime/1000}s] Score Click!`);
store.onScoreAction(5000);

// Advance to t = 9s (5s click will finalize at 8s)
advanceTimeTo(9000);

// 2) t = 10s (10000ms)
advanceTimeTo(10000);
console.log(`[t=${currentTime/1000}s] Score Click!`);
store.onScoreAction(10000);

// 3) t = 11s (11000ms, <3s after 10s)
advanceTimeTo(11000);
console.log(`[t=${currentTime/1000}s] Score Click!`);
store.onScoreAction(11000);

// 4) t = 13s (13000ms, <3s after 11s)
advanceTimeTo(13000);
console.log(`[t=${currentTime/1000}s] Score Click!`);
store.onScoreAction(13000);

// Advance to t = 16.5s (13s click will finalize at 16s)
advanceTimeTo(16500);

// 5) t = 17s (17000ms)
advanceTimeTo(17000);
console.log(`[t=${currentTime/1000}s] Score Click!`);
store.onScoreAction(17000);

// Advance to t = 22s (17s click will finalize at 20s)
advanceTimeTo(22000);

console.log('\n--- Recorded Boundaries ---');
store.recordedBoundaries.forEach((pt, idx) => {
  console.log(`Point ${idx + 1}: startTime = ${pt.startTime / 1000}s, endTime = ${pt.endTime / 1000}s (duration = ${(pt.endTime - pt.startTime) / 1000}s)`);
});

const endTimes = store.recordedBoundaries.map(pt => pt.endTime / 1000);
console.log('\nRecorded point click timestamps:', endTimes);
if (JSON.stringify(endTimes) === JSON.stringify([5, 13, 17])) {
  console.log('✅ PASS! Exactly 5s, 13s, 17s recorded!');
} else {
  console.error('❌ FAIL! Expected [5, 13, 17], got:', endTimes);
  process.exit(1);
}
