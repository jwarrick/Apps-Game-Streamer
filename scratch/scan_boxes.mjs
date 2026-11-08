const APPS_SCRIPT_MAILSLOT_URL = 'https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec';

async function scanBoxes(fileId) {
  console.log(`Fetching ${fileId}...`);
  const res = await fetch(`${APPS_SCRIPT_MAILSLOT_URL}?action=download&fileId=${fileId}`, { redirect: 'follow' });
  const json = await res.json();
  if (!json.success || !json.base64) {
    console.log("Failed to download:", json.error);
    return;
  }
  const buf = Buffer.from(json.base64, 'base64');
  console.log(`Downloaded ${buf.length} bytes`);

  let offset = 0;
  let boxCount = 0;
  while (offset + 8 <= buf.length && boxCount < 20) {
    const size = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    console.log(`Box [${boxCount}]: type="${type}", size=${size}, offset=${offset}`);
    boxCount++;
    if (size <= 0 || offset + size > buf.length) {
      console.log(`Invalid box size ${size} at offset ${offset}`);
      break;
    }
    offset += size;
  }

  // Also search for "ftyp" anywhere in the first 1 MB
  const searchLimit = Math.min(buf.length, 1024 * 1024);
  const ftypIndex = buf.indexOf(Buffer.from('ftyp'), 0);
  console.log(`\nftyp index in entire file: ${ftypIndex}`);
  if (ftypIndex !== -1) {
    console.log(`ftyp found at offset ${ftypIndex} (box starts at ${ftypIndex - 4})!`);
    const ftypSize = buf.readUInt32BE(ftypIndex - 4);
    console.log(`ftyp box size: ${ftypSize}`);
    const brand = buf.toString('ascii', ftypIndex + 4, ftypIndex + 8);
    console.log(`Major brand: "${brand}"`);
  }
}

scanBoxes("1-ZMPp5Qxfp7oujvjeVVeoRebW6gwMozt");
