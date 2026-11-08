import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('google') || req.url().includes('usercontent')) {
      console.log('>> REQ:', req.method(), req.url());
    }
  });

  page.on('response', res => {
    if (res.url().includes('google') || res.url().includes('usercontent')) {
      console.log('<< RES:', res.status(), res.url());
      console.log('<< RES HEADERS:', JSON.stringify(res.headers(), null, 2));
    }
  });

  page.on('requestfailed', req => {
    if (req.url().includes('google') || req.url().includes('usercontent')) {
      console.log('XX FAILED:', req.url(), req.failure()?.errorText);
    }
  });

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });

  console.log('\n--- Evaluating direct fetch in browser ---');
  const result = await page.evaluate(async () => {
    const directUrl = 'https://drive.usercontent.google.com/download?id=13y0rIml66eztBQNOMiJFnbuOr4cSuU8u&export=download';
    try {
      const res = await fetch(directUrl);
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Result:', result);
  await browser.close();
})();
