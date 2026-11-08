import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');

  client.on('Network.requestWillBeSent', params => {
    if (params.request.url.includes('drive')) {
      console.log('CDP REQ:', params.request.url, params.request.headers);
    }
  });

  client.on('Network.responseReceived', params => {
    if (params.response.url.includes('drive')) {
      console.log('CDP RES:', params.response.status, params.response.url, params.response.headers);
    }
  });

  client.on('Network.loadingFailed', params => {
    if (params.errorText || params.canceled) {
      console.log('CDP FAILED:', params.errorText, params.canceled, params.corsErrorStatus);
    }
  });

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });

  const res = await page.evaluate(async () => {
    try {
      const r = await fetch('https://drive.usercontent.google.com/download?id=13y0rIml66eztBQNOMiJFnbuOr4cSuU8u&export=download');
      return { ok: r.ok };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Eval res:', res);
  await browser.close();
})();
