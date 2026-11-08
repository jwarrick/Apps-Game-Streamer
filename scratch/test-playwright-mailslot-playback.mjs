import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const fileId = '13y0rIml66eztBQNOMiJFnbuOr4cSuU8u';
    const mailSlotUrl = `https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec?action=download&fileId=${fileId}`;

    console.log('Fetching video from Mail Slot in browser...');
    const startTime = Date.now();
    try {
      const res = await fetch(mailSlotUrl, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.base64) throw new Error('No base64 data');

      console.log(`Fetched ${data.base64.length} chars base64 in ${Date.now() - startTime}ms`);

      // Convert base64 to Blob
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'video/mp4' });

      const blobUrl = URL.createObjectURL(blob);
      console.log(`Created blobUrl: ${blobUrl}, size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // Test playing in <video> element
      return new Promise((resolve) => {
        const v = document.createElement('video');
        v.playsInline = true;
        v.muted = true;

        v.onloadeddata = () => {
          resolve({
            success: true,
            sizeMB: (blob.size / 1024 / 1024).toFixed(2),
            duration: v.duration,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight
          });
        };

        v.onerror = (e) => {
          resolve({
            success: false,
            error: v.error ? v.error.message : 'Video load error'
          });
        };

        v.src = blobUrl;
        v.load();
        v.play().catch(() => {});
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('\n=== Playback Result ===\n', JSON.stringify(result, null, 2));

  await browser.close();
})();
