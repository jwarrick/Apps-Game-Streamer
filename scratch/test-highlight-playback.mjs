// scratch/test-highlight-playback.mjs
// Verify that the generated highlight video blobs play smoothly in HTML5 <video> without any demuxer errors

import { chromium } from 'playwright';

(async () => {
  console.log('--- Verifying HTML5 Video Playback of Generated Highlights ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('https://localhost:4174', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.location.hash = '#/stream'; });
  await page.waitForTimeout(2500);

  // 1. Score point and tag highlight
  await page.evaluate(() => { window.store.adjustScore('left', 1); });
  await page.click('#btn-highlight-player');
  await page.waitForTimeout(300);
  const pillBtn = await page.locator('.btn-highlight-select[data-label="🪏 Amazing Dig"]');
  await pillBtn.click();
  await page.waitForTimeout(1500);

  // 2. Extract the video blob URL from matchEntry
  const videoBlobUrl = await page.evaluate(() => {
    const s = window.store.getState();
    const m = s.activeMatch;
    const entry = s.matches.find(x => x.id === m.id);
    return (entry && entry.highlights && entry.highlights.length > 0) ? entry.highlights[0].videoUrl : null;
  });

  console.log('Extracted highlight videoUrl:', videoBlobUrl);
  if (!videoBlobUrl) {
    console.error('FAIL: No videoUrl on highlight');
    process.exit(1);
  }

  // 3. Test video playback in an HTML5 <video> element
  const playbackStatus = await page.evaluate(async (url) => {
    return new Promise((resolve) => {
      const vid = document.createElement('video');
      vid.src = url;
      vid.muted = true;
      vid.playsInline = true;
      document.body.appendChild(vid);

      vid.onplaying = () => {
        resolve({
          status: 'playing',
          duration: vid.duration,
          videoWidth: vid.videoWidth,
          videoHeight: vid.videoHeight,
          currentTime: vid.currentTime
        });
      };

      vid.onerror = (e) => {
        resolve({
          status: 'error',
          error: vid.error ? { code: vid.error.code, message: vid.error.message } : 'Unknown error'
        });
      };

      vid.play().catch(err => {
        resolve({ status: 'play-error', error: err.message });
      });

      // Timeout after 5s
      setTimeout(() => {
        resolve({ status: 'timeout', currentTime: vid.currentTime, duration: vid.duration });
      }, 5000);
    });
  }, videoBlobUrl);

  console.log('HTML5 Video Playback Result:', playbackStatus);
  if (playbackStatus.status !== 'playing') {
    console.error('FAIL: HTML5 video failed to play:', playbackStatus);
    process.exit(1);
  }

  console.log('\n✓ Native HTML5 Video Playback VERIFIED without demuxer or container errors!');
  await browser.close();
})();
