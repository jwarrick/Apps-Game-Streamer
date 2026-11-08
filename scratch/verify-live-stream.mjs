import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log('Navigating directly to https://gamestreamer-live.web.app/#/stream...');
  await page.goto('https://gamestreamer-live.web.app/#/stream', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click Player Highlight button
  const btnHighlightPlayer = await page.$('#btn-highlight-player');
  console.log('btnHighlightPlayer exists:', !!btnHighlightPlayer);
  if (btnHighlightPlayer) {
    await btnHighlightPlayer.click();
    await page.waitForTimeout(500);

    const toggleBtn = await page.$('#btn-toggle-point-target');
    const toggleText = await toggleBtn.innerText();
    const hintElem = await page.$('#highlight-target-hint');
    const hintText = await hintElem.innerText();
    console.log('Toggle default:', toggleText, '| Hint:', hintText);

    await toggleBtn.click();
    await page.waitForTimeout(300);
    const toggleText2 = await toggleBtn.innerText();
    const hintText2 = await hintElem.innerText();
    console.log('Toggle clicked:', toggleText2, '| Hint:', hintText2);

    await page.screenshot({ path: 'scratch/verified_highlight_toggle_live.png' });
    console.log('Screenshot saved to scratch/verified_highlight_toggle_live.png');
  }

  await browser.close();
})();
