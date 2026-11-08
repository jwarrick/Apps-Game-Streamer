// scratch/test-boundary-timing.mjs
// Test exact point boundary timestamps and rapid click sequences

global.window = { location: { pathname: '', hash: '' } };
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

console.log('--- Testing Store Score Action & Finalized Listeners ---');

const scoreActions = [];
const finalizedPoints = [];

store.onScoreActionOccurred((ts) => {
  scoreActions.push(ts);
});

store.onPointFinalized((pt) => {
  finalizedPoints.push({
    startTime: pt.startTime,
    endTime: pt.endTime,
    score: pt.finalScore
  });
});

// Test 1: Single click at t=1000
console.log('Test 1: Single click at t=1000');
store.onScoreAction(1000);
console.log('Score action fired immediately. scoreActions count:', scoreActions.length);
if (scoreActions.length !== 1 || scoreActions[0] !== 1000) {
  console.error('FAIL: scoreActions did not fire immediately with 1000');
  process.exit(1);
}

// Wait 3.2s for debounce to finalize
await new Promise(r => setTimeout(r, 3200));

console.log('Finalized points after 3.2s:', finalizedPoints.length);
if (finalizedPoints.length !== 1) {
  console.error('FAIL: Expected 1 finalized point');
  process.exit(1);
}
console.log('Point 0 endTime:', finalizedPoints[0].endTime, '(expected 1000)');
if (finalizedPoints[0].endTime !== 1000) {
  console.error('FAIL: Point 0 endTime should be 1000');
  process.exit(1);
}

// Test 2: User prompt 6 sequence: 5s, 10s, 11s, 13s, 17s
// String of clicks:
// 5s (alone) -> commits at 5s + 3s = 8s
// 10s, 11s, 13s (rapid string < 3s apart) -> commits at 13s + 3s = 16s with endTime = 13s
// 17s (alone) -> commits at 17s + 3s = 20s with endTime = 17s
console.log('\nTest 2: Complex rapid sequence (5s, 10s, 11s, 13s, 17s)');
finalizedPoints.length = 0;
scoreActions.length = 0;

// t = 5000
store.onScoreAction(5000);
// Wait 3.2s -> commits point at 5000
await new Promise(r => setTimeout(r, 3200));

console.log('After 5s click + 3.2s: finalizedPoints:', finalizedPoints.length);
if (finalizedPoints.length !== 1 || finalizedPoints[0].endTime !== 5000) {
  console.error('FAIL: Expected finalized point at 5000');
  process.exit(1);
}

// String of rapid clicks: 10s, 11s, 13s
store.onScoreAction(10000);
await new Promise(r => setTimeout(r, 1000)); // 1s later
store.onScoreAction(11000);
await new Promise(r => setTimeout(r, 1000)); // 1s later (2s from 10s, 1s from 11s)
store.onScoreAction(13000);

// Wait 1.5s: 13s click was 1.5s ago, so debounce must NOT have finalized yet!
await new Promise(r => setTimeout(r, 1500));
console.log('After 13s click + 1.5s: finalizedPoints count:', finalizedPoints.length, '(should still be 1)');
if (finalizedPoints.length !== 1) {
  console.error('FAIL: Debounce finalized too early! Count:', finalizedPoints.length);
  process.exit(1);
}

// Wait another 1.8s (total 3.3s since 13000): should finalize now!
await new Promise(r => setTimeout(r, 1800));
console.log('After 13s click + 3.3s: finalizedPoints count:', finalizedPoints.length, '(should be 2)');
if (finalizedPoints.length !== 2) {
  console.error('FAIL: Expected 2 finalized points');
  process.exit(1);
}
console.log('Point 1 endTime:', finalizedPoints[1].endTime, '(expected 13000)');
if (finalizedPoints[1].endTime !== 13000) {
  console.error('FAIL: Point 1 endTime should be 13000 (last click in string)');
  process.exit(1);
}

// Now 17s click (alone)
store.onScoreAction(17000);
await new Promise(r => setTimeout(r, 3200));
console.log('After 17s click + 3.2s: finalizedPoints count:', finalizedPoints.length, '(should be 3)');
if (finalizedPoints.length !== 3) {
  console.error('FAIL: Expected 3 finalized points');
  process.exit(1);
}
console.log('Point 2 endTime:', finalizedPoints[2].endTime, '(expected 17000)');
if (finalizedPoints[2].endTime !== 17000) {
  console.error('FAIL: Point 2 endTime should be 17000');
  process.exit(1);
}

console.log('\n✓ ALL POINT BOUNDARY TESTS PASSED!');
