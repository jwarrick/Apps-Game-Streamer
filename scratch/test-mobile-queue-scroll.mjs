import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  // Test local build by running a local vite preview or checking directly
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  const reelBtn = await heyheyCard.$('button:has-text("Reel"), .btn-play-reel');
  await reelBtn.click();
  await page.waitForTimeout(2000);

  const toggleBtn = await page.$('#btn-toggle-queue');
  await toggleBtn.click();
  await page.waitForTimeout(1000);

  // Inject current flex-shrink CSS to test before deploy
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.reel-playlist-row { flex-shrink: 0 !important; min-height: 52px !important; }';
    document.head.appendChild(style);
  });

  const metrics = await page.evaluate(() => {
    const list = document.querySelector('#reel-playlist-list');
    const panel = document.querySelector('#reel-playlist-panel');
    return {
      panelHeight: panel?.clientHeight,
      listHeight: list?.clientHeight,
      scrollHeight: list?.scrollHeight,
      isScrollable: list ? (list.scrollHeight > list.clientHeight) : false
    };
  });
  console.log('Mobile queue scroll metrics with flex-shrink:0:', JSON.stringify(metrics, null, 2));

  // Perform scroll down
  const scrollResult = await page.evaluate(() => {
    const list = document.querySelector('#reel-playlist-list');
    list.scrollTop = 120;
    return {
      scrollTop: list.scrollTop
    };
  });
  console.log('Scroll down result:', JSON.stringify(scrollResult, null, 2));

  await page.screenshot({ path: 'scratch/mobile_queue_scroll_fixed.png' });
  console.log('Screenshot saved to scratch/mobile_queue_scroll_fixed.png');

  await browser.close();
})();
