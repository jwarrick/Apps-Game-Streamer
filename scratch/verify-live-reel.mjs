import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser to test live reel playback...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('HighlightReelPlayer') || text.includes('Pipeline') || text.includes('error')) {
      console.log('PAGE:', text);
    }
  });

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Find Heyhey match card
  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  if (!heyheyCard) {
    console.error('Heyhey match card not found!');
    await browser.close();
    process.exit(1);
  }

  console.log('Found Heyhey match card. Clicking "▶ Reel (7)" button...');
  const reelBtn = await heyheyCard.$('button:has-text("Reel"), .btn-play-reel');
  if (!reelBtn) {
    console.error('Reel button on Heyhey card not found!');
    await browser.close();
    process.exit(1);
  }

  await reelBtn.click();
  console.log('Reel button clicked! Waiting for video to buffer & play from Mail Slot...');

  // Wait up to 25 seconds for video to play
  let videoState = null;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    videoState = await page.evaluate(() => {
      const v = document.querySelector('#reel-video-elem');
      const loader = document.querySelector('#reel-loading-overlay');
      return {
        hasVideoElem: !!v,
        src: v ? v.src : null,
        paused: v ? v.paused : null,
        currentTime: v ? v.currentTime : null,
        duration: v ? v.duration : null,
        videoWidth: v ? v.videoWidth : null,
        videoHeight: v ? v.videoHeight : null,
        readyState: v ? v.readyState : null,
        isLoading: loader ? loader.style.display !== 'none' : false,
        debugText: document.querySelector('#reel-debug-content')?.innerText
      };
    });

    if (videoState.src && videoState.src.startsWith('blob:') && videoState.readyState >= 2) {
      console.log(`Video started playing in ${i + 1}s!`);
      break;
    }
  }

  console.log('\n=== Live Video State ===\n', JSON.stringify(videoState, null, 2));

  await page.screenshot({ path: 'scratch/live_reel_playback_verified.png' });
  console.log('Screenshot saved to scratch/live_reel_playback_verified.png');

  await browser.close();

  if (videoState && videoState.src && videoState.src.startsWith('blob:')) {
    console.log('\n✅ VERIFICATION PASSED: Video is playing from Drive via native HTML5 blob!');
    process.exit(0);
  } else {
    console.error('\n❌ VERIFICATION FAILED: Video did not start playing.');
    process.exit(1);
  }
})();
