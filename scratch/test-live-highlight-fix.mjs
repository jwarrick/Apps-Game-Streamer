import { chromium } from 'playwright';

(async () => {
  console.log('Testing live highlight creation at 0-0 and Last Point score association...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log('  Browser:', text);
    }
  });

  await page.goto('https://gamestreamer-live.web.app/#/stream', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const testReport = await page.evaluate(async () => {
    const results = {};

    // 1. Check initial score is 0-0
    const scoreStr00 = window.store.getScoreSummaryString();
    results.scoreAtStart = scoreStr00;

    // Wait 2 seconds at 0-0 to allow buffer to fill
    await new Promise(r => setTimeout(r, 2000));

    // 2. Open Highlight Modal for Player Highlight at 0-0
    const btnPlayer = document.getElementById('btn-highlight-player');
    if (btnPlayer) btnPlayer.click();
    await new Promise(r => setTimeout(r, 400));

    // Verify Current Point is selected by default
    const toggleBtn = document.getElementById('btn-toggle-point-target');
    results.toggleText = toggleBtn ? toggleBtn.innerText : 'missing';

    // Click first pill (e.g. Amazing Dig or Sweet Serve)
    const firstPill = document.querySelector('.btn-highlight-select');
    if (firstPill) firstPill.click();
    await new Promise(r => setTimeout(r, 1000));

    // Check saved clips in store matches
    const state = window.store.getState();
    const matchEntry = state.matches.find(item => item.id === state.activeMatch.id);
    const clip00 = matchEntry && matchEntry.highlights ? matchEntry.highlights[matchEntry.highlights.length - 1] : null;
    results.clip00 = clip00 ? {
      id: clip00.id,
      score: clip00.score,
      durationMs: clip00.durationMs,
      hasBlob: clip00.hasLocalBlob
    } : null;

    // 3. Now simulate scoring a point (0-0 -> 1-0)
    window.store.adjustScore('left', 1);
    const scoreAfterPoint = window.store.getScoreSummaryString();
    results.scoreAfterPoint = scoreAfterPoint;

    // Immediately open Highlight Modal and select "Last Point" (while in debounce)
    if (btnPlayer) btnPlayer.click();
    await new Promise(r => setTimeout(r, 400));

    // Toggle to Last Point
    if (toggleBtn) toggleBtn.click();
    await new Promise(r => setTimeout(r, 300));
    results.toggleTextAfterSwitch = toggleBtn ? toggleBtn.innerText : 'missing';

    // Click pill to save Last Point highlight
    const secondPill = document.querySelectorAll('.btn-highlight-select')[1];
    if (secondPill) secondPill.click();
    await new Promise(r => setTimeout(r, 1200));

    const matchEntryAfter = state.matches.find(item => item.id === state.activeMatch.id);
    const clipLastPoint = matchEntryAfter && matchEntryAfter.highlights ? matchEntryAfter.highlights[matchEntryAfter.highlights.length - 1] : null;
    results.clipLastPoint = clipLastPoint ? {
      id: clipLastPoint.id,
      score: clipLastPoint.score,
      durationMs: clipLastPoint.durationMs,
      hasBlob: clipLastPoint.hasLocalBlob
    } : null;

    return results;
  });

  console.log('Test Report:', JSON.stringify(testReport, null, 2));

  if (testReport.clip00 && testReport.clip00.score === '0 - 0' && testReport.clip00.durationMs > 1500) {
    console.log('✅ PASS: Highlight at 0-0 successfully created with correct score (0 - 0) and duration (>1.5s)!');
  } else {
    console.error('❌ FAIL: Clip at 0-0 did not meet criteria:', testReport.clip00);
  }

  if (testReport.clipLastPoint && testReport.clipLastPoint.score === '1 - 0' && testReport.clipLastPoint.durationMs > 0) {
    console.log('✅ PASS: Last Point highlight successfully associated with the correct scored point (1 - 0)!');
  } else {
    console.error('❌ FAIL: Last Point highlight score association failed:', testReport.clipLastPoint);
  }

  await browser.close();
})();
