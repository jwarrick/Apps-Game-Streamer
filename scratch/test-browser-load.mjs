import { chromium } from 'playwright';

(async () => {
  console.log('Testing Highlight Buffer Indexing & 3s Point Debounce in Browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log('  Browser Log:', text);
    }
  });

  await page.goto('http://localhost:4175', { waitUntil: 'networkidle' });

  // 1. Enter Streamer View by clicking Go Live or broadcasting
  const testResults = await page.evaluate(async () => {
    // Access global store from module
    const store = window.__testStore || (await import('./assets/index-0A4iJaWN.js')).store;
    return { ok: !!store };
  }).catch(() => ({ ok: false }));

  console.log('Module check:', testResults);
  await browser.close();
})();
