// Test store.js directly in Node
// We mock browser globals localStorage and navigator if needed

global.window = {
  location: { pathname: '', hash: '' }
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = v; },
  removeItem(k) { delete this.store[k]; }
};
Object.defineProperty(global, 'navigator', {
  value: { vibrate: () => {} },
  configurable: true,
  writable: true
});

const { store } = await import('../src/services/store.js');

console.log('Testing store.js pointBuffer and debounce logic...');

const finalizedPoints = [];
store.onPointFinalized((pt) => {
  finalizedPoints.push({
    set: pt.finalSet,
    score: pt.finalScore,
    startTime: pt.startTime,
    endTime: pt.endTime
  });
});

// Case 1: Click at t = 1000
const t1 = 1000;
store.onScoreAction(t1);
console.log('Action at t=1000. Pending timer active:', !!(store.pointBuffer && store.pointBuffer.graceTimer));

// Wait 3200ms
await new Promise(r => setTimeout(r, 3200));

console.log('Finalized points after single click:', finalizedPoints.length);
if (finalizedPoints.length !== 1) {
  console.error('FAIL: Expected 1 finalized point, got', finalizedPoints.length);
  process.exit(1);
}
console.log('Point 1 endTime:', finalizedPoints[0].endTime, 'expected:', t1);

// Case 2: Rapid string of clicks at t=5000, t=5500, t=6500 (<3s apart)
const t2a = 5000;
const t2b = 5500;
const t2c = 6500;

store.onScoreAction(t2a);
await new Promise(r => setTimeout(r, 500));
store.onScoreAction(t2b);
await new Promise(r => setTimeout(r, 1000));
store.onScoreAction(t2c);

// Wait 1500ms (only 1.5s since t2c): should NOT be committed yet
await new Promise(r => setTimeout(r, 1500));
console.log('Finalized count mid-debounce (should still be 1):', finalizedPoints.length);
if (finalizedPoints.length !== 1) {
  console.error('FAIL: Point committed too early before 3s debounce!');
  process.exit(1);
}

// Wait another 1800ms (> 3s since t2c)
await new Promise(r => setTimeout(r, 1800));
console.log('Finalized count after 3s debounce (should be 2):', finalizedPoints.length);
if (finalizedPoints.length !== 2) {
  console.error('FAIL: Point was not committed after 3s debounce!');
  process.exit(1);
}

const point2 = finalizedPoints[1];
console.log('Point 2 endTime:', point2.endTime, 'expected:', t2c);
if (point2.endTime !== t2c) {
  console.error('FAIL: Point 2 endTime should be the last click in the string (t2c = 6500), got:', point2.endTime);
  process.exit(1);
}

console.log('Point 2 startTime:', point2.startTime, 'expected:', t1);
if (point2.startTime !== t1) {
  console.error('FAIL: Point 2 startTime should be the end of Point 1 (t1 = 1000), got:', point2.startTime);
  process.exit(1);
}

console.log('\n✅ ALL STORE DEBOUNCE TESTS PASSED PERFECTLY!');
process.exit(0);
