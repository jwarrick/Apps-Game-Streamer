const APPS_SCRIPT_MAILSLOT_URL = 'https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec';

async function checkFile(name, fileId) {
  console.log(`\n=== Checking ${name} (fileId: ${fileId}) ===`);
  const start = Date.now();
  try {
    const url = `${APPS_SCRIPT_MAILSLOT_URL}?action=download&fileId=${fileId}`;
    console.log(`Fetching from ${url}...`);
    const res = await fetch(url, { redirect: 'follow' });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const json = await res.json();
    console.log(`Success: ${json.success}`);
    if (json.success) {
      console.log(`Filename: ${json.filename}`);
      console.log(`MimeType: ${json.mimeType}`);
      console.log(`Base64 length: ${json.base64 ? json.base64.length : 0}`);
      const byteLength = json.base64 ? Buffer.from(json.base64, 'base64').length : 0;
      console.log(`Decoded Byte size: ${byteLength} bytes (~${(byteLength / 1024 / 1024).toFixed(2)} MB)`);
      if (byteLength > 0 && json.base64) {
        const header = Buffer.from(json.base64.slice(0, 32), 'base64').toString('hex');
        console.log(`First 16 bytes hex: ${header.slice(0, 32)}`);
      }
    } else {
      console.log(`Error: ${json.error}`);
    }
  } catch (err) {
    console.error(`Fetch error:`, err);
  }
  console.log(`Elapsed: ${Date.now() - start}ms`);
}

async function run() {
  await checkFile("Amazing Dig (Clip 0)", "1-ZMPp5Qxfp7oujvjeVVeoRebW6gwMozt");
  await checkFile("Big Block (Clip 1)", "1qE0VLnQLTZkQi5nm5hI_ynmucpN40EZJ");
}

run();
