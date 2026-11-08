import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  console.log('Found Heyhey card. Expanding highlights sublist...');
  const expandBtn = await heyheyCard.$('.match-card-header, .btn-expand-highlights');
  if (expandBtn) await expandBtn.click();
  await page.waitForTimeout(1000);

  // Click on the first highlight item
  const firstHighlight = await heyheyCard.$('.highlight-item, .hub-highlight-row');
  console.log('First highlight item found:', !!firstHighlight);
  if (firstHighlight) {
    await firstHighlight.click();
    console.log('Clicked single highlight! Waiting for ReplayPlayer...');

    let replayState = null;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      replayState = await page.evaluate(() => {
        const v = document.querySelector('#replay-video-elem');
        const loader = document.querySelector('#replay-loading-overlay');
        const controls = document.querySelector('#replay-controls-overlay');
        const iframe = document.querySelector('iframe');
        return {
          hasVideo: !!v,
          src: v ? v.src : null,
          paused: v ? v.paused : null,
          duration: v ? v.duration : null,
          currentTime: v ? v.currentTime : null,
          videoWidth: v ? v.videoWidth : null,
          videoHeight: v ? v.videoHeight : null,
          controlsVisible: controls ? controls.style.display !== 'none' : false,
          hasIframe: !!iframe,
          loading: loader ? loader.style.display !== 'none' : false
        };
      });

      if (replayState.src && replayState.src.startsWith('blob:') && replayState.duration > 0) {
        console.log(`ReplayPlayer started playing in ${i + 1}s!`);
        break;
      }
    }

    console.log('\n=== ReplayPlayer State ===\n', JSON.stringify(replayState, null, 2));
    await page.screenshot({ path: 'scratch/live_replay_verified.png' });
    console.log('Saved screenshot to scratch/live_replay_verified.png');
  }

  await browser.close();
})();
