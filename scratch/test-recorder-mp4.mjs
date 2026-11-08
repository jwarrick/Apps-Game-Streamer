import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const result = await page.evaluate(async () => {
    // Create an animated canvas stream
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const draw = () => {
      ctx.fillStyle = `rgb(${frame % 255}, 100, 150)`;
      ctx.fillRect(0, 0, 640, 480);
      frame += 5;
      requestAnimationFrame(draw);
    };
    draw();

    const stream = canvas.captureStream(30);

    // Test different mimeTypes
    const mimeTypes = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm'
    ];

    const reports = [];

    for (const mimeType of mimeTypes) {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        reports.push({ mimeType, supported: false });
        continue;
      }

      // Record for 1.5 seconds
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.start(250);

      await new Promise(r => setTimeout(r, 1500));

      const blob = await new Promise(resolve => {
        rec.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
        rec.stop();
      });

      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let hex = '';
      for (let i = 0; i < Math.min(32, bytes.length); i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }

      // Check if <video> can play this blob
      const video = document.createElement('video');
      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      const playResult = await new Promise(resolve => {
        video.onloadedmetadata = () => resolve({ canPlay: true, duration: video.duration });
        video.onerror = () => resolve({ canPlay: false, error: video.error ? video.error.message : 'error' });
        setTimeout(() => resolve({ canPlay: false, error: 'timeout' }), 3000);
      });

      reports.push({
        mimeType,
        supported: true,
        chunkCount: chunks.length,
        totalBytes: blob.size,
        first32Hex: hex,
        playResult
      });
    }

    return reports;
  });

  console.log('Recorder test reports:', JSON.stringify(result, null, 2));
  await browser.close();
})();
