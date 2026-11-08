import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to gamestreamer-live.web.app...');
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Take screenshot of Hub
  await page.screenshot({ path: 'scratch/hub_view.png' });

  // Look for "Heyhey" match card and its reel button
  const reelBtn = await page.$('button:has-text("Reel"), .btn-play-reel');
  console.log('Reel button found:', !!reelBtn);

  // Also test fetching one of Heyhey's driveFileIds inside the browser
  const fetchResult = await page.evaluate(async () => {
    const fileId = '1-XdJGkh_KUW4_pJWQaEdLleCipsCnuwx';
    const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const res = { direct: null, uc: null };
    try {
      console.log('Fetching directUrl in browser:', directUrl);
      const r1 = await fetch(directUrl);
      res.direct = { ok: r1.ok, status: r1.status, type: r1.type };
      if (r1.ok) {
        const b = await r1.blob();
        res.direct.blobSize = b.size;
      }
    } catch (e) {
      res.direct = { error: e.message };
    }

    try {
      console.log('Fetching ucUrl in browser:', ucUrl);
      const r2 = await fetch(ucUrl);
      res.uc = { ok: r2.ok, status: r2.status, type: r2.type };
      if (r2.ok) {
        const b2 = await r2.blob();
        res.uc.blobSize = b2.size;
      }
    } catch (e) {
      res.uc = { error: e.message };
    }

    return res;
  });

  console.log('Fetch evaluation results:', JSON.stringify(fetchResult, null, 2));

  // Now click on the Heyhey match card's reel button if available
  const heyheyCard = await page.$('.match-card:has-text("Heyhey")');
  if (heyheyCard) {
    console.log('Found Heyhey match card!');
    const cardReelBtn = await heyheyCard.$('button:has-text("Reel"), .btn-play-reel');
    if (cardReelBtn) {
      console.log('Clicking Heyhey reel button...');
      await cardReelBtn.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: 'scratch/heyhey_reel_open.png' });

      // Inspect reel video element
      const videoState = await page.evaluate(() => {
        const v = document.querySelector('#reel-video-elem');
        const overlay = document.querySelector('#reel-loading-overlay');
        const pending = document.querySelector('#reel-pending-overlay');
        return {
          videoSrc: v ? v.src : null,
          videoPaused: v ? v.paused : null,
          videoDuration: v ? v.duration : null,
          videoCurrentTime: v ? v.currentTime : null,
          videoError: v && v.error ? { code: v.error.code, message: v.error.message } : null,
          loadingOverlayVisible: overlay ? overlay.style.display !== 'none' : false,
          pendingOverlayVisible: pending ? pending.style.display !== 'none' : false,
          debugContent: document.querySelector('#reel-debug-content')?.innerText
        };
      });
      console.log('Reel player video state:', JSON.stringify(videoState, null, 2));
    }
  }

  await browser.close();
})();
