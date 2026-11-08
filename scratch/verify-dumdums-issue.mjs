import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  console.log('Navigating to live app...');
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check if Dumdums card exists
  const dumdumsCard = await page.$('.match-card:has-text("Dumdums")');
  if (!dumdumsCard) {
    console.error('Dumdums match card not found!');
    await browser.close();
    return;
  }
  console.log('✓ Found Dumdums card');

  const clip0Btn = await page.$('.btn-play-clip[data-clip-id="h_1792935688816_4zf62f"]');
  const clip1Btn = await page.$('.btn-play-clip[data-clip-id="h_1792935707850_bh9j9j"]');
  const reelBtn = await page.$('.btn-play-reel[data-match-id="match_1792935638228"]');

  console.log(`clip0Btn found: ${!!clip0Btn}, clip1Btn found: ${!!clip1Btn}, reelBtn found: ${!!reelBtn}`);

  // ==========================================
  // TEST 1: Single Highlight Player on Clip 0 ("Amazing Dig")
  // ==========================================
  console.log('\n========================================');
  console.log('TEST 1: Playing Clip 0 ("Amazing Dig") in ReplayPlayer...');
  console.log('========================================');
  await clip0Btn.click();
  await page.waitForTimeout(1000);

  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate((sec) => {
      const v = document.querySelector('#replay-video-elem');
      const errBox = document.querySelector('#replay-error-msg');
      const loader = document.querySelector('#replay-loading-overlay');
      const loaderText = document.querySelector('#replay-loading-text')?.textContent;
      return {
        sec,
        hasVideo: !!v,
        src: v ? v.src : null,
        error: v && v.error ? { code: v.error.code, message: v.error.message } : null,
        readyState: v ? v.readyState : null,
        networkState: v ? v.networkState : null,
        paused: v ? v.paused : null,
        duration: v ? v.duration : null,
        currentTime: v ? v.currentTime : null,
        loaderVisible: loader ? loader.style.display !== 'none' : false,
        loaderText,
        errorBoxVisible: errBox ? errBox.style.display !== 'none' : false
      };
    }, i + 1);

    console.log(`[Clip 0 - Amazing Dig] t=${i+1}s: readyState=${state.readyState}, duration=${state.duration}, error=${JSON.stringify(state.error)}, loaderVisible=${state.loaderVisible} ("${state.loaderText}"), src=${state.src ? state.src.slice(0, 30) : 'none'}`);
    if (state.error) {
      console.log('=> Video element encountered playback ERROR:', state.error);
      break;
    }
    if (state.duration && state.duration > 0) {
      console.log('=> Video is playing!');
      break;
    }
  }

  await page.screenshot({ path: 'scratch/dumdums_clip0_replay.png' });
  console.log('Saved screenshot scratch/dumdums_clip0_replay.png');

  // Close ReplayPlayer
  const closeBtn1 = await page.$('#btn-close-replay');
  if (closeBtn1) await closeBtn1.click();
  await page.waitForTimeout(1500);

  // ==========================================
  // TEST 2: Single Highlight Player on Clip 1 ("Big Block")
  // ==========================================
  console.log('\n========================================');
  console.log('TEST 2: Playing Clip 1 ("Big Block") in ReplayPlayer...');
  console.log('========================================');
  await clip1Btn.click();
  await page.waitForTimeout(1000);

  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate((sec) => {
      const v = document.querySelector('#replay-video-elem');
      const errBox = document.querySelector('#replay-error-msg');
      const loader = document.querySelector('#replay-loading-overlay');
      const loaderText = document.querySelector('#replay-loading-text')?.textContent;
      return {
        sec,
        hasVideo: !!v,
        src: v ? v.src : null,
        error: v && v.error ? { code: v.error.code, message: v.error.message } : null,
        readyState: v ? v.readyState : null,
        networkState: v ? v.networkState : null,
        paused: v ? v.paused : null,
        duration: v ? v.duration : null,
        currentTime: v ? v.currentTime : null,
        loaderVisible: loader ? loader.style.display !== 'none' : false,
        loaderText
      };
    }, i + 1);

    console.log(`[Clip 1 - Big Block] t=${i+1}s: readyState=${state.readyState}, duration=${state.duration}, error=${JSON.stringify(state.error)}, loaderVisible=${state.loaderVisible}, src=${state.src ? state.src.slice(0, 30) : 'none'}`);
    if (state.duration && state.duration > 0) {
      console.log('=> Video is playing!');
      break;
    }
    if (state.error) {
      console.log('=> Video element encountered playback ERROR:', state.error);
      break;
    }
  }

  await page.screenshot({ path: 'scratch/dumdums_clip1_replay.png' });
  console.log('Saved screenshot scratch/dumdums_clip1_replay.png');

  // Close ReplayPlayer
  const closeBtn2 = await page.$('#btn-close-replay');
  if (closeBtn2) await closeBtn2.click();
  await page.waitForTimeout(1500);

  // ==========================================
  // TEST 3: Highlight Reel Player on Dumdums Match
  // ==========================================
  console.log('\n========================================');
  console.log('TEST 3: Opening Highlight Reel Player for Dumdums...');
  console.log('========================================');
  await reelBtn.click();
  await page.waitForTimeout(1500);

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const reelState = await page.evaluate((sec) => {
      const v = document.querySelector('#reel-video-elem');
      const badgeScore = document.querySelector('#reel-badge-score')?.textContent;
      const badgeLabel = document.querySelector('#reel-badge-label')?.textContent;
      const loader = document.querySelector('#reel-loading-overlay');
      return {
        sec,
        badgeScore,
        badgeLabel,
        src: v ? v.src : null,
        error: v && v.error ? { code: v.error.code, message: v.error.message } : null,
        readyState: v ? v.readyState : null,
        paused: v ? v.paused : null,
        duration: v ? v.duration : null,
        currentTime: v ? v.currentTime : null,
        loaderVisible: loader ? loader.style.display !== 'none' : false
      };
    }, i + 1);

    console.log(`[HighlightReelPlayer] t=${i+1}s: clip="${reelState.badgeLabel}", score="${reelState.badgeScore}", readyState=${reelState.readyState}, duration=${reelState.duration}, error=${JSON.stringify(reelState.error)}, currentTime=${reelState.currentTime}`);
  }

  await page.screenshot({ path: 'scratch/dumdums_reel_playback.png' });
  console.log('Saved screenshot scratch/dumdums_reel_playback.png');

  await browser.close();
})();
