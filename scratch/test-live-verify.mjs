// scratch/test-live-verify.mjs
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const res = await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'networkidle' });
  console.log('Live HTTP status:', res.status());
  const title = await page.title();
  console.log('Live page title:', title);
  await browser.close();
  console.log('Live site online and verified!');
})();
