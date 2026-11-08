// scratch/inspect-moof-fragments.mjs
import fs from 'fs';

const buf = fs.readFileSync('scratch/rice_clip0_amazing_dig.mp4');

function inspectMoof(buffer, offset, size) {
  // Look for tfhd and tfdt inside traf
  console.log(`\n--- MOOF at offset ${offset}, size ${size} ---`);
  let cur = offset + 8;
  const end = offset + size;
  while (cur + 8 <= end) {
    const bSize = buffer.readUInt32BE(cur);
    const bType = buffer.toString('ascii', cur + 4, cur + 8);
    console.log(`  Sub-box: ${bType} at ${cur}, size: ${bSize}`);
    if (bType === 'traf') {
      let trafCur = cur + 8;
      const trafEnd = cur + bSize;
      while (trafCur + 8 <= trafEnd) {
        const tSize = buffer.readUInt32BE(trafCur);
        const tType = buffer.toString('ascii', trafCur + 4, trafCur + 8);
        console.log(`    traf sub-box: ${tType} at ${trafCur}, size: ${tSize}`);
        if (tType === 'tfdt') {
          const version = buffer.readUInt8(trafCur + 8);
          let decodeTime = 0;
          if (version === 1) {
            decodeTime = Number(buffer.readBigUInt64BE(trafCur + 12));
          } else {
            decodeTime = buffer.readUInt32BE(trafCur + 12);
          }
          console.log(`      *** TFDT baseMediaDecodeTime: ${decodeTime} (approx ${(decodeTime/600).toFixed(3)}s at timescale 600) ***`);
        }
        trafCur += tSize;
      }
    }
    cur += bSize;
  }
}

let pos = 0;
while (pos + 8 <= buf.length) {
  const size = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  if (type === 'moof') {
    inspectMoof(buf, pos, size);
  }
  pos += size;
}
