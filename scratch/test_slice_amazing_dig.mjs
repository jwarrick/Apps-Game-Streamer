import { chromium } from 'playwright';

const APPS_SCRIPT_MAILSLOT_URL = 'https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec';

async function testSlice() {
  console.log("Fetching Amazing Dig...");
  const res = await fetch(`${APPS_SCRIPT_MAILSLOT_URL}?action=download&fileId=1-ZMPp5Qxfp7oujvjeVVeoRebW6gwMozt`, { redirect: 'follow' });
  const json = await res.json();
  const rawBuf = Buffer.from(json.base64, 'base64');
  console.log(`Downloaded ${rawBuf.length} bytes`);

  // Slice at offset 1280490 where ftyp starts!
  const fixedBuf = rawBuf.subarray(1280490);
  console.log(`Fixed buffer starts at ftyp, size: ${fixedBuf.length} bytes`);
  const fixedBase64 = fixedBuf.toString('base64');

  // Launch browser and test playback of fixed buffer
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const playTest = await page.evaluate(async (b64) => {
    function b64ToBlob(base64, mimeType = 'video/mp4') {
      const byteCharacters = atob(base64);
      const sliceSize = 1024 * 512;
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, { type: mimeType });
    }

    const blob = b64ToBlob(b64);
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);

    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        resolve({
          success: true,
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
      };
      video.onerror = (e) => {
        resolve({
          success: false,
          error: video.error ? video.error.message : 'Error'
        });
      };
      setTimeout(() => resolve({ success: false, error: 'timeout' }), 5000);
    });
  }, fixedBase64);

  console.log("Play test of sliced Amazing Dig:", playTest);
  await browser.close();
}

testSlice();
