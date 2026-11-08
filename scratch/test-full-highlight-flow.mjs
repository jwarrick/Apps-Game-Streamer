import { chromium } from 'playwright';

(async () => {
  console.log('Testing highlight buffer at 0-0 and score association for Last Point...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StreamerView]') || text.includes('[GameStore]')) {
      console.log('  Browser Log:', text);
    }
  });

  // Navigate to local app or direct evaluation
  await page.goto('http://localhost:4175', { waitUntil: 'domcontentloaded' }).catch(async () => {
    // If 4175 not running, navigate to live
    await page.goto('https://gamestreamer-live.web.app/#/stream', { waitUntil: 'domcontentloaded' });
  });

  await page.waitForTimeout(1000);

  const evaluationResult = await page.evaluate(async () => {
    // Simulate canvas stream & dual recorder in browser
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let f = 0;
    const interval = setInterval(() => {
      ctx.fillStyle = (f++ % 2 === 0) ? '#ff0000' : '#0000ff';
      ctx.fillRect(0, 0, 640, 480);
    }, 33);
    const stream = canvas.captureStream(30);

    const { store } = window.store ? { store: window.store } : await import('/src/services/store.js');

    // Reset active match to 0-0
    const m = store.getState().activeMatch;
    m.scoreUs = 0;
    m.scoreThem = 0;
    m.currentSet = 1;
    store.initPointBuffers();

    return { ready: true };
  }).catch(e => ({ error: e.message }));

  console.log('Evaluation setup:', evaluationResult);
  await browser.close();
})();
