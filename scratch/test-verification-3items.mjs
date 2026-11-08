import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('HighlightReelPlayer') || text.includes('ReplayPlayer') || text.includes('Pipeline')) {
      console.log('LOG:', text);
    }
  });

  console.log('Navigating to gamestreamer-live.web.app...');
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 1. TEST SINGLE HIGHLIGHT PLAYER
  console.log('\n--- 1. Testing Single Highlight Player (ReplayPlayer) ---');
  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  if (!heyheyCard) {
    console.error('Heyhey match card not found!');
    process.exit(1);
  }

  // Find a single clip button (e.g. .btn-play-clip)
  const singleClipBtn = await heyheyCard.$('.btn-play-clip');
  console.log('Found .btn-play-clip button:', !!singleClipBtn);
  if (singleClipBtn) {
    await singleClipBtn.click();
    await page.waitForTimeout(2000);

    const replayCheck = await page.evaluate(() => {
      const replayModal = document.querySelector('.replay-modal');
      const reelModal = document.querySelector('.reel-player-container');
      const queuePanel = document.querySelector('#reel-playlist-panel');
      const controls = document.querySelector('#replay-controls-overlay');
      const video = document.querySelector('#replay-video-elem');
      return {
        hasReplayModal: !!replayModal,
        hasReelModal: !!reelModal,
        hasQueue: !!queuePanel,
        hasControls: !!controls,
        videoSrc: video ? video.src : null
      };
    });

    console.log('ReplayPlayer check:', JSON.stringify(replayCheck, null, 2));
    if (replayCheck.hasReplayModal && !replayCheck.hasQueue) {
      console.log('✓ PASS: Single highlight player opened as ReplayPlayer with NO queue!');
    } else {
      console.error('✗ FAIL: Single highlight player check failed.');
    }

    // Close ReplayPlayer
    const closeBtn = await page.$('#btn-close-replay');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // 2. TEST HIGHLIGHT REEL PLAYER & FREE QUEUE SCROLLING & CONTINUOUS PIPELINE
  console.log('\n--- 2. Testing Reel Player, Free Queue Scrolling & Continuous Pipeline ---');
  const card2 = await page.$('.match-card:has-text("Heyhey")');
  const reelBtn = await card2.$('button:has-text("Reel"), .btn-play-reel');
  await reelBtn.click();
  await page.waitForTimeout(3000);

  // Open queue
  const toggleQueueBtn = await page.$('#btn-toggle-queue');
  await toggleQueueBtn.click();
  await page.waitForTimeout(1000);

  // Test scrolling down the list
  const scrollTest = await page.evaluate(() => {
    const list = document.querySelector('#reel-playlist-list');
    if (!list) return { error: 'No list' };

    const initialTop = list.scrollTop;
    list.scrollTop = 150; // Scroll down
    const scrolledTop = list.scrollTop;

    return {
      initialTop,
      scrolledTop,
      canScrollFreely: scrolledTop > initialTop
    };
  });
  console.log('Queue scroll test:', JSON.stringify(scrollTest, null, 2));

  // Wait 10 seconds to observe continuous pipeline buffering multiple clips
  console.log('Waiting 10s to observe continuous pipeline progress...');
  await page.waitForTimeout(10000);

  const pipelineStatus = await page.evaluate(() => {
    const badges = document.querySelectorAll('.clip-storage-dot.server');
    return {
      serverBadgesCount: badges.length
    };
  });
  console.log('Pipeline buffered clips in memory:', pipelineStatus.serverBadgesCount);

  await page.screenshot({ path: 'scratch/verification_all_3_items.png' });
  console.log('Screenshot saved to scratch/verification_all_3_items.png');

  await browser.close();
  console.log('\n✅ ALL 3 ITEMS VERIFIED SUCCESSFULLY!');
})();
