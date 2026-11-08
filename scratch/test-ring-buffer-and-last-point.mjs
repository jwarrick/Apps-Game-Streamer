import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting "Last Point" & Edge Cases Test...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors'
    ]
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[StreamerView]') || text.includes('Buffer') || text.includes('highlight') || text.includes('Highlight')) {
      console.log('  [BROWSER LOG]', text);
    }
  });

  await page.goto('https://localhost:4174', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.location.hash = '#/stream';
  });
  await page.waitForTimeout(2500);

  // --- Test Case 1: Highlight "Last Point" at 0-0 before any score has occurred ---
  console.log('\n--- Test Case 1: Tagging Last Point at 0-0 ---');
  // Record in 0-0 buffer for 1.5s
  await page.waitForTimeout(1500);

  await page.click('#btn-highlight-player');
  await page.waitForTimeout(300);

  // Toggle to "Last Point"
  await page.click('#btn-toggle-point-target');
  await page.waitForTimeout(200);

  // Click "Crazy Kill"
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('.btn-highlight-select'));
    const pill = pills.find(p => p.textContent.includes('Crazy Kill'));
    if (pill) pill.click();
  });

  await page.waitForTimeout(1500);

  const zeroZeroHandled = logs.some(l => l.includes('No completed rally exists yet (e.g. at 0-0); finalizing current buffer'));
  console.log(`✓ 0-0 Last Point handled cleanly: ${zeroZeroHandled}`);

  // --- Test Case 2: Early Flush on "Last Point" during 3s debounce ---
  console.log('\n--- Test Case 2: Early Flush on Last Point during debounce ---');
  // Score to trigger debounce
  console.log('Triggering score click (+1)...');
  await page.evaluate(() => {
    window.store.adjustScore('left', 1);
  });
  await page.waitForTimeout(400);

  // Immediately tag "Last Point" within the 3s window (e.g. at 400ms)
  console.log('Immediately tagging Last Point at t=400ms (during 3s debounce)...');
  await page.click('#btn-highlight-team');
  await page.waitForTimeout(300);
  await page.click('#btn-toggle-point-target');
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('.btn-highlight-select'));
    const pill = pills.find(p => p.textContent.includes('Sweet Serve'));
    if (pill) pill.click();
  });

  await page.waitForTimeout(1000);

  const debounceFlushed = logs.some(l => l.includes('Tagging last point'));
  console.log(`✓ Debounce flushed immediately without waiting for 3s: ${debounceFlushed}`);

  // --- Test Case 3: Verify Video Playback for both clips ---
  const validation = await page.evaluate(async () => {
    const s = window.GameStreamer?.store || window.store;
    const activeM = s.getState().activeMatch;
    const matchEntry = (s.getState().matches || []).find(m => m.id === activeM?.id) || activeM;
    const clips = matchEntry?.highlights || [];
    if (clips.length < 2) return { error: `Expected at least 2 clips, got ${clips.length}` };

    const results = [];
    for (const clip of clips) {
      const v = document.createElement('video');
      v.src = clip.videoUrl;
      v.muted = true;
      v.playsInline = true;

      const res = await new Promise(resolve => {
        v.onloadedmetadata = () => {
          v.play().then(() => {
            setTimeout(() => {
              resolve({
                label: clip.label,
                score: clip.score,
                duration: v.duration,
                currentTime: v.currentTime,
                readyState: v.readyState
              });
            }, 500);
          }).catch(err => resolve({ label: clip.label, error: err.message }));
        };
        v.onerror = () => resolve({ label: clip.label, error: 'Video load error' });
        setTimeout(() => resolve({ label: clip.label, error: 'Timeout' }), 3000);
      });
      results.push(res);
    }
    return results;
  });

  console.log('🎬 Video Playback Validation for All Clips:', validation);

  await browser.close();

  const allClipsValid = Array.isArray(validation) && validation.length >= 2 && validation.every(v => !v.error && v.readyState === 4);
  if (zeroZeroHandled && debounceFlushed && allClipsValid) {
    console.log('\n🎉 ALL EDGE CASE & LAST POINT TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
}

runTest().catch(e => {
  console.error('Test crashed:', e);
  process.exit(1);
});
