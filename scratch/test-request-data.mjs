import { chromium, webkit } from 'playwright';

async function testRecorder(browserType, name) {
  console.log(`\nTesting ${name}...`);
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const result = await page.evaluate(async () => {
    // create a canvas stream
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 640, 480);

    // animate canvas
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      ctx.fillStyle = frame % 2 === 0 ? 'red' : 'blue';
      ctx.fillRect(0, 0, 640, 480);
    }, 50);

    const stream = canvas.captureStream(30);

    // check mime
    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1'
               : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
               : 'video/webm';

    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    rec.start();
    await new Promise(r => setTimeout(r, 600));

    // Request data mid-recording
    rec.requestData();
    await new Promise(r => setTimeout(r, 100));

    const midChunks = [...chunks];
    const midBlob = new Blob(midChunks, { type: mime });
    const midUrl = URL.createObjectURL(midBlob);

    // Test playing midBlob in a video element
    const testVideo = document.createElement('video');
    testVideo.src = midUrl;
    testVideo.muted = true;

    let midPlayable = false;
    let midDuration = 0;
    try {
      await new Promise((res, rej) => {
        testVideo.onloadedmetadata = () => {
          midPlayable = true;
          midDuration = testVideo.duration;
          res();
        };
        testVideo.onerror = (e) => rej(new Error('video error on midBlob: ' + (testVideo.error ? testVideo.error.message : 'unknown')));
        setTimeout(() => rej(new Error('timeout waiting for metadata')), 2000);
      });
    } catch (err) {
      midPlayable = false;
    }

    // Now wait a bit more and stop
    await new Promise(r => setTimeout(r, 600));
    const stopPromise = new Promise(r => { rec.onstop = r; });
    rec.stop();
    await stopPromise;
    clearInterval(interval);

    const fullBlob = new Blob(chunks, { type: mime });
    const fullUrl = URL.createObjectURL(fullBlob);
    const fullVideo = document.createElement('video');
    fullVideo.src = fullUrl;
    fullVideo.muted = true;
    let fullPlayable = false;
    let fullDuration = 0;
    try {
      await new Promise((res, rej) => {
        fullVideo.onloadedmetadata = () => {
          fullPlayable = true;
          fullDuration = fullVideo.duration;
          res();
        };
        fullVideo.onerror = (e) => rej(new Error('video error on fullBlob: ' + (fullVideo.error ? fullVideo.error.message : 'unknown')));
        setTimeout(() => rej(new Error('timeout waiting for metadata')), 2000);
      });
    } catch (err) {
      fullPlayable = false;
    }

    return {
      mime,
      midChunksCount: midChunks.length,
      midBlobSize: midBlob.size,
      midPlayable,
      midDuration,
      totalChunksCount: chunks.length,
      fullBlobSize: fullBlob.size,
      fullPlayable,
      fullDuration
    };
  });

  console.log('Result for', name, result);
  await browser.close();
}

(async () => {
  try {
    await testRecorder(chromium, 'Chromium');
  } catch (e) {
    console.error('Chromium error:', e);
  }
  try {
    await testRecorder(webkit, 'WebKit');
  } catch (e) {
    console.error('WebKit error:', e);
  }
})();
