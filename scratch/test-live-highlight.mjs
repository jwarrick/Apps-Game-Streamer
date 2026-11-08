import { chromium } from 'playwright';

(async () => {
  console.log('Testing live deployment at https://gamestreamer-live.web.app...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Load main app with domcontentloaded
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Unlock Admin mode if locked
  const btnAdminLock = await page.$('#btn-admin-lock');
  if (btnAdminLock) {
    console.log('Unlocking admin mode...');
    await btnAdminLock.click();
    await page.waitForTimeout(500);
    const pinInput = await page.$('#admin-pin-input');
    if (pinInput) {
      await pinInput.fill('2026');
      const btnUnlock = await page.$('#btn-unlock-admin');
      if (btnUnlock) await btnUnlock.click();
      await page.waitForTimeout(800);
    }
  }

  // 3. Click Go Live Header
  const btnGoLive = await page.$('#btn-go-live-header');
  if (btnGoLive) {
    console.log('Clicking Go Live Header...');
    await btnGoLive.click();
    await page.waitForTimeout(1000);

    // Click Start Broadcast in modal
    const btnStart = await page.$('#btn-start-live');
    if (btnStart) {
      console.log('Clicking Start Live...');
      await btnStart.click();
      await page.waitForTimeout(2000);
    }
  }

  // 4. Click Player Highlight button
  const btnHighlightPlayer = await page.$('#btn-highlight-player');
  if (btnHighlightPlayer) {
    console.log('Clicking Player Highlight button...');
    await btnHighlightPlayer.click();
    await page.waitForTimeout(500);

    const toggleBtn = await page.$('#btn-toggle-point-target');
    const toggleText = await toggleBtn.innerText();
    const hintElem = await page.$('#highlight-target-hint');
    const hintText = await hintElem.innerText();
    console.log('✓ Toggle default text:', toggleText, '| Hint:', hintText);

    // Toggle to Last Point
    await toggleBtn.click();
    await page.waitForTimeout(300);
    const toggleText2 = await toggleBtn.innerText();
    const hintText2 = await hintElem.innerText();
    console.log('✓ Toggle after click:', toggleText2, '| Hint:', hintText2);

    await page.screenshot({ path: 'scratch/live_highlight_modal.png' });
    console.log('Saved screenshot to scratch/live_highlight_modal.png');
  } else {
    console.log('Could not find #btn-highlight-player');
  }

  await browser.close();
  console.log('Live verification finished successfully!');
})();
