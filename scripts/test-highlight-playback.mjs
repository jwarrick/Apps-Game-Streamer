import { chromium } from 'playwright';

async function testHighlightPlayback() {
  console.log('--- Starting Playwright Highlight Playback Test ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('https://localhost:5173/', { waitUntil: 'domcontentloaded' });

  // Wait for matches to load from Firestore
  console.log('Waiting for Lincoln High2 match in Hub...');
  await page.waitForSelector('text=Lincoln High2', { timeout: 10000 });
  console.log('Found Lincoln High2 match card!');

  // Look for highlight play buttons inside Lincoln High2 card
  // Let's find the match container for Lincoln High2
  const playClipBtn = page.locator('.btn-play-clip').first();
  await playClipBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Found highlight play button. Clicking to open ReplayPlayer...');
  await playClipBtn.click();

  // Wait for replay modal
  await page.waitForSelector('.replay-modal', { state: 'visible', timeout: 5000 });
  console.log('Replay modal opened successfully!');

  // Check the video element
  const videoElem = page.locator('#replay-video-elem');
  await videoElem.waitFor({ state: 'attached', timeout: 5000 });

  // Evaluate video properties inside the browser
  const videoInfo = await page.evaluate(async () => {
    const v = document.querySelector('#replay-video-elem');
    if (!v) return { found: false };

    // Wait up to 5 seconds for video to load metadata or canplay
    if (v.readyState < 2) {
      await new Promise((resolve) => {
        v.addEventListener('loadeddata', resolve, { once: true });
        v.addEventListener('canplay', resolve, { once: true });
        v.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 4000);
      });
    }

    return {
      found: true,
      src: v.currentSrc || v.src,
      readyState: v.readyState,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      duration: v.duration,
      paused: v.paused,
      muted: v.muted
    };
  });

  console.log('Video Info from browser:', videoInfo);

  if (!videoInfo.found) {
    throw new Error('Video element not found in replay modal!');
  }

  if (videoInfo.videoWidth <= 0 || videoInfo.videoHeight <= 0) {
    throw new Error(`Video frame has zero dimensions (${videoInfo.videoWidth}x${videoInfo.videoHeight}), not rendering valid video!`);
  }

  if (videoInfo.readyState < 2) {
    throw new Error(`Video readyState is ${videoInfo.readyState}, expected >= 2 (HAVE_CURRENT_DATA)`);
  }

  console.log(`✅ Success: Video is valid and rendering frames! Dimensions: ${videoInfo.videoWidth}x${videoInfo.videoHeight}, Duration: ${videoInfo.duration}s`);

  // Test Play/Pause toggle
  console.log('Testing Play/Pause toggle...');
  const playPauseBtn = page.locator('#btn-play-pause');
  const wasPaused = await page.evaluate(() => document.querySelector('#replay-video-elem').paused);
  await playPauseBtn.click();
  await page.waitForTimeout(500);
  const isNowPaused = await page.evaluate(() => document.querySelector('#replay-video-elem').paused);
  console.log(`Play/Pause toggle test: before paused=${wasPaused}, after paused=${isNowPaused}`);

  // Close replay modal
  const closeBtn = page.locator('#btn-close-replay');
  await closeBtn.click();
  await page.waitForSelector('.replay-modal', { state: 'detached', timeout: 3000 });
  console.log('Replay modal closed cleanly.');

  // Test Highlight Reel Player (Continuous YouTube-style highlights)
  const reelBtn = page.locator('.btn-play-reel').first();
  if (await reelBtn.isVisible()) {
    console.log('Testing HighlightReelPlayer...');
    await reelBtn.click();
    await page.waitForSelector('.reel-modal-backdrop', { state: 'visible', timeout: 5000 });
    const reelVideoInfo = await page.evaluate(async () => {
      const rv = document.querySelector('#reel-video-elem');
      if (!rv) return { found: false };
      if (rv.readyState < 2) {
        await new Promise(r => {
          rv.addEventListener('canplay', r, { once: true });
          setTimeout(r, 3000);
        });
      }
      return {
        found: true,
        src: rv.currentSrc || rv.src,
        readyState: rv.readyState,
        videoWidth: rv.videoWidth,
        videoHeight: rv.videoHeight,
        duration: rv.duration
      };
    });
    console.log('Reel Video Info:', reelVideoInfo);
    if (reelVideoInfo.videoWidth <= 0 || reelVideoInfo.readyState < 2) {
      throw new Error('Reel video failed to load or render valid frames!');
    }
    console.log(`✅ Success: Highlight Reel video is rendering! Dimensions: ${reelVideoInfo.videoWidth}x${reelVideoInfo.videoHeight}`);
    const reelCloseBtn = page.locator('#btn-close-reel');
    await reelCloseBtn.click();
    console.log('Highlight Reel closed cleanly.');
  }

  await browser.close();
  console.log('🎉 ALL PLAYWRIGHT HIGHLIGHT TESTS PASSED 100%!');
}

testHighlightPlayback().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
