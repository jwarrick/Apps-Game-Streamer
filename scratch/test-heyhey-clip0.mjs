import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('HighlightReelPlayer') || text.includes('Pipeline') || text.includes('Error')) {
      console.log('REEL LOG:', text);
    }
  });

  await page.goto('https://gamestreamer-live.web.app', { waitUntil: 'domcontentloaded' });

  // Test the Mail Slot fetch directly in browser context
  console.log('\n--- Testing Mail Slot Fetch & Playback in Browser ---');
  const result = await page.evaluate(async () => {
    const driveFileId = '1-XdJGkh_KUW4_pJWQaEdLleCipsCnuwx'; // Clip 0 of Heyhey match
    const mailSlotUrl = `https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec?action=download&fileId=${encodeURIComponent(driveFileId)}`;

    console.log('Fetching clip 0 from Mail Slot...');
    const t0 = Date.now();
    const res = await fetch(mailSlotUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`Received JSON response in ${Date.now() - t0}ms, success: ${data.success}, base64 len: ${data.base64?.length}`);

    // Convert base64
    const byteCharacters = atob(data.base64);
    const sliceSize = 1024 * 512;
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    const blob = new Blob(byteArrays, { type: data.mimeType || 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.playsInline = true;
      v.muted = true;
      v.onloadeddata = () => {
        resolve({
          ok: true,
          blobSizeMB: (blob.size / 1024 / 1024).toFixed(2),
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight
        });
      };
      v.onerror = (e) => {
        resolve({
          ok: false,
          error: v.error ? v.error.message : 'Video element error'
        });
      };
      v.src = blobUrl;
      v.load();
    });
  });

  console.log('Result for Heyhey Clip 0:', JSON.stringify(result, null, 2));

  await browser.close();
})();
