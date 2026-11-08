import { chromium } from 'playwright';

(async () => {
  console.log('Testing highlight creation at 0-0 and duration calculation...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const result = await page.evaluate(async () => {
    // 1. Create canvas stream simulating camera
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
    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1'
               : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
               : 'video/webm';

    // 2. Start dual recorders as implemented
    let pointChunks = [];
    let highlightChunks = [];
    const rallyStartTime = Date.now();

    const pointRecorder = new MediaRecorder(stream, { mimeType: mime });
    pointRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) pointChunks.push(e.data); };
    pointRecorder.start(250);

    const highlightRecorder = new MediaRecorder(stream, { mimeType: mime });
    highlightRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) highlightChunks.push(e.data); };
    highlightRecorder.start(250);

    // 3. Wait 1.8 seconds at 0-0
    await new Promise(r => setTimeout(r, 1800));

    // 4. Capture Current Point Highlight at 0-0
    const highlightCapturePromise = new Promise(resolve => {
      const rec = highlightRecorder;
      const durationMs = Date.now() - rallyStartTime;
      rec.onstop = () => {
        const blob = new Blob(highlightChunks, { type: mime });
        resolve({ blob, durationMs });
      };
      rec.stop();
    });

    const highlightResult = await highlightCapturePromise;

    // Test playing this highlight blob in an HTML5 video
    const video = document.createElement('video');
    video.src = URL.createObjectURL(highlightResult.blob);
    let videoLoaded = false;
    let videoDuration = 0;
    try {
      await new Promise((res, rej) => {
        video.onloadedmetadata = () => { videoLoaded = true; videoDuration = video.duration; res(); };
        video.onerror = rej;
        setTimeout(rej, 2000);
      });
    } catch(e) {}

    // 5. Point finishes at 3.0 seconds total (pointRecorder continues uninterrupted!)
    await new Promise(r => setTimeout(r, 1200));

    const pointFinalizePromise = new Promise(resolve => {
      const rec = pointRecorder;
      const durationMs = Date.now() - rallyStartTime;
      rec.onstop = () => {
        const blob = new Blob(pointChunks, { type: mime });
        resolve({ blob, durationMs });
      };
      rec.stop();
    });

    const pointResult = await pointFinalizePromise;
    clearInterval(interval);

    const pointVideo = document.createElement('video');
    pointVideo.src = URL.createObjectURL(pointResult.blob);
    let pointVideoLoaded = false;
    let pointVideoDuration = 0;
    try {
      await new Promise((res, rej) => {
        pointVideo.onloadedmetadata = () => { pointVideoLoaded = true; pointVideoDuration = pointVideo.duration; res(); };
        pointVideo.onerror = rej;
        setTimeout(rej, 2000);
      });
    } catch(e) {}

    return {
      highlightBlobSize: highlightResult.blob.size,
      highlightDurationMs: highlightResult.durationMs,
      videoLoaded,
      videoDuration,
      pointBlobSize: pointResult.blob.size,
      pointDurationMs: pointResult.durationMs,
      pointVideoLoaded,
      pointVideoDuration
    };
  });

  console.log('Result:', result);
  await browser.close();
})();
