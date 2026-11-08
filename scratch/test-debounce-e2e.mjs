import { chromium } from 'playwright';

(async () => {
  console.log('Testing Highlight Buffer Indexing & 3s Point Debounce...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the app on localhost dev or build preview
  // We can test by serving dist or preview, or evaluating directly against the bundled/compiled modules
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log('  Browser Log:', text);
    }
  });

  // Navigate to local preview
  await page.goto('http://localhost:4174', { waitUntil: 'networkidle' });

  const testResult = await page.evaluate(async () => {
    const { store } = await import('/src/services/store.js');

    const boundaries = [];
    store.onPointFinalized((pt) => {
      boundaries.push({
        set: pt.finalSet,
        score: pt.finalScore,
        endTime: pt.endTime,
        duration: pt.endTime - pt.startTime
      });
    });

    const t0 = Date.now();

    // 1. Point 1 click at t0
    store.adjustScore('left', 1);
    const hasGraceTimer1 = !!(store.pointBuffer && store.pointBuffer.graceTimer);

    // Wait 3.2s for point 1 to commit
    await new Promise(r => setTimeout(r, 3200));
    const committedCount1 = boundaries.length;

    // 2. Rapid clicks: t=3.3s, t=4.0s, t=4.8s (each < 3s from previous)
    store.adjustScore('left', 1); // 1st click
    await new Promise(r => setTimeout(r, 700));
    store.adjustScore('left', 1); // 2nd click
    await new Promise(r => setTimeout(r, 800));
    const lastClickTime = Date.now();
    store.adjustScore('right', 1); // 3rd click (last in string)

    // Wait 1.5s: should NOT be committed yet!
    await new Promise(r => setTimeout(r, 1500));
    const committedCountMid = boundaries.length;

    // Wait another 1.8s (total > 3s since last click): should be committed now!
    await new Promise(r => setTimeout(r, 1800));
    const committedCountAfter = boundaries.length;

    const lastCommitted = boundaries[boundaries.length - 1];
    const diffFromLastClick = Math.abs(lastCommitted.endTime - lastClickTime);

    return {
      hasGraceTimer1,
      committedCount1,
      committedCountMid,
      committedCountAfter,
      diffFromLastClick,
      boundaries
    };
  });

  console.log('Test Result:', testResult);

  if (testResult.committedCount1 === 1 && testResult.committedCountMid === 1 && testResult.committedCountAfter === 2) {
    console.log('✅ PASS: 3-second debounce window successfully consolidated rapid score clicks into exactly 1 point boundary!');
  } else {
    console.error('❌ FAIL: Debounce did not behave as expected.');
  }

  await browser.close();
})();
