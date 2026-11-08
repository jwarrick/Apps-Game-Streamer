import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  const reelBtn = await heyheyCard.$('button:has-text("Reel"), .btn-play-reel');
  await reelBtn.click();
  await page.waitForTimeout(3000);

  // Click Show Queue
  const toggleQueueBtn = await page.$('#btn-toggle-queue');
  console.log('Clicking toggle queue button...');
  await toggleQueueBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'scratch/live_reel_queue_open.png' });
  console.log('Screenshot of open queue saved!');

  const state = await page.evaluate(() => {
    const queue = document.querySelector('#reel-playlist-panel');
    const btn = document.querySelector('#btn-toggle-queue');
    const rows = document.querySelectorAll('.reel-playlist-row');
    return {
      queueOpen: queue ? queue.classList.contains('open') : false,
      btnText: btn ? btn.textContent.trim() : null,
      rowCount: rows.length
    };
  });
  console.log('Queue state:', JSON.stringify(state, null, 2));

  await browser.close();
})();
