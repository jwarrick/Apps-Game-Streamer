// scratch/test-highlight-pill-flow.mjs
// Test highlight modal interaction, smart target defaulting, and clip creation with video verification

import { chromium } from 'playwright';

(async () => {
  console.log('--- Testing Highlight Modal & Pill Click Flow ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log(' ', text);
    }
  });

  await page.goto('https://localhost:4174', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.location.hash = '#/stream'; });
  await page.waitForTimeout(2500);

  // Scenario 1: Rally finishes, score is updated (+1). Broadcaster clicks "Player ★"
  console.log('\nScenario 1: Broadcaster updates score, then opens Player highlight modal');
  await page.evaluate(() => {
    window.store.adjustScore('left', 1);
  });

  // Score was just adjusted! Open highlight modal
  await page.click('#btn-highlight-player');
  await page.waitForTimeout(400);

  // Check what the modal defaulted to - must strictly be "Current Point" (predictable, no auto-guessing)
  const modalTarget = await page.evaluate(() => {
    const btn = document.querySelector('#btn-toggle-point-target');
    return btn ? btn.textContent.trim() : null;
  });

  console.log('Modal defaulted to target:', modalTarget, '(expected: "Current Point")');
  if (modalTarget !== 'Current Point') {
    console.error('FAIL: Expected modal to default strictly to "Current Point"');
    process.exit(1);
  }

  // Broadcaster explicitly toggles to "Last Point"
  console.log('Toggling modal to "Last Point"...');
  await page.click('#btn-toggle-point-target');
  await page.waitForTimeout(200);

  const toggledTarget = await page.evaluate(() => {
    const btn = document.querySelector('#btn-toggle-point-target');
    return btn ? btn.textContent.trim() : null;
  });
  console.log('Target after toggle:', toggledTarget);
  if (toggledTarget !== 'Last Point') {
    console.error('FAIL: Target did not toggle to "Last Point"');
    process.exit(1);
  }

  // Click a pill: "🪏 Amazing Dig"
  console.log('Clicking "🪏 Amazing Dig" pill...');
  const pillBtn = await page.locator('.btn-highlight-select[data-label="🪏 Amazing Dig"]');
  await pillBtn.click();

  // Wait 1.5s for clip processing
  await page.waitForTimeout(1500);

  // Verify clip was added to matchEntry.highlights
  const highlights = await page.evaluate(() => {
    const s = window.store.getState();
    const m = s.activeMatch;
    const entry = s.matches.find(x => x.id === m.id);
    return entry ? entry.highlights : [];
  });

  console.log('Saved highlights count:', highlights.length);
  if (highlights.length === 0) {
    console.error('FAIL: No highlights saved');
    process.exit(1);
  }

  const h0 = highlights[0];
  console.log('Highlight [0]:', {
    label: h0.label,
    score: h0.score,
    set: h0.set,
    durationMs: h0.durationMs,
    hasVideoUrl: !!h0.videoUrl
  });

  if (!h0.label.includes('Amazing Dig')) {
    console.error('FAIL: Highlight label mismatch');
    process.exit(1);
  }

  console.log('\n✓ Scenario 1 passed: Just-completed point tagged cleanly with score and video!');

  // Scenario 2: Mid-rally highlight (simulate ongoing rally after 16s of score inactivity)
  console.log('\nScenario 2: Mid-rally highlight during active play');
  await page.evaluate(() => {
    // Clear pendingClickTimestamp to simulate play has been active for >16s
    if (window.store.pointBuffer) {
      window.store.pointBuffer.pendingClickTimestamp = null;
      if (window.store.pointBuffer.previous) window.store.pointBuffer.previous.endTime = Date.now() - 20000;
    }
  });

  // Open modal
  await page.click('#btn-highlight-player');
  await page.waitForTimeout(400);

  const modalTarget2 = await page.evaluate(() => {
    const btn = document.querySelector('#btn-toggle-point-target');
    return btn ? btn.textContent.trim() : null;
  });

  console.log('Modal defaulted to target:', modalTarget2, '(expected: "Current Point")');
  if (modalTarget2 !== 'Current Point') {
    console.error('FAIL: Expected modal to default to "Current Point" during active rally');
    process.exit(1);
  }

  // Click "💣 Crazy Kill" pill
  console.log('Clicking "💣 Crazy Kill" pill (should record 2.5s tail padding)...');
  const killPill = await page.locator('.btn-highlight-select[data-label="💣 Crazy Kill"]');
  await killPill.click();

  // Wait 4s for tail padding and processing
  await page.waitForTimeout(4000);

  const highlightsAfter = await page.evaluate(() => {
    const s = window.store.getState();
    const m = s.activeMatch;
    const entry = s.matches.find(x => x.id === m.id);
    return entry ? entry.highlights : [];
  });

  console.log('Highlights count after Scenario 2:', highlightsAfter.length);
  if (highlightsAfter.length !== 2) {
    console.error('FAIL: Expected 2 highlights after Scenario 2, got', highlightsAfter.length);
    process.exit(1);
  }

  const h1 = highlightsAfter.find(h => h.label.includes('Crazy Kill'));
  console.log('Highlight [1] (Mid-Rally with Tail):', {
    label: h1.label,
    score: h1.score,
    set: h1.set,
    durationMs: h1.durationMs,
    hasVideoUrl: !!h1.videoUrl
  });

  if (!h1 || !h1.videoUrl) {
    console.error('FAIL: Scenario 2 highlight was not saved with videoUrl');
    process.exit(1);
  }

  console.log('\n✓ Scenario 2 passed: Mid-rally highlight buffered with 2.5s tail padding cleanly!');

  await browser.close();
  console.log('\n✓ ALL HIGHLIGHT MODAL & PILL TESTS PASSED!');
})();
