// scratch/detailed-rice-diagnosis.mjs
import fs from 'fs';

const buf0 = fs.readFileSync('scratch/rice_clip0_amazing_dig.mp4');
const buf1 = fs.readFileSync('scratch/rice_clip1_crazy_kill.mp4');

console.log('=== RICE CLIP 0: "Amazing Dig" ===');
console.log(`File size: ${(buf0.length / (1024*1024)).toFixed(2)} MB (${buf0.length} bytes)`);

// Find all moof boxes and their tfdt decode times
function getFragments(buf) {
  const frags = [];
  let pos = 0;
  while (pos + 8 <= buf.length) {
    const size = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'moof') {
      // Find tfdt
      let cur = pos + 8;
      const end = pos + size;
      let tfdtTime = null;
      while (cur + 8 <= end) {
        const subSize = buf.readUInt32BE(cur);
        const subType = buf.toString('ascii', cur + 4, cur + 8);
        if (subType === 'traf') {
          let trafCur = cur + 8;
          const trafEnd = cur + subSize;
          while (trafCur + 8 <= trafEnd) {
            const tSize = buf.readUInt32BE(trafCur);
            const tType = buf.toString('ascii', trafCur + 4, trafCur + 8);
            if (tType === 'tfdt') {
              const version = buf.readUInt8(trafCur + 8);
              tfdtTime = (version === 1) ? Number(buf.readBigUInt64BE(trafCur + 12)) : buf.readUInt32BE(trafCur + 12);
            }
            trafCur += tSize;
          }
        }
        cur += subSize;
      }
      frags.push({ offset: pos, size, tfdtTime, seconds: (tfdtTime / 600).toFixed(3) });
    }
    pos += size;
  }
  return frags;
}

const f0 = getFragments(buf0);
console.log('Fragments in Clip 0:');
f0.forEach((f, i) => {
  console.log(`  Frag #${i+1}: offset ${f.offset}, size ${f.size} B, decodeTime: ${f.tfdtTime} (${f.seconds}s)`);
});

console.log('\n=== RICE CLIP 1: "Crazy Kill" ===');
console.log(`File size: ${(buf1.length / (1024*1024)).toFixed(2)} MB (${buf1.length} bytes)`);
const f1 = getFragments(buf1);
console.log('Fragments in Clip 1:');
f1.forEach((f, i) => {
  console.log(`  Frag #${i+1}: offset ${f.offset}, size ${f.size} B, decodeTime: ${f.tfdtTime} (${f.seconds}s)`);
});
