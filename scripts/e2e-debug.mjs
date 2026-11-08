import { chromium } from 'playwright';

async function run() {
  console.log('=== STARTING PLAYWRIGHT DELETE & BROADCAST INVESTIGATION ===');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
  });

  page.on('dialog', async dialog => {
    console.log(`[BROWSER DIALOG ${dialog.type()}]:`, dialog.message());
    await dialog.accept();
  });

  console.log('1. Navigating to https://localhost:5173/ ...');
  await page.goto('https://localhost:5173/');
  await page.waitForTimeout(1000);

  // Check state of matches displayed on Hub
  let matchCards = await page.$$('.match-card');
  console.log(`Initial match cards on Hub: ${matchCards.length}`);
  for (let i = 0; i < matchCards.length; i++) {
    const text = await matchCards[i].innerText();
    const firstLine = text.split('\n')[0];
    console.log(`  Card ${i}: ${firstLine}`);
  }

  // Find delete buttons
  const deleteButtons = await page.$$('.btn-trash-match');
  console.log(`Found ${deleteButtons.length} delete buttons`);

  if (deleteButtons.length > 0) {
    console.log('2. Clicking delete on the first match...');
    await deleteButtons[0].click();
    await page.waitForTimeout(500);

    // Check if PIN modal appeared
    const pinInput = await page.$('#pin-input');
    if (pinInput) {
      console.log('PIN modal appeared. Entering PIN 1234...');
      await pinInput.fill('1234');
      await page.click('#btn-submit-pin');
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);
    matchCards = await page.$$('.match-card');
    console.log(`Match cards remaining on Hub after deletion: ${matchCards.length}`);
    for (let i = 0; i < matchCards.length; i++) {
      const text = await matchCards[i].innerText();
      const firstLine = text.split('\n')[0];
      console.log(`  Card ${i}: ${firstLine}`);
    }
  }

  await browser.close();
  console.log('=== INVESTIGATION COMPLETED ===');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
