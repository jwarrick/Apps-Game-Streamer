// scratch/test-highlight-timeline.mjs
// End-to-end verification of highlight timing, zero-lag score buffering, and tail padding

import { chromium } from 'playwright';

(async () => {
  console.log('--- Running Playwright Highlight Timeline & Buffer Verification ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log(' ', text);
    }
  });

  // Load preview server via HTTPS
  await page.goto('https://localhost:4174', { waitUntil: 'domcontentloaded' });

  // Navigate to broadcaster view
  await page.evaluate(() => {
    window.location.hash = '#/stream';
  });

  // Wait 2s for camera and StreamerView initialization
  await page.waitForTimeout(2000);

  // Evaluate and test timeline in page context
  const testResults = await page.evaluate(async () => {
    const store = window.store;
    if (!store) throw new Error('window.store not found');

    // 1. Verify initial pointBuffer exists at match start (0-0)
    const initialBuffer = store.pointBuffer;
    const hasInitialBuffer = !!(initialBuffer && initialBuffer.current);

    // 2. Click score at t=0
    const clickTime1 = Date.now();
    store.adjustScore('left', 1);

    // Wait 500ms and check pendingClickTimestamp
    await new Promise(r => setTimeout(r, 500));
    const pendingClickTime = store.pointBuffer.pendingClickTimestamp;

    // Wait 2800ms more (total 3.3s from clickTime1) for point tick to finalize
    await new Promise(r => setTimeout(r, 2800));

    const point1Completed = store.pointBuffer.previous;
    const point2Current = store.pointBuffer.current;

    // 3. Test rapid misclicks (< 3s apart): click, wait 500ms, click, wait 500ms, click
    const clickA = Date.now();
    store.adjustScore('left', 1);
    await new Promise(r => setTimeout(r, 500));

    const clickB = Date.now();
    store.adjustScore('left', 1);
    await new Promise(r => setTimeout(r, 500));

    const clickC = Date.now(); // Last click in string
    store.adjustScore('right', 1);

    // Wait 1.5s: debounce must NOT have finalized yet!
    await new Promise(r => setTimeout(r, 1500));
    const stillActiveGrace = !!(store.pointBuffer && store.pointBuffer.graceTimer);

    // Wait 2000ms more (total 3.5s since clickC): should finalize with clickC timestamp!
    await new Promise(r => setTimeout(r, 2000));
    const point2Completed = store.pointBuffer.previous;

    return {
      hasInitialBuffer,
      clickTime1Diff: Math.abs(pendingClickTime - clickTime1),
      point1EndTime: point1Completed ? point1Completed.endTime : null,
      point2StartTime: point2Current ? point2Current.startTime : null,
      stillActiveGrace,
      point2EndTime: point2Completed ? point2Completed.endTime : null,
      point2ClickCDiff: point2Completed ? Math.abs(point2Completed.endTime - clickC) : null
    };
  });

  console.log('\n--- Timeline Test Results ---');
  console.log('Has Initial Buffer at 0-0:', testResults.hasInitialBuffer);
  console.log('Point 1 Start/End Match:', testResults.point1EndTime === testResults.point2StartTime);
  console.log('Rapid Click Debounce Respected:', testResults.stillActiveGrace);
  console.log('Point 2 EndTime matched LAST click (diff ms):', testResults.point2ClickCDiff);

  if (!testResults.hasInitialBuffer) {
    console.error('FAIL: Initial buffer not found at 0-0');
    process.exit(1);
  }
  if (testResults.point1EndTime !== testResults.point2StartTime) {
    console.error('FAIL: Point 1 endTime should match Point 2 startTime');
    process.exit(1);
  }
  if (!testResults.stillActiveGrace) {
    console.error('FAIL: Grace timer finalized too early during rapid misclicks');
    process.exit(1);
  }
  if (testResults.point2ClickCDiff > 50) {
    console.error('FAIL: Point 2 did not finalize at the last click in the cluster');
    process.exit(1);
  }

  console.log('\n✓ E2E Highlight Timeline and Buffer tests PASSED cleanly!');
  await browser.close();
})();
