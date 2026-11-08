import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });

  const id = '13y0rIml66eztBQNOMiJFnbuOr4cSuU8u';

  const urlsToTest = [
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.google.com/uc?id=${id}&export=download`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    `https://drive.google.com/file/d/${id}/preview`,
    `https://lh3.googleusercontent.com/d/${id}`,
    `https://drive.google.com/uc?export=view&id=${id}`
  ];

  for (const url of urlsToTest) {
    console.log(`\nTesting video src: ${url}`);
    const res = await page.evaluate(async (testUrl) => {
      return new Promise((resolve) => {
        const v = document.createElement('video');
        v.playsInline = true;
        v.muted = true;
        v.preload = 'auto';

        const timeout = setTimeout(() => {
          v.src = '';
          resolve({ url: testUrl, status: 'TIMEOUT_5S' });
        }, 5000);

        v.onloadeddata = () => {
          clearTimeout(timeout);
          resolve({ url: testUrl, status: 'LOADED_DATA', duration: v.duration, videoWidth: v.videoWidth });
          v.src = '';
        };

        v.onerror = (e) => {
          clearTimeout(timeout);
          resolve({
            url: testUrl,
            status: 'ERROR',
            code: v.error ? v.error.code : null,
            message: v.error ? v.error.message : null
          });
          v.src = '';
        };

        v.src = testUrl;
        v.load();
      });
    }, url);

    console.log('Result:', JSON.stringify(res, null, 2));
  }

  await browser.close();
})();
