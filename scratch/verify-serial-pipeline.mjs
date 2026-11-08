import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pipelineEvents = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Pipeline: downloading') || text.includes('Pipeline: clip') || text.includes('ready in memory')) {
      const time = new Date().toISOString().split('T')[1].slice(0, 8);
      console.log(`[${time}] ${text}`);
      pipelineEvents.push({ time, text });
    }
  });

  console.log('Navigating to gamestreamer-live.web.app...');
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  const reelBtn = await heyheyCard.$('button:has-text("Reel"), .btn-play-reel');

  console.log('\nOpening Heyhey Reel Player (tracing serial downloads)...');
  await reelBtn.click();

  // Watch for 20 seconds to trace the sequence
  await page.waitForTimeout(20000);

  console.log('\n=== Summary of Pipeline Events ===');
  pipelineEvents.forEach(e => console.log(`  ${e.time} -> ${e.text}`));

  await browser.close();
})();
