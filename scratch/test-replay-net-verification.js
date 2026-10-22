import fs from 'fs';
import { getTennisNetIcon, TENNIS_NET_DATA_URI } from '../src/components/icons.js';
import { ReplayPlayer } from '../src/components/ReplayPlayer.js';

console.log('--- 1. Testing getTennisNetIcon ---');
const iconHtml = getTennisNetIcon(22, 'pill-tennis-net-img');
console.log('Icon HTML:', iconHtml.slice(0, 100) + '...');

if (!iconHtml.includes('src="data:image/png;base64,')) {
  console.error('FAIL: getTennisNetIcon does not contain embedded base64 data URI');
  process.exit(1);
}
if (!iconHtml.includes('width="22"')) {
  console.error('FAIL: getTennisNetIcon width not set correctly');
  process.exit(1);
}
if (!iconHtml.includes('pill-tennis-net-img')) {
  console.error('FAIL: extraClass not applied');
  process.exit(1);
}

// Verify base64 decode
const base64Data = TENNIS_NET_DATA_URI.replace('data:image/png;base64,', '');
const buf = Buffer.from(base64Data, 'base64');
console.log('Decoded PNG buffer length:', buf.length);
if (buf.length < 1000) {
  console.error('FAIL: Decoded PNG buffer is suspiciously small');
  process.exit(1);
}
// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
  console.error('FAIL: Not a valid PNG magic header');
  process.exit(1);
}
console.log('✓ PASS: Tennis Net icon data URI is valid, non-blank PNG');

console.log('\n--- 2. Testing ReplayPlayer DOM Structure ---');
// Mock minimal browser globals for testing
global.document = {
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
  createElement: (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      innerHTML: '',
      style: {},
      parentNode: {
        removeChild: () => {},
      },
      querySelector: (selector) => {
        // Simple mock querySelector based on innerHTML match
        if (el.innerHTML.includes(selector.replace('#', 'id="').replace('.', 'class="'))) {
          return {
            tagName: 'DIV',
            style: {},
            classList: { add: () => {}, remove: () => {} },
            innerHTML: '',
            onclick: null,
          };
        }
        return {
          tagName: 'DIV',
          style: {},
          classList: { add: () => {}, remove: () => {} },
          innerHTML: '',
          onclick: null,
        };
      },
      querySelectorAll: () => [],
    };
    return el;
  },
};
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

const dummyClip = {
  id: 'clip_1',
  videoUrl: 'blob:https://localhost:5173/test.mp4',
  set: 1,
  score: '40-30',
  label: 'Ace',
};

const player = new ReplayPlayer(dummyClip);
console.log('Player rendered innerHTML length:', player.element.innerHTML.length);

if (!player.element.innerHTML.includes('replay-header-overlay')) {
  console.error('FAIL: replay-header-overlay missing');
  process.exit(1);
}
if (!player.element.innerHTML.includes('replay-controls-overlay')) {
  console.error('FAIL: replay-controls-overlay missing');
  process.exit(1);
}
if (!player.element.innerHTML.includes('replay-controls-bar')) {
  console.error('FAIL: replay-controls-bar capsule missing');
  process.exit(1);
}
if (!player.element.innerHTML.includes('btn-seek-back') || !player.element.innerHTML.includes('btn-seek-forward')) {
  console.error('FAIL: Seek buttons missing');
  process.exit(1);
}
if (!player.element.innerHTML.includes('speed-toggle-group')) {
  console.error('FAIL: Speed toggle group missing');
  process.exit(1);
}
console.log('✓ PASS: ReplayPlayer HTML includes overlaid header and controls');

console.log('\n--- 3. Testing CSS for Landscape Orientation & Overlays ---');
const css = fs.readFileSync('src/styles/app.css', 'utf8');

if (!css.includes('.replay-header-overlay')) {
  console.error('FAIL: .replay-header-overlay rule missing in app.css');
  process.exit(1);
}
if (!css.includes('.replay-controls-overlay')) {
  console.error('FAIL: .replay-controls-overlay rule missing in app.css');
  process.exit(1);
}
if (!css.includes('orientation: landscape')) {
  console.error('FAIL: landscape media query missing in app.css');
  process.exit(1);
}
console.log('✓ PASS: app.css contains landscape media queries and overlay styles');

console.log('\n✅ ALL VERIFICATION TESTS PASSED!');
