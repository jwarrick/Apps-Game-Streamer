import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to gamestreamer-live.web.app...');
  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'networkidle' });

  // Test fetch inside browser page context
  const testFetchResult = await page.evaluate(async () => {
    const driveFileId = '13y0rIml66eztBQNOMiJFnbuOr4cSuU8u';
    const directUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download`;
    const fallbackUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    const results = {};

    try {
      console.log('Testing directUrl fetch...');
      const res = await fetch(directUrl);
      results.directUrl = {
        ok: res.ok,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        type: res.type
      };
      if (res.ok) {
        const b = await res.blob();
        results.directUrl.blobSize = b.size;
        results.directUrl.blobType = b.type;
      }
    } catch (e) {
      results.directUrl = { error: e.message, stack: e.stack };
    }

    try {
      console.log('Testing fallbackUrl fetch...');
      const res2 = await fetch(fallbackUrl);
      results.fallbackUrl = {
        ok: res2.ok,
        status: res2.status,
        headers: Object.fromEntries(res2.headers.entries()),
        type: res2.type
      };
      if (res2.ok) {
        const b2 = await res2.blob();
        results.fallbackUrl.blobSize = b2.size;
        results.fallbackUrl.blobType = b2.type;
      }
    } catch (e2) {
      results.fallbackUrl = { error: e2.message, stack: e2.stack };
    }

    return results;
  });

  console.log('Fetch test results in browser:', JSON.stringify(testFetchResult, null, 2));

  await browser.close();
})();
