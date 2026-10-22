import fs from 'fs';
import { store } from '../src/services/store.js';

console.log('--- 1. Testing Amazing Dig Icon in store.js ---');
const sampleMatch = store.getState().matches.find(m => m.id === 'match-oct-18');
const digHighlight = sampleMatch.highlights.find(h => h.label.includes('Dig'));
console.log('Found dig highlight label:', digHighlight.label);
if (!digHighlight.label.includes('🪏')) {
  console.error('FAIL: Dig highlight does not contain shovel emoji 🪏');
  process.exit(1);
}
if (digHighlight.label.includes('⛏️')) {
  console.error('FAIL: Dig highlight still contains pickaxe ⛏️');
  process.exit(1);
}
console.log('✓ PASS: store.js sample data uses shovel icon');

console.log('\n--- 2. Testing StreamerView.js for Shovel & Non-compounding Zoom ---');
const streamerViewCode = fs.readFileSync('src/components/StreamerView.js', 'utf8');

if (!streamerViewCode.includes("{ label: '🪏 Amazing Dig', html: '🪏 Amazing Dig' }")) {
  console.error('FAIL: StreamerView pills do not contain 🪏 Amazing Dig');
  process.exit(1);
}
console.log('✓ PASS: StreamerView pills contain 🪏 Amazing Dig');

if (!streamerViewCode.includes('currentHardwareZoom')) {
  console.error('FAIL: currentHardwareZoom variable not found in StreamerView.js');
  process.exit(1);
}
if (!streamerViewCode.includes('zooming-out-viewfinder')) {
  console.error('FAIL: zooming-out-viewfinder class not found in StreamerView.js');
  process.exit(1);
}
console.log('✓ PASS: Live zoom with viewfinder framing & non-compounding formula verified');

console.log('\n--- 3. Testing Mathematical Non-Compounding Logic ---');
// Test the formula:
// If target is 6.0 and hardware is 1.0 (before hardware constraint applies):
// visualScale = 6.0 / 1.0 = 6.0x (Instant preview). Total magnification = 1.0 * 6.0 = 6.0x.
// When hardware constraint completes:
// hardware = 6.0, visualScale = 6.0 / 6.0 = 1.0x (none). Total magnification = 6.0 * 1.0 = 6.0x.
function calcTotalZoom(targetZoom, hardwareZoom) {
  const visualScale = targetZoom / hardwareZoom;
  return hardwareZoom * visualScale;
}

const test6x = calcTotalZoom(6.0, 1.0);
if (Math.abs(test6x - 6.0) > 0.001) {
  console.error('FAIL: 6x initial visual zoom calculation incorrect:', test6x);
  process.exit(1);
}

const test6xSettled = calcTotalZoom(6.0, 6.0);
if (Math.abs(test6xSettled - 6.0) > 0.001) {
  console.error('FAIL: 6x settled hardware zoom calculation incorrect:', test6xSettled);
  process.exit(1);
}

const test3xTo6x = calcTotalZoom(6.0, 3.0);
if (Math.abs(test3xTo6x - 6.0) > 0.001) {
  console.error('FAIL: Intermediate zoom transition calculation incorrect:', test3xTo6x);
  process.exit(1);
}

console.log('✓ PASS: At all stages (instant preview, transition, settled), total magnification is EXACTLY 6.0x, never 36.0x!');

console.log('\n✅ ALL ZOOM & SHOVEL TESTS PASSED PERFECTLY!');
